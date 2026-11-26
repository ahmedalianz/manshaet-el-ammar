import { pickServiceContact } from './importContact';
import { File } from 'expo-file-system';
import Svg, { Path } from 'react-native-svg';
import { deleteDraftPhoto } from '../photos/draftFiles';
import { PhotoField } from '../photos/PhotoField';
import { photoRequest, uploadPhoto, type PhotoDraft } from '../photos/api';
import type { Availability } from '../availability/types';
import { AddServiceArtwork } from './AddServiceArtwork';
import { ServiceReview } from './ServiceReview';
import { CategorySelectionSheet } from './CategorySelectionSheet';
import { ProviderAction } from './ProviderPage';
import { fieldLabels, fieldValue } from '../admin/AdminUi';
import { changedFields } from './changedFields';
import {
  readDraft,
  saveDraft,
  discardDraft,
  draftEpoch,
  type ServiceDraft,
} from '../local/drafts';
import { AvailabilityFields } from '../availability/AvailabilityFields';
import { useFeedback } from '../../components/ui/Feedback';
import {
  MotionPressable as Pressable,
  MotionReveal,
} from '../../components/ui/Motion';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect, usePreventRemove } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import {
  AppState,
  ActivityIndicator,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  I18nManager,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Keyboard,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../../theme/spacing';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import { CategoryIcon } from '../discovery/components/DiscoveryUi';
import { categoryImages } from '../discovery/data/categoryImages';
import { useProviderState } from './ProviderContext';
import type { ProviderListing, ServiceValues } from './types';
import { FormField } from './FormField';
import { serviceExamples } from './serviceExamples';
import {
  normalizeMobile,
  validateMobile,
  validateService,
  type FormErrors,
} from './validation';

const emptyValues: ServiceValues = {
  name: '',
  categoryId: '',
  serviceTitle: '',
  description: '',
  phone: '',
  whatsapp: '',

  address: '',
};
function listingValues(
  listing?: ProviderListing,
  proposal?: boolean,
): ServiceValues {
  if (!listing) return emptyValues;
  const source =
    proposal && listing.pendingChanges ? listing.pendingChanges : listing;
  return {
    name: source.name,
    categoryId: source.categoryId,
    serviceTitle: source.serviceTitle,
    description: source.description,
    phone: source.phone,
    whatsapp: source.whatsapp ?? '',

    address: source.address,
    serviceMode: source.serviceMode,
    weeklyHours: source.weeklyHours,
  };
}
function comparableServiceValues(
  values: ServiceValues,
  sameNumber: boolean,
): ServiceValues {
  const rawWhatsapp =
    sameNumber && !validateMobile(values.phone)
      ? values.phone
      : (values.whatsapp ?? '');
  return {
    name: values.name.trim(),
    categoryId: values.categoryId.trim(),
    serviceTitle: values.serviceTitle.trim(),
    description: values.description.trim(),
    phone: values.phone.trim() ? normalizeMobile(values.phone.trim()) : '',
    whatsapp: rawWhatsapp.trim() ? normalizeMobile(rawWhatsapp.trim()) : '',
    address: values.address.trim(),
    serviceMode: values.serviceMode,
    weeklyHours: values.weeklyHours,
  };
}
function hasDraftChanges(
  base: ServiceValues,
  baseSameNumber: boolean,
  candidate: ServiceValues,
  candidateSameNumber: boolean,
  candidatePhoto?: PhotoDraft,
): boolean {
  if (candidatePhoto && candidatePhoto.action !== 'keep') return true;
  return (
    changedFields(
      comparableServiceValues(base, baseSameNumber),
      comparableServiceValues(candidate, candidateSameNumber),
    ).length > 0
  );
}
export function ServiceForm({
  listing,
  proposal = false,
  draftProviderId,
  offlineDraftOnly = false,
  autoRestoreDraft = false,
  onRefreshDraft,
  adminDirect = false,
  hasPendingRequest = false,
  onAdminComplete,
}: {
  listing?: ProviderListing;
  proposal?: boolean;
  draftProviderId?: string;
  offlineDraftOnly?: boolean;
  autoRestoreDraft?: boolean;
  onRefreshDraft?: () => void;
  adminDirect?: boolean;
  hasPendingRequest?: boolean;
  onAdminComplete?: (providerId: string) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors, resolved } = useAppTheme();
  const isDark = resolved === 'dark';
  const { width, fontScale } = useWindowDimensions();
  const compactBanner = width / fontScale < 280;
  const feedback = useFeedback();
  const {
    userId,
    submit,
    saveAdminService,
    categories: remoteCategories,
    allocateSubmissionId,
  } = useProviderState();
  const categories = remoteCategories ?? [];
  const submissionId = useRef<string | undefined>(undefined);
  const [initial] = useState(() => listingValues(listing, proposal));
  const [values, setValues] = useState(initial);
  const [photoDraft, setPhotoDraft] = useState<PhotoDraft>({ action: 'keep' });
  const [photoProgress, setPhotoProgress] = useState<number>();
  const photoAbort = useRef<AbortController | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [hoursPending, setHoursPending] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const fieldRefs = useRef<
    Partial<Record<keyof ServiceValues, ComponentRef<typeof TextInput> | null>>
  >({});
  const fieldY = useRef<Partial<Record<keyof ServiceValues, number>>>({});
  const step1PanelY = useRef(0);
  const focusRequested = useRef(false);
  const [initialSameNumber] = useState(() =>
    Boolean(
      initial.whatsapp &&
      normalizeMobile(initial.whatsapp) === normalizeMobile(initial.phone),
    ),
  );
  const [sameNumber, setSameNumber] = useState(initialSameNumber);
  const canUseSameNumber = !validateMobile(values.phone);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  useEffect(() => {
    if (!focusRequested.current) return;
    focusRequested.current = false;
    const order: (keyof ServiceValues)[] =
      step === 1
        ? ['name', 'categoryId', 'serviceTitle']
        : ['phone', 'whatsapp', 'serviceMode', 'address', 'weeklyHours'];
    if (errors.consent && reviewing) {
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
      return;
    }
    const field = order.find((key) => errors[key]);
    if (field)
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, (fieldY.current[field] ?? 0) - 16),
          animated: true,
        });
        fieldRefs.current[field]?.focus();
        if (field === 'categoryId') setCategoryOpen(true);
      });
  }, [errors, step, reviewing]);
  const [submitError, setSubmitError] = useState('');
  const [photoSubmitFailed, setPhotoSubmitFailed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const completedRef = useRef(false);
  const submitting = useRef(false);
  const draftKey = listing?.id ?? draftProviderId ?? 'new';
  const baseRevision = useRef(listing?.updatedAt);
  const listingRef = useRef(listing);
  const initialRef = useRef(initial);
  const feedbackRef = useRef(feedback);
  useEffect(() => {
    listingRef.current = listing;
    feedbackRef.current = feedback;
  }, [listing, feedback]);
  const [draftStatus, setDraftStatus] = useState('');
  const [draftStorageError, setDraftStorageError] = useState('');
  const mounted = useRef(true);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftEnabled = useRef(false);
  const draftCleared = useRef(false);
  const hadSavedDraft = useRef(false);
  const checkedDraftKey = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      photoAbort.current?.abort();
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
      feedbackRef.current.dismiss?.('restore-service-draft');
      feedbackRef.current.dismiss?.('discard-service-changes');
    };
  }, []);
  const epoch = useRef(userId ? draftEpoch(userId) : 0);
  const draftSnapshot = useRef({ values, step, sameNumber, photoDraft });
  useEffect(() => {
    draftSnapshot.current = { values, step, sameNumber, photoDraft };
  }, [values, step, sameNumber, photoDraft]);
  const flushDraft = useCallback(() => {
    if (
      !userId ||
      !draftEnabled.current ||
      draftCleared.current ||
      submitting.current ||
      completedRef.current
    )
      return Promise.resolve();
    const meaningful = hasDraftChanges(
      initial,
      initialSameNumber,
      draftSnapshot.current.values,
      draftSnapshot.current.sameNumber,
      draftSnapshot.current.photoDraft,
    );
    if (!meaningful) {
      if (hadSavedDraft.current) {
        hadSavedDraft.current = false;
        return discardDraft(userId, draftKey)
          .then(() => {
            if (mounted.current) setDraftStatus('');
          })
          .catch(() => {});
      }
      return Promise.resolve();
    }
    const writingVersion = JSON.stringify(draftSnapshot.current);
    return saveDraft(
      userId,
      draftKey,
      {
        ...draftSnapshot.current,
        baseRevision: listingRef.current?.updatedAt ?? baseRevision.current,
        savedAt: new Date().toISOString(),
      },
      epoch.current,
    )
      .then(() => {
        hadSavedDraft.current = true;
        if (
          mounted.current &&
          epoch.current === draftEpoch(userId) &&
          writingVersion === JSON.stringify(draftSnapshot.current)
        ) {
          setDraftStatus('المسودة اتحفظت على الجهاز.');
          setDraftStorageError('');
        }
      })
      .catch((error: unknown) => {
        if (mounted.current)
          setDraftStorageError(
            'مش قادرين نحفظ المسودة. سيب الصفحة مفتوحة وجرّب تاني.',
          );
        throw error;
      });
  }, [userId, draftKey, initial, initialSameNumber]);
  const clearDraft = async () => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    draftCleared.current = true;
    hadSavedDraft.current = false;
    try {
      if (userId) await discardDraft(userId, draftKey);
      deleteDraftPhoto(photoDraft.localUri);
      if (mounted.current) setDraftStatus('');
    } catch (error) {
      draftCleared.current = false;
      if (mounted.current)
        setDraftStorageError('مش قادرين نمسح المسودة من الجهاز. جرّب تاني.');
      throw error;
    }
  };

  useEffect(() => {
    let active = true;
    const sessionKey = userId ? `${userId}:${draftKey}` : null;
    if (!userId || !sessionKey || checkedDraftKey.current === sessionKey)
      return;
    checkedDraftKey.current = sessionKey;
    const restoreLoadedDraft = (draft: ServiceDraft) => {
      setValues(draft.values);
      let restoredPhoto: PhotoDraft = draft.photoDraft ?? {
        action: 'keep',
      };
      if (
        restoredPhoto.action === 'replace' &&
        restoredPhoto.localUri &&
        Platform.OS !== 'web'
      ) {
        try {
          if (!new File(restoredPhoto.localUri).exists) {
            restoredPhoto = { action: 'keep' };
            setDraftStorageError(
              'ملف الصورة المحفوظ في المسودة مبقاش موجود. اختار الصورة تاني لو حابب.',
            );
          }
        } catch {
          restoredPhoto = { action: 'keep' };
        }
      }
      setPhotoDraft(restoredPhoto);
      submissionId.current = restoredPhoto.submissionId;
      setStep(draft.step);
      setSameNumber(draft.sameNumber);
      setConsent(false);
      draftEnabled.current = true;
    };
    void readDraft(userId, draftKey)
      .then((draft) => {
        if (
          !active ||
          !mounted.current ||
          submitting.current ||
          draftCleared.current ||
          completedRef.current
        )
          return;
        if (!draft) {
          draftEnabled.current = true;
          return;
        }
        if (
          !hasDraftChanges(
            initialRef.current,
            initialSameNumber,
            draft.values,
            draft.sameNumber,
            draft.photoDraft,
          )
        ) {
          void discardDraft(userId, draftKey).catch(() => {});
          draftEnabled.current = true;
          return;
        }
        hadSavedDraft.current = true;
        baseRevision.current = draft.baseRevision;
        const currentListing = listingRef.current;
        const stale = Boolean(
          currentListing && draft.baseRevision !== currentListing.updatedAt,
        );
        if (autoRestoreDraft && !stale) {
          restoreLoadedDraft(draft);
          return;
        }
        feedbackRef.current.show(
          stale ? 'الخدمة اتحدثت بعد المسودة' : 'نكمل المسودة؟',
          stale
            ? 'البيانات المنشورة اتغيرت. راجع الفرق قبل استعادة المسودة:\n' +
                changedFields(
                  comparableServiceValues(
                    initialRef.current,
                    initialSameNumber,
                  ),
                  comparableServiceValues(draft.values, draft.sameNumber),
                )
                  .map(
                    (key) =>
                      `${fieldLabels[key]} — الحالي: ${fieldValue(initialRef.current, key)} / المسودة: ${fieldValue(draft.values, key)}`,
                  )
                  .join('\n')
            : 'في بيانات محفوظة على الجهاز تقدر تكملها.',
          [
            {
              text: 'حذف المسودة',
              style: 'destructive',
              onPress: () => {
                hadSavedDraft.current = false;
                void discardDraft(userId, draftKey).catch(() =>
                  setDraftStorageError('مش قادرين نمسح المسودة. جرّب تاني.'),
                );
                draftEnabled.current = true;
              },
            },
            {
              text: 'استعادة المسودة',
              onPress: () => restoreLoadedDraft(draft),
            },
          ],
          { key: 'restore-service-draft' },
        );
      })
      .catch(() => {
        if (active) setDraftStorageError('مش قادرين نقرأ المسودة المحفوظة.');
        draftEnabled.current = true;
      });
    return () => {
      active = false;
    };
  }, [userId, draftKey, initialSameNumber, autoRestoreDraft]);
  useEffect(() => {
    if (
      draftEnabled.current &&
      !draftCleared.current &&
      !submitting.current &&
      !completedRef.current &&
      hasDraftChanges(
        initial,
        initialSameNumber,
        values,
        sameNumber,
        photoDraft,
      )
    )
      setDraftStatus('بنحفظ المسودة...');
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      void flushDraft().catch(() => {});
    }, 750);
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [
    values,
    step,
    sameNumber,
    photoDraft,
    flushDraft,
    initial,
    initialSameNumber,
  ]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flushDraft().catch(() => {});
    });
    return () => {
      subscription.remove();
      void flushDraft().catch(() => {});
    };
  }, [flushDraft]);

  const dirty =
    hasDraftChanges(
      initial,
      initialSameNumber,
      values,
      sameNumber,
      photoDraft,
    ) || consent;
  const disablePrevention = usePreventRemove(
    (dirty || step === 2 || reviewing) && !completed,
    ({ repeat }) => {
      if (submitting.current) return;
      if (reviewing) {
        setReviewing(false);
        setReturnToReview(false);
        setConsent(false);
        return;
      }
      if (step === 2) {
        setHoursPending(false);
        setStep(1);
        return;
      }
      feedback.show(
        'إلغاء التغييرات؟',
        'تقدر تحتفظ بالمسودة على الجهاز أو تلغي التغييرات.',
        [
          { text: 'كمّل التعديل', style: 'cancel' },
          {
            text: 'حفظ المسودة والخروج',
            onPress: () => {
              void flushDraft()
                .then(() => {
                  setCompleted(true);
                  repeat();
                })
                .catch(() => {});
            },
          },
          {
            text: 'إلغاء التغييرات',
            style: 'destructive',
            onPress: async () => {
              try {
                await clearDraft();
                setCompleted(true);
                repeat();
              } catch {}
            },
          },
        ],
        { key: 'discard-service-changes' },
      );
    },
  );
  const importing = useRef(false);
  const [importBusy, setImportBusy] = useState(false);
  const importContact = async () => {
    if (importing.current) return;
    importing.current = true;
    setImportBusy(true);
    try {
      const contact = await pickServiceContact();
      if (!contact) return;
      const apply = (phone: string) => {
        const name = contact.name || values.name;
        const save = () => {
          setValues((current) => ({ ...current, name, phone }));
          setErrors((current) => ({
            ...current,
            name: undefined,
            phone: undefined,
          }));
        };
        if (
          (values.name && values.name !== name) ||
          (values.phone && normalizeMobile(values.phone) !== phone)
        ) {
          feedback.show('استبدال بيانات التواصل؟', name + '\n' + phone, [
            { text: 'رجوع', style: 'cancel' },
            { text: 'استبدال', onPress: save },
          ]);
        } else save();
      };
      if (contact.phones.length === 1) apply(contact.phones[0]);
      else
        feedback.show('اختار رقم التواصل', contact.name, [
          ...contact.phones.map((phone) => ({
            text: phone,
            onPress: () => apply(phone),
          })),
          { text: 'رجوع', style: 'cancel' },
        ]);
    } catch (error) {
      feedback.show(
        'تعذر استيراد جهة الاتصال',
        error instanceof Error
          ? error.message
          : 'جرّب تاني أو اكتب البيانات يدويًا.',
      );
    } finally {
      importing.current = false;
      setImportBusy(false);
    }
  };
  const update = (field: keyof ServiceValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const effectiveValues = {
    ...values,
    whatsapp:
      sameNumber && !validateMobile(values.phone)
        ? values.phone
        : values.whatsapp,
  };
  const send = async (overridePhoto?: PhotoDraft) => {
    const activePhoto = overridePhoto ?? photoDraft;
    if (offlineDraftOnly) {
      setSubmitError(
        'المسودة محفوظة للتعديل بس. حدّث بيانات حسابك بعد رجوع الإنترنت قبل الإرسال.',
      );
      return;
    }
    if (submitting.current) return;
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    feedback.dismiss?.('restore-service-draft');
    submitting.current = true;
    setBusy(true);
    setSubmitError('');
    setPhotoSubmitFailed(false);
    try {
      const normalized = Object.fromEntries(
        Object.entries(effectiveValues).map(([key, value]) => [
          key,
          typeof value === 'string' ? value.trim() : value,
        ]),
      ) as ServiceValues;
      normalized.phone = normalizeMobile(normalized.phone);
      normalized.whatsapp = normalized.whatsapp
        ? normalizeMobile(normalized.whatsapp)
        : undefined;
      submissionId.current ??= allocateSubmissionId?.();
      const stageReplacementPhoto = async (
        reusableCandidateId?: string,
      ): Promise<string> => {
        if (!activePhoto.localUri || !submissionId.current) {
          setPhotoDraft({ action: 'keep' });
          throw new Error('اختار الصورة تاني قبل الإرسال.');
        }
        if (Platform.OS !== 'web' && !new File(activePhoto.localUri).exists) {
          setPhotoDraft({ action: 'keep' });
          throw new Error(
            'ملف الصورة مبقاش موجود على الجهاز. اختار الصورة تاني قبل الإرسال.',
          );
        }
        if (reusableCandidateId) return reusableCandidateId;
        const serviceId =
          listing?.id ?? draftProviderId ?? `provider-${submissionId.current}`;
        const reserved = await photoRequest<{ candidateId: string }>(
          '/v1/photos/reservations',
          {
            method: 'POST',
            body: JSON.stringify({
              serviceId,
              submissionId: submissionId.current,
              expectedPhotoVersion: listing?.placePhoto?.version ?? null,
            }),
          },
        );
        const candidateId = reserved.candidateId;
        setPhotoDraft((current) => ({
          ...current,
          candidateId,
          submissionId: submissionId.current,
          uploaded: false,
          needsCleanup: false,
        }));
        const controller = new AbortController();
        photoAbort.current = controller;
        setPhotoProgress(0);
        try {
          await uploadPhoto(
            candidateId,
            activePhoto.localUri,
            setPhotoProgress,
            controller.signal,
          );
          setPhotoDraft((current) => ({
            ...current,
            candidateId,
            submissionId: submissionId.current,
            uploaded: true,
            needsCleanup: false,
          }));
          return candidateId;
        } catch (cause) {
          try {
            await photoRequest(
              `/v1/photos/candidates/${encodeURIComponent(candidateId)}`,
              { method: 'DELETE' },
            );
            setPhotoDraft((current) => ({
              ...current,
              candidateId: undefined,
              uploaded: false,
              needsCleanup: false,
            }));
          } catch (cleanupErr) {
            const msg = cleanupErr instanceof Error ? cleanupErr.message : '';
            if (/مبقتش متاحة|اتغيّرت/.test(msg)) {
              setPhotoDraft((current) => ({
                ...current,
                candidateId: undefined,
                uploaded: false,
                needsCleanup: false,
              }));
            } else {
              setPhotoDraft((current) => ({
                ...current,
                candidateId,
                needsCleanup: true,
                uploaded: false,
              }));
            }
          }
          throw cause;
        } finally {
          photoAbort.current = null;
          setPhotoProgress(undefined);
        }
      };

      let reusedUploadedCandidate = false;
      if (activePhoto.action === 'replace') {
        try {
          const canReuse = Boolean(
            activePhoto.candidateId &&
            activePhoto.uploaded &&
            !activePhoto.needsCleanup &&
            activePhoto.submissionId === submissionId.current,
          );
          if (activePhoto.candidateId && !canReuse) {
            await photoRequest(
              `/v1/photos/candidates/${encodeURIComponent(activePhoto.candidateId)}`,
              { method: 'DELETE' },
            ).catch(() => {});
            setPhotoDraft((current) => ({
              ...current,
              candidateId: undefined,
              uploaded: false,
              needsCleanup: false,
            }));
          }
          reusedUploadedCandidate = canReuse;
          const candidateId = await stageReplacementPhoto(
            canReuse ? activePhoto.candidateId : undefined,
          );
          normalized.photoChange = {
            action: 'replace',
            candidateId,
            ...(adminDirect
              ? { expectedPhotoVersion: listing?.placePhoto?.version ?? null }
              : {}),
          };
        } catch (photoError) {
          setPhotoSubmitFailed(true);
          throw photoError;
        }
      } else if (activePhoto.action === 'remove')
        normalized.photoChange = {
          action: 'remove',
          expectedPhotoVersion: listing?.placePhoto?.version ?? null,
        };

      const commitSubmission = async () => {
        if (adminDirect) {
          if (!saveAdminService)
            throw new Error('الخطوة دي متاحة لمشرف الدليل بس.');
          return saveAdminService(
            normalized,
            listing?.id ?? draftProviderId,
            submissionId.current,
          );
        }
        return submit(
          normalized,
          listing?.id ?? draftProviderId,
          false,
          consent,
          submissionId.current,
        );
      };

      let providerId: string;
      try {
        providerId = await commitSubmission();
      } catch (commitError) {
        const msg = commitError instanceof Error ? commitError.message : '';
        if (
          activePhoto.action === 'replace' &&
          reusedUploadedCandidate &&
          /مبقتش متاحة|حالة الصورة اتغيّرت|غير متاح|صلاحيات|permission/i.test(
            msg,
          )
        ) {
          if (normalized.photoChange?.candidateId) {
            await photoRequest(
              `/v1/photos/candidates/${encodeURIComponent(normalized.photoChange.candidateId)}`,
              { method: 'DELETE' },
            ).catch(() => {});
          }
          try {
            const freshCandidateId = await stageReplacementPhoto(undefined);
            normalized.photoChange = {
              action: 'replace',
              candidateId: freshCandidateId,
              ...(adminDirect
                ? { expectedPhotoVersion: listing?.placePhoto?.version ?? null }
                : {}),
            };
          } catch (reuploadError) {
            setPhotoSubmitFailed(true);
            throw reuploadError;
          }
          providerId = await commitSubmission();
        } else {
          if (activePhoto.action === 'replace' && adminDirect) {
            setPhotoSubmitFailed(true);
          }
          throw commitError;
        }
      }
      try {
        await clearDraft();
      } catch {
        feedback.show(
          adminDirect ? 'تم حفظ الخدمة' : 'طلبك اتبعت',
          'بس مش قادرين نمسح المسودة من الجهاز دلوقتي.',
        );
      }
      completedRef.current = true;
      draftCleared.current = true;
      setCompleted(true);
      disablePrevention();
      if (adminDirect) {
        const isEditing = Boolean(listing || draftProviderId);
        feedback.show(
          isEditing ? 'تم حفظ التعديلات' : 'تم نشر الخدمة',
          isEditing
            ? 'بيانات الخدمة اتحدثت مباشرة.'
            : 'الخدمة بقت ظاهرة دلوقتي في الدليل العام.',
        );
        // Deferring navigation lets the unsaved-changes guard observe completion.
        setTimeout(() => {
          if (onAdminComplete) onAdminComplete(providerId);
          else
            router.replace({
              pathname: '/admin/service/[id]',
              params: { id: providerId },
            });
        }, 0);
      } else {
        // Deferring navigation lets the unsaved-changes guard observe completion.
        setTimeout(
          () =>
            router.replace({
              pathname: '/provider/success',
              params: { providerId },
            }),
          0,
        );
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'مش قادرين نبعت الطلب. جرّب تاني.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const continueWithoutPhoto = async () => {
    if (busy || submitting.current) return;
    setPhotoSubmitFailed(false);
    setSubmitError('');
    if (photoDraft.candidateId) {
      await photoRequest(
        `/v1/photos/candidates/${encodeURIComponent(photoDraft.candidateId)}`,
        { method: 'DELETE' },
      ).catch(() => {});
    }
    deleteDraftPhoto(photoDraft.localUri);
    const nextPhoto: PhotoDraft = { action: 'keep' };
    setPhotoDraft(nextPhoto);
    if (
      listing &&
      listing.publicationStatus !== 'unpublished' &&
      listing.status === 'approved' &&
      changedFields(initial, effectiveValues).length === 0
    ) {
      setSubmitError('مفيش تعديلات نصية لإرسالها من غير الصورة.');
      return;
    }
    if (reviewing && (consent || adminDirect)) await send(nextPhoto);
  };
  const next = () => {
    if (step === 2 && !reviewing && hoursPending) {
      focusRequested.current = true;
      setErrors({
        weeklyHours:
          'طبّق المواعيد الجديدة أو احتفظ بالمواعيد الحالية قبل المراجعة.',
      });
      return;
    }
    const effectiveConsent = adminDirect ? true : consent;
    const basicErrors = validateService(effectiveValues, 1, effectiveConsent);
    const validation =
      step === 1
        ? basicErrors
        : {
            ...basicErrors,
            ...validateService(
              effectiveValues,
              2,
              reviewing ? effectiveConsent : true,
            ),
          };
    focusRequested.current = true;
    setErrors(validation);
    if (Object.keys(validation).length) {
      if (reviewing && Object.keys(validation).some((key) => key !== 'consent'))
        setReviewing(false);
      if (Object.keys(basicErrors).length) {
        setReviewing(false);
        setStep(1);
      }
      return;
    }
    Keyboard.dismiss();
    if (step === 1 && !returnToReview) {
      setStep(2);
      return;
    }
    if (!reviewing) {
      const remainingErrors = validateService(effectiveValues, 2, true);
      if (Object.keys(remainingErrors).length) {
        focusRequested.current = true;
        setErrors(remainingErrors);
        setStep(2);
        return;
      }
      setStep(2);
      setReviewing(true);
      setReturnToReview(false);
      return;
    }
    if (!adminDirect && listing?.pendingChanges)
      feedback.show(
        'تحديث التعديلات المرسلة؟',
        'التعديلات دي هتحل محل الاقتراح السابق، والخدمة المنشورة هتفضل زي ما هي.',
        [
          { text: 'رجوع', style: 'cancel' },
          { text: 'تحديث وإرسال', onPress: () => void send() },
        ],
      );
    else if (!adminDirect && listing?.photoReviewStatus === 'pending')
      feedback.show(
        'إرسال طلب جديد؟',
        'في صورة قيد المراجعة حاليًا. إرسال طلب تعديل جديد هيلغي مراجعة الصورة الحالية وتحتاج ترفعها مع الطلب الجديد.',
        [
          { text: 'رجوع', style: 'cancel' },
          { text: 'إرسال الطلب', onPress: () => void send() },
        ],
      );
    else void send();
  };
  const back = () => {
    if (!busy) {
      if (reviewing) {
        setReviewing(false);
        setReturnToReview(false);
        setConsent(false);
      } else if (step === 2) {
        setHoursPending(false);
        setStep(1);
      } else router.back();
    }
  };
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (submitting.current) return true;
          if (reviewing) {
            setReviewing(false);
            setReturnToReview(false);
            setConsent(false);
            return true;
          }
          if (step === 2) {
            setHoursPending(false);
            setStep(1);
            return true;
          }
          return false;
        },
      );
      return () => subscription.remove();
    }, [step, reviewing]),
  );
  const updateAvailability = (availability: Availability) => {
    setValues((current) => ({ ...current, ...availability }));
    setErrors((current) => ({
      ...current,
      serviceMode: undefined,
      weeklyHours: undefined,
    }));
  };
  const selectedCategory = categories.find(
    (category) => category.id === values.categoryId,
  );
  const selectedCategoryImage = selectedCategory
    ? categoryImages[selectedCategory.id]
    : undefined;
  const selectedCategoryExample = selectedCategory
    ? serviceExamples[selectedCategory.id]
    : undefined;
  const photoFieldNode = (
    <PhotoField
      value={photoDraft}
      onChange={async (next) => {
        setPhotoSubmitFailed(false);
        setSubmitError('');
        if (photoDraft.candidateId)
          await photoRequest(
            `/v1/photos/candidates/${encodeURIComponent(photoDraft.candidateId)}`,
            { method: 'DELETE' },
          ).catch(() => {});
        if (photoDraft.localUri && photoDraft.localUri !== next.localUri)
          deleteDraftPhoto(photoDraft.localUri);
        submissionId.current ??= allocateSubmissionId?.();
        setPhotoDraft({ ...next, submissionId: submissionId.current });
      }}
      approvedUrl={listing?.placePhoto?.detailUrl}
      pendingPhotoReview={
        !adminDirect && listing?.photoReviewStatus === 'pending'
      }
      disabled={busy || offlineDraftOnly}
      progress={photoProgress}
      onCancel={() => photoAbort.current?.abort()}
    />
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          disabled={busy}
          onPress={back}
          style={styles.back}
        >
          <MaterialCommunityIcons
            name="arrow-right"
            size={24}
            color={colors.primaryDark}
            accessibilityElementsHidden
          />
        </Pressable>
        <Text style={[styles.heading, styles.headerTitle]}>
          {reviewing
            ? 'مراجعة البيانات'
            : listing
              ? 'تعديل الخدمة'
              : 'إضافة خدمة'}
        </Text>
        <View style={styles.headerSpacer} accessibilityElementsHidden />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <MotionReveal
          changeKey={reviewing ? 'review' : step}
          slide={(step === 2 ? 6 : -6) * (I18nManager.isRTL ? -1 : 1)}
          style={styles.flex}
        >
          <ScrollView
            ref={scrollRef}
            key={reviewing ? 'review' : step}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {!reviewing ? (
              <View style={styles.stepperCard}>
                <View style={styles.stepRow}>
                  <View style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepCircle,
                        step === 1
                          ? { backgroundColor: colors.actionBackground }
                          : {
                              backgroundColor: colors.publishedBackground,
                              borderColor: colors.success,
                              borderWidth: 1,
                            },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepNumber,
                          step === 1
                            ? { color: colors.onPrimary }
                            : { color: colors.success },
                        ]}
                      >
                        {(1).toLocaleString('ar-EG')}
                      </Text>
                    </View>
                    <View style={styles.stepLabelRow}>
                      {step > 1 ? (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={14}
                          color={colors.success}
                          accessibilityElementsHidden
                        />
                      ) : null}
                      <Text
                        accessibilityRole={step === 1 ? 'header' : undefined}
                        style={[
                          styles.stepLabel,
                          step === 1
                            ? { color: colors.primaryDark }
                            : { color: colors.success },
                        ]}
                      >
                        بيانات الخدمة
                      </Text>
                    </View>
                  </View>
                  <View
                    accessibilityElementsHidden
                    style={[
                      styles.stepConnector,
                      {
                        backgroundColor:
                          step === 2 ? colors.actionBackground : colors.border,
                      },
                    ]}
                  />
                  <View style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepCircle,
                        step === 2 && {
                          backgroundColor: colors.actionBackground,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stepNumber,
                          step === 2 && { color: colors.onPrimary },
                        ]}
                      >
                        {(2).toLocaleString('ar-EG')}
                      </Text>
                    </View>
                    <Text
                      accessibilityRole={step === 2 ? 'header' : undefined}
                      style={[
                        styles.stepLabel,
                        step === 2 && { color: colors.primaryDark },
                      ]}
                    >
                      التواصل والمكان
                    </Text>
                  </View>
                </View>
                <View
                  accessible
                  accessibilityLabel="تقدم إضافة الخدمة"
                  accessibilityRole="progressbar"
                  accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: step === 1 ? 50 : 100,
                  }}
                  style={styles.progress}
                >
                  <View
                    style={[
                      styles.progressFill,
                      { width: step === 1 ? '50%' : '100%' },
                    ]}
                  />
                </View>
              </View>
            ) : null}
            {draftStatus ? (
              <Text accessibilityLiveRegion="polite" style={styles.hint}>
                {draftStatus}
              </Text>
            ) : null}
            {draftStorageError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {draftStorageError}
              </Text>
            ) : null}
            {offlineDraftOnly && onRefreshDraft ? (
              <ProviderAction
                secondary
                title="تحديث بيانات حسابك قبل الإرسال"
                onPress={onRefreshDraft}
              />
            ) : null}
            {offlineDraftOnly ? (
              <Text style={styles.body}>
                بتعدّل مسودة على الجهاز. حدّث بيانات حسابك بعد رجوع الإنترنت قبل
                الإرسال.
              </Text>
            ) : null}
            {adminDirect && hasPendingRequest ? (
              <Text style={styles.notice}>
                تنبيه: في طلب تعديل معلّق للخدمة دي. حفظ التعديلات هنا هيحدّث
                الخدمة مباشرة ويرفض الطلب المعلّق.
              </Text>
            ) : null}
            {listing?.publicationStatus === 'unpublished' ? (
              <Text style={styles.body}>
                {adminDirect
                  ? `الخدمة في الأرشيف ومخفية من الدليل${listing.unpublishReason ? ` (${listing.unpublishReason})` : ''}. حفظ التعديلات هنا هيحدّث بياناتها في الأرشيف مع الاحتفاظ بصاحبها الأصلي.`
                  : `سبب إخفاء خدمتك: ${listing.unpublishReason ?? 'تواصل مع الدعم لمعرفة السبب.'} صحّح البيانات وابعتها للمراجعة. الخدمة مش هترجع للدليل قبل الموافقة.`}
              </Text>
            ) : null}
            {step === 1 && !reviewing ? (
              <View
                style={[
                  styles.heroBanner,
                  { backgroundColor: isDark ? '#203D50' : '#E4F0F8' },
                ]}
              >
                <View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={StyleSheet.absoluteFill}
                >
                  <Svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 400 140"
                    preserveAspectRatio="none"
                    accessible={false}
                  >
                    <Path
                      d="M0 100Q95 84 205 118T400 96V140H0Z"
                      fill={isDark ? '#2F556D' : '#CBE0F0'}
                      opacity={0.75}
                    />
                  </Svg>
                </View>
                <View
                  style={[styles.heroRow, compactBanner && styles.heroStacked]}
                >
                  <View style={styles.heroCopy}>
                    <View
                      pointerEvents="none"
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={[
                        styles.heroPill,
                        { backgroundColor: colors.surface },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="handshake-outline"
                        size={16}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                      <Text style={styles.heroPillText}>
                        خطوتين بس وتظهر لأهل البلد
                      </Text>
                    </View>
                    <Text style={styles.heroTitle}>
                      أهلًا بيك في دليل أهل منشأة العمار
                    </Text>
                    <Text style={styles.heroSubtitle}>
                      عرّف أهل البلد بخدمتك وسهّل عليهم الوصول ليك والتواصل
                      معاك.
                    </Text>
                  </View>
                  <AddServiceArtwork variant="step1" style={styles.heroArt} />
                </View>
              </View>
            ) : null}
            {adminDirect &&
            listing &&
            listing.publicationStatus !== 'unpublished' ? (
              <Text style={styles.notice}>
                التعديلات هتتحفظ وتظهر مباشرة مع الاحتفاظ بصاحب الخدمة الأصلي.
              </Text>
            ) : !adminDirect &&
              listing?.status === 'approved' &&
              listing.publicationStatus !== 'unpublished' ? (
              <Text style={styles.notice}>
                التعديلات الجديدة هتظهر بعد مراجعتها، وخدمتك الحالية هتفضل
                منشورة.
              </Text>
            ) : null}
            {reviewing ? (
              <>
                {photoProgress !== undefined ? photoFieldNode : null}
                <ServiceReview
                  values={effectiveValues}
                  categoryName={selectedCategory?.name}
                  categoryIcon={selectedCategory?.icon}
                  photoDraft={photoDraft}
                  hasApprovedPhoto={Boolean(listing?.placePhoto)}
                  approvedPhotoUrl={listing?.placePhoto?.detailUrl}
                  onEdit={(target) => {
                    setReviewing(false);
                    setReturnToReview(true);
                    setConsent(false);
                    setStep(target);
                  }}
                />
              </>
            ) : step === 1 ? (
              <>
                <View
                  style={styles.formPanel}
                  onLayout={(event) => {
                    step1PanelY.current = event.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeading}>
                    <View
                      pointerEvents="none"
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={styles.sectionIconBox}
                    >
                      <MaterialCommunityIcons
                        name="storefront-outline"
                        size={24}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                    </View>
                    <View style={styles.sectionCopy}>
                      <Text style={styles.panelTitle}>تعريف الخدمة</Text>
                      <Text style={styles.body}>
                        الاسم والمجال اللي هيظهروا في البحث
                      </Text>
                    </View>
                  </View>
                  {!listing && Platform.OS !== 'web' ? (
                    <ProviderAction
                      secondary
                      title={
                        importBusy
                          ? 'بنفتح جهات الاتصال…'
                          : 'استيراد من جهات الاتصال'
                      }
                      disabled={busy || importBusy}
                      onPress={() => void importContact()}
                    />
                  ) : null}
                  <FormField
                    label="الاسم اللي هيظهر للناس *"
                    inputRef={(node) => {
                      fieldRefs.current.name = node;
                    }}
                    onFieldLayout={(event) => {
                      fieldY.current.name =
                        step1PanelY.current + event.nativeEvent.layout.y;
                    }}
                    value={values.name}
                    onChangeText={(value) => update('name', value)}
                    placeholder="مثال: أحمد محمود"
                    error={errors.name}
                    editable={!busy}
                    maxLength={100}
                  />
                  <View
                    style={styles.fieldGroup}
                    onLayout={(event) => {
                      fieldY.current.categoryId =
                        step1PanelY.current + event.nativeEvent.layout.y;
                    }}
                  >
                    <Text style={styles.label}>نوع الخدمة أو المجال *</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="اختيار نوع الخدمة"
                      onPress={() => setCategoryOpen(!categoryOpen)}
                      style={[
                        styles.selector,
                        {
                          borderColor: errors.categoryId
                            ? colors.error
                            : selectedCategory
                              ? colors.primary
                              : colors.inputBorder,
                          backgroundColor: selectedCategory
                            ? colors.surfaceLow
                            : colors.inputBackground,
                        },
                      ]}
                      disabled={busy}
                    >
                      {selectedCategory ? (
                        <CategoryIcon icon={selectedCategory.icon} />
                      ) : (
                        <View
                          pointerEvents="none"
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                          style={styles.selectorPlaceholderIcon}
                        >
                          <MaterialCommunityIcons
                            name="shape-outline"
                            size={22}
                            color={colors.primaryDark}
                            accessibilityElementsHidden
                          />
                        </View>
                      )}
                      <Text
                        style={[
                          styles.selectorText,
                          selectedCategory ? styles.label : styles.body,
                        ]}
                      >
                        {selectedCategory?.name ?? 'اختار نوع الخدمة'}
                      </Text>
                      <MaterialCommunityIcons
                        name="chevron-down"
                        size={24}
                        color={colors.muted}
                        accessibilityElementsHidden
                      />
                    </Pressable>
                    {selectedCategory ? (
                      <View style={styles.categoryPreviewCard}>
                        {selectedCategoryImage ? (
                          <Image
                            source={selectedCategoryImage}
                            accessible={false}
                            style={styles.categoryThumb}
                            resizeMode="cover"
                          />
                        ) : null}
                        <View style={styles.categoryPreviewCopy}>
                          <Text style={styles.categoryPreviewDesc}>
                            {selectedCategory.description}
                          </Text>
                          {selectedCategoryExample ? (
                            <Text style={styles.hint}>
                              مثال للتخصص: {selectedCategoryExample.title}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                    {errors.categoryId ? (
                      <Text style={styles.error}>{errors.categoryId}</Text>
                    ) : null}
                  </View>
                  <FormField
                    label="تخصصك أو اسم مختصر لخدمتك *"
                    inputRef={(node) => {
                      fieldRefs.current.serviceTitle = node;
                    }}
                    onFieldLayout={(event) => {
                      fieldY.current.serviceTitle =
                        step1PanelY.current + event.nativeEvent.layout.y;
                    }}
                    value={values.serviceTitle}
                    onChangeText={(value) => update('serviceTitle', value)}
                    placeholder={
                      selectedCategoryExample
                        ? `مثال: ${selectedCategoryExample.title}`
                        : 'اكتب تخصصك أو اسم مختصر لخدمتك'
                    }
                    error={errors.serviceTitle}
                    editable={!busy}
                    maxLength={160}
                  />
                  <View style={styles.fieldGroup}>
                    <FormField
                      label="نبذة عن الخدمة (اختياري)"
                      value={values.description}
                      onChangeText={(value) => update('description', value)}
                      placeholder={
                        selectedCategoryExample?.description ??
                        'اكتب تفاصيل بسيطة وسريعة عن شغلك وخبرتك...'
                      }
                      multiline
                      editable={!busy}
                      maxLength={2000}
                    />
                    <Text style={styles.hint}>
                      {values.description.length} / ٢٠٠٠
                    </Text>
                  </View>
                </View>
                <View style={styles.reviewNote}>
                  <View
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={styles.sectionIconBox}
                  >
                    <MaterialCommunityIcons
                      name="shield-check-outline"
                      size={24}
                      color={colors.primaryDark}
                      accessibilityElementsHidden
                    />
                  </View>
                  <View style={styles.sectionCopy}>
                    <Text style={styles.label}>
                      {adminDirect
                        ? 'نشر مباشر بصلاحية المشرف'
                        : 'إضافة خدمتك مجانية'}
                    </Text>
                    <Text style={styles.body}>
                      {adminDirect
                        ? 'الخدمة هتتنشر أو تتحدث فورًا في الدليل من غير حد أقصى للعدد.'
                        : 'هنراجع بيانات خدمتك الأول، وبعد الموافقة هتظهر في الدليل.'}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View
                  style={[
                    styles.heroBanner,
                    { backgroundColor: isDark ? '#203D50' : '#E4F0F8' },
                  ]}
                >
                  <View
                    pointerEvents="none"
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    style={StyleSheet.absoluteFill}
                  >
                    <Svg
                      width="100%"
                      height="100%"
                      viewBox="0 0 400 140"
                      preserveAspectRatio="none"
                      accessible={false}
                    >
                      <Path
                        d="M0 100Q110 120 220 92T400 108V140H0Z"
                        fill={isDark ? '#2F556D' : '#CBE0F0'}
                        opacity={0.75}
                      />
                    </Svg>
                  </View>
                  <View
                    style={[
                      styles.heroRow,
                      compactBanner && styles.heroStacked,
                    ]}
                  >
                    <View style={styles.heroCopy}>
                      <Text style={styles.heroTitle}>إزاي الناس توصل ليك؟</Text>
                      <Text style={styles.heroSubtitle}>
                        ضيف رقمك ومكانك داخل منشأة العمار عشان العميل يكلمك أو
                        يزورك بسهولة.
                      </Text>
                    </View>
                    <AddServiceArtwork variant="step2" style={styles.heroArt} />
                  </View>
                </View>
                <View
                  style={styles.formPanel}
                  onLayout={(event) => {
                    fieldY.current.phone = event.nativeEvent.layout.y;
                    fieldY.current.whatsapp = event.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeading}>
                    <View
                      pointerEvents="none"
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={styles.sectionIconBox}
                    >
                      <MaterialCommunityIcons
                        name="phone-outline"
                        size={24}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                    </View>
                    <View style={styles.sectionCopy}>
                      <Text style={styles.heading}>بيانات التواصل</Text>
                      <Text style={styles.body}>
                        طرق وصول أهالي البلد لخدمتك بسهولة
                      </Text>
                    </View>
                  </View>
                  <FormField
                    label="رقم التواصل *"
                    inputRef={(node) => {
                      fieldRefs.current.phone = node;
                    }}
                    value={values.phone}
                    onChangeText={(value) => update('phone', value)}
                    placeholder="01012345678"
                    phone
                    keyboardType="phone-pad"
                    error={errors.phone}
                    editable={!busy}
                  />
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{
                      checked: sameNumber && canUseSameNumber,
                    }}
                    onPress={() => setSameNumber(!sameNumber)}
                    disabled={busy || !canUseSameNumber}
                    style={styles.check}
                  >
                    <MaterialCommunityIcons
                      name={
                        sameNumber
                          ? 'checkbox-marked'
                          : 'checkbox-blank-outline'
                      }
                      size={26}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.body}>
                      رقم الواتساب هو نفس رقم التواصل
                    </Text>
                  </Pressable>
                  {!sameNumber || !canUseSameNumber ? (
                    <FormField
                      label="رقم واتساب (اختياري)"
                      inputRef={(node) => {
                        fieldRefs.current.whatsapp = node;
                      }}
                      value={values.whatsapp}
                      onChangeText={(value) => update('whatsapp', value)}
                      placeholder="01012345678"
                      phone
                      keyboardType="phone-pad"
                      error={errors.whatsapp}
                      editable={!busy}
                    />
                  ) : null}
                </View>
                <View
                  style={styles.formPanel}
                  onLayout={(event) => {
                    fieldY.current.serviceMode = event.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeading}>
                    <View
                      pointerEvents="none"
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={styles.sectionIconBox}
                    >
                      <MaterialCommunityIcons
                        name="briefcase-outline"
                        size={24}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                    </View>
                    <View style={styles.sectionCopy}>
                      <Text style={styles.panelTitle}>أسلوب العمل</Text>
                      <Text style={styles.body}>
                        هل عندك مكان ولا بتروح للعميل
                      </Text>
                    </View>
                  </View>
                  <AvailabilityFields
                    section="service"
                    value={values}
                    disabled={busy}
                    errors={errors}
                    onChange={updateAvailability}
                  />
                </View>
                <View
                  style={styles.formPanel}
                  onLayout={(event) => {
                    fieldY.current.address = event.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeading}>
                    <View
                      pointerEvents="none"
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={styles.sectionIconBox}
                    >
                      <MaterialCommunityIcons
                        name="map-marker-outline"
                        size={24}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                    </View>
                    <View style={styles.sectionCopy}>
                      <Text style={styles.heading}>الموقع داخل البلد</Text>
                      <Text style={styles.body}>
                        اكتب عنوانك عشان الناس توصلّك بسهولة
                      </Text>
                    </View>
                  </View>
                  <FormField
                    label={
                      values.serviceMode === 'mobile'
                        ? 'عنوان عام أو علامة مميزة (اختياري)'
                        : 'العنوان بالتفصيل أو علامة مميزة *'
                    }
                    inputRef={(node) => {
                      fieldRefs.current.address = node;
                    }}
                    value={values.address}
                    onChangeText={(value) => update('address', value)}
                    placeholder="مثال: شارع المدرسة، جنب المسجد الكبير"
                    multiline
                    error={errors.address}
                    editable={!busy}
                    maxLength={500}
                  />
                </View>
                {photoFieldNode}
                <View
                  style={styles.formPanel}
                  onLayout={(event) => {
                    fieldY.current.weeklyHours = event.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeading}>
                    <View
                      pointerEvents="none"
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      style={styles.sectionIconBox}
                    >
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={24}
                        color={colors.primaryDark}
                        accessibilityElementsHidden
                      />
                    </View>
                    <View style={styles.sectionCopy}>
                      <Text style={styles.panelTitle}>أوقات التواجد</Text>
                      <Text style={styles.body}>
                        اختياري — ساعد الناس تعرف إمتى تكون متاح
                      </Text>
                    </View>
                  </View>
                  <AvailabilityFields
                    section="hours"
                    onPendingHoursChange={setHoursPending}
                    value={values}
                    disabled={busy}
                    errors={errors}
                    onChange={updateAvailability}
                  />
                </View>
                {values.serviceMode === 'mobile' ? (
                  <Text style={styles.hint}>
                    لو بتروح للعميل، عنوانك اختياري. بلاش تكتب عنوان بيتك الخاص؛
                    البيانات دي هتظهر للناس.
                  </Text>
                ) : null}
              </>
            )}
            {reviewing ? (
              adminDirect ? (
                <View style={styles.formPanel}>
                  <Text style={styles.body}>
                    {listing || draftProviderId
                      ? 'هيتم حفظ التعديلات مباشرة مع الاحتفاظ بصاحب الخدمة الأصلي.'
                      : 'هيتم نشر الخدمة مباشرة في الدليل العام بدون حد أقصى للعدد.'}
                  </Text>
                </View>
              ) : (
                <View style={styles.formPanel}>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: consent }}
                    onPress={() => {
                      setConsent(!consent);
                      setErrors((current) => ({
                        ...current,
                        consent: undefined,
                      }));
                    }}
                    disabled={busy || !canUseSameNumber}
                    style={styles.check}
                  >
                    <MaterialCommunityIcons
                      name={
                        consent ? 'checkbox-marked' : 'checkbox-blank-outline'
                      }
                      size={26}
                      color={colors.primaryDark}
                    />
                    <Text style={styles.body}>
                      أوافق على عرض اسمي وبيانات التواصل والعنوان داخل التطبيق
                      بعد مراجعة الطلب.
                    </Text>
                  </Pressable>
                  {errors.consent ? (
                    <Text style={styles.error}>{errors.consent}</Text>
                  ) : null}
                </View>
              )
            ) : null}
            {submitError ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {submitError}
              </Text>
            ) : null}
            {photoSubmitFailed && photoDraft.action === 'replace' ? (
              <View style={styles.photoRecovery}>
                <ProviderAction
                  title="إعادة محاولة رفع الصورة"
                  disabled={busy}
                  onPress={() => void send()}
                />
                <ProviderAction
                  secondary
                  title="كمّل وابعت من غير صورة"
                  disabled={busy}
                  onPress={() => void continueWithoutPhoto()}
                />
              </View>
            ) : null}
          </ScrollView>
          <View style={styles.actionBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                busy
                  ? adminDirect
                    ? 'جارٍ حفظ الخدمة...'
                    : 'جارٍ إرسال الطلب...'
                  : step === 1
                    ? returnToReview
                      ? 'العودة للمراجعة'
                      : 'التالي: بيانات التواصل والمكان'
                    : reviewing
                      ? adminDirect
                        ? listing || draftProviderId
                          ? 'حفظ التعديلات الآن'
                          : 'نشر الخدمة الآن'
                        : 'إرسال الطلب للمراجعة'
                      : 'مراجعة البيانات'
              }
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={next}
              style={[
                styles.primary,
                styles.mainAction,
                busy && styles.disabled,
              ]}
            >
              {busy ? (
                <ActivityIndicator
                  color={colors.onPrimary}
                  accessibilityLabel="جاري حفظ الطلب"
                />
              ) : null}
              <Text accessibilityLiveRegion="polite" style={styles.primaryText}>
                {busy
                  ? adminDirect
                    ? 'جارٍ حفظ الخدمة...'
                    : 'جارٍ إرسال الطلب...'
                  : step === 1
                    ? returnToReview
                      ? 'العودة للمراجعة'
                      : 'التالي'
                    : reviewing
                      ? adminDirect
                        ? listing || draftProviderId
                          ? 'حفظ التعديلات الآن'
                          : 'نشر الخدمة الآن'
                        : 'إرسال الطلب للمراجعة'
                      : 'مراجعة البيانات'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={back}
              style={[styles.secondary, styles.backAction]}
            >
              <Text style={styles.label}>
                {reviewing ? 'السابق' : step === 1 ? 'إلغاء' : 'السابق'}
              </Text>
            </Pressable>
          </View>
        </MotionReveal>
      </KeyboardAvoidingView>
      <CategorySelectionSheet
        visible={categoryOpen}
        categories={categories}
        selected={values.categoryId}
        onSelect={(id) => update('categoryId', id)}
        onClose={() => setCategoryOpen(false)}
      />
    </SafeAreaView>
  );
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    stepperCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    stepItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
    stepCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumber: { ...typography.label, color: colors.muted },
    stepLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    stepLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'center',
    },
    stepConnector: {
      width: 28,
      height: 2,
      borderRadius: 1,
      marginBottom: 18,
    },
    mainAction: { flex: 1 },
    backAction: { maxWidth: '28%' },
    actionBar: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.sm,
      backgroundColor: colors.header,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    back: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.surfaceLow,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
    },
    headerSpacer: { width: 48, height: 48 },
    content: {
      padding: spacing.md,
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },
    heading: {
      ...typography.screenTitle,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    panelTitle: {
      ...typography.sectionTitle,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    label: {
      ...typography.label,
      color: colors.textPrimary,
      writingDirection: 'rtl',
    },
    body: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    notice: {
      ...typography.caption,
      color: colors.textSecondary,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.secondary,
      writingDirection: 'rtl',
    },
    progress: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.surfaceContainer,
      overflow: 'hidden',
    },
    progressFill: { height: 8, backgroundColor: colors.actionBackground },
    fieldGroup: { gap: spacing.sm },
    selector: {
      padding: 12,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      minHeight: 64,
    },
    selectorPlaceholderIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectorText: {
      flex: 1,
      minWidth: 0,
      textAlign: 'auto',
    },
    categoryPreviewCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: 16,
      backgroundColor: colors.surfaceLow,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryThumb: {
      width: 68,
      height: 68,
      borderRadius: 14,
      backgroundColor: colors.surfaceContainer,
    },
    categoryPreviewCopy: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    categoryPreviewDesc: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    check: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      backgroundColor: colors.surfaceContainer,
      borderRadius: 16,
      minHeight: 56,
    },
    heroBanner: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      overflow: 'hidden',
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    heroStacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    heroCopy: {
      flex: 1,
      minWidth: 0,
      gap: 8,
    },
    heroPill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroPillText: {
      ...typography.caption,
      color: colors.primaryDark,
      writingDirection: 'rtl',
    },
    heroTitle: {
      ...typography.title,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    heroSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    heroArt: {
      alignSelf: 'center',
    },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sectionIconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    sectionCopy: { flex: 1, minWidth: 0, gap: 4 },
    formPanel: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 16,
      gap: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reviewNote: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    hint: {
      ...typography.caption,
      color: colors.muted,
      textAlign: 'auto',
      writingDirection: 'rtl',
    },
    white: { color: colors.onPrimary },
    error: {
      ...typography.caption,
      color: colors.error,
      writingDirection: 'rtl',
    },
    photoRecovery: { gap: spacing.xs },
    primary: {
      minHeight: 56,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.actionBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    primaryText: {
      ...typography.button,
      color: colors.onPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    secondary: {
      minHeight: 48,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: { opacity: 0.6 },
  });
