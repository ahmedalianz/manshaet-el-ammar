import type { Availability } from '../availability/types';
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
} from '../local/drafts';
import { AvailabilityFields } from '../availability/AvailabilityFields';
import { SERVICE_LIMIT_MESSAGE } from './serviceLimit';
import { useSupportActions } from '../support/useSupportActions';
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
  KeyboardAvoidingView,
  I18nManager,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Keyboard,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../../theme/spacing';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import { CategoryIcon } from '../discovery/components/DiscoveryUi';
import { useProviderState } from './ProviderContext';
import type { ProviderListing, ServiceValues } from './types';
import { FormField } from './FormField';
import { serviceExamples } from './serviceExamples';
import {
  normalizeMobile,
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
    coverageAreas: source.coverageAreas,
    weeklyHours: source.weeklyHours,
  };
}
export function ServiceForm({
  listing,
  proposal = false,
  draftProviderId,
  offlineDraftOnly = false,
  onRefreshDraft,
}: {
  listing?: ProviderListing;
  proposal?: boolean;
  draftProviderId?: string;
  offlineDraftOnly?: boolean;
  onRefreshDraft?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const feedback = useFeedback();
  const support = useSupportActions();
  const {
    userId,
    submit,
    categories: remoteCategories,
    allocateSubmissionId,
  } = useProviderState();
  const categories = remoteCategories ?? [];
  const submissionId = useRef<string | undefined>(undefined);
  const [initial] = useState(() => listingValues(listing, proposal));
  const [values, setValues] = useState(initial);
  const [step, setStep] = useState<1 | 2>(1);
  const [hoursPending, setHoursPending] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [returnToReview, setReturnToReview] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const fieldRefs = useRef<
    Partial<Record<keyof ServiceValues, ComponentRef<typeof TextInput> | null>>
  >({});
  const fieldY = useRef<Partial<Record<keyof ServiceValues, number>>>({});
  const focusRequested = useRef(false);
  const [sameNumber, setSameNumber] = useState(
    Boolean(
      initial.whatsapp &&
      normalizeMobile(initial.whatsapp) === normalizeMobile(initial.phone),
    ),
  );
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
        : [
            'phone',
            'whatsapp',
            'serviceMode',
            'coverageAreas',
            'address',
            'weeklyHours',
          ];
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
  const [completed, setCompleted] = useState(false);
  const submitting = useRef(false);
  const draftKey = listing?.id ?? draftProviderId ?? 'new';
  const baseRevision = useRef(listing?.updatedAt);
  const [draftStatus, setDraftStatus] = useState('');
  const [draftStorageError, setDraftStorageError] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const draftEnabled = useRef(false);
  const draftCleared = useRef(false);
  const epoch = useRef(userId ? draftEpoch(userId) : 0);
  const draftSnapshot = useRef({ values, step, sameNumber });
  useEffect(() => {
    draftSnapshot.current = { values, step, sameNumber };
  }, [values, step, sameNumber]);
  const flushDraft = useCallback(() => {
    if (
      !userId ||
      !draftEnabled.current ||
      draftCleared.current ||
      (JSON.stringify(draftSnapshot.current.values) ===
        JSON.stringify(initial) &&
        draftSnapshot.current.step === 1 &&
        !draftSnapshot.current.sameNumber)
    )
      return Promise.resolve();
    const writingVersion = JSON.stringify(draftSnapshot.current);
    return saveDraft(
      userId,
      draftKey,
      {
        ...draftSnapshot.current,
        baseRevision: listing?.updatedAt ?? baseRevision.current,
        savedAt: new Date().toISOString(),
      },
      epoch.current,
    )
      .then(() => {
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
  }, [userId, draftKey, listing?.updatedAt, initial]);
  const clearDraft = async () => {
    draftCleared.current = true;
    try {
      if (userId) await discardDraft(userId, draftKey);
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
    if (!userId) return;
    void readDraft(userId, draftKey)
      .then((draft) => {
        if (!active) return;
        if (!draft) {
          draftEnabled.current = true;
          return;
        }
        baseRevision.current = draft.baseRevision;
        const stale = Boolean(
          listing && draft.baseRevision !== listing.updatedAt,
        );
        feedback.show(
          stale ? 'الخدمة اتحدثت بعد المسودة' : 'نكمل المسودة؟',
          stale
            ? 'البيانات المنشورة اتغيرت. راجع الفرق قبل استعادة المسودة:\n' +
                changedFields(initial, draft.values)
                  .map(
                    (key) =>
                      `${fieldLabels[key]} — الحالي: ${fieldValue(initial, key)} / المسودة: ${fieldValue(draft.values, key)}`,
                  )
                  .join('\n')
            : 'في بيانات محفوظة على الجهاز تقدر تكملها.',
          [
            {
              text: 'حذف المسودة',
              style: 'destructive',
              onPress: () => {
                void discardDraft(userId, draftKey).catch(() =>
                  setDraftStorageError('مش قادرين نمسح المسودة. جرّب تاني.'),
                );
                draftEnabled.current = true;
              },
            },
            {
              text: 'استعادة المسودة',
              onPress: () => {
                setValues(draft.values);
                setStep(draft.step);
                setSameNumber(draft.sameNumber);
                setConsent(false);
                draftEnabled.current = true;
              },
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
  }, [userId, draftKey, listing, initial, feedback]);
  useEffect(() => {
    if (
      draftEnabled.current &&
      !draftCleared.current &&
      JSON.stringify(values) !== JSON.stringify(initial)
    )
      setDraftStatus('بنحفظ المسودة...');
    const timer = setTimeout(() => {
      void flushDraft().catch(() => {});
    }, 750);
    return () => clearTimeout(timer);
  }, [values, step, sameNumber, flushDraft, initial]);
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
    JSON.stringify(values) !== JSON.stringify(initial) ||
    consent ||
    sameNumber !==
      Boolean(
        initial.whatsapp &&
        normalizeMobile(initial.whatsapp) === normalizeMobile(initial.phone),
      );
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
  const update = (field: keyof ServiceValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };
  const effectiveValues = {
    ...values,
    // Coverage selection is no longer collected. Retain stored areas; new
    // visiting services use the existing village-wide backend value.
    ...((values.serviceMode === 'mobile' || values.serviceMode === 'both') &&
    !values.coverageAreas?.length
      ? { coverageAreas: ['all'] }
      : {}),
    whatsapp: sameNumber ? values.phone : values.whatsapp,
  };
  const send = async () => {
    if (offlineDraftOnly) {
      setSubmitError(
        'المسودة محفوظة للتعديل بس. حدّث بيانات حسابك بعد رجوع الإنترنت قبل الإرسال.',
      );
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setSubmitError('');
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
      const providerId = await submit(
        normalized,
        listing?.id ?? draftProviderId,
        false,
        consent,
        submissionId.current,
      );
      try {
        await clearDraft();
      } catch {
        feedback.show(
          'طلبك اتبعت',
          'بس مش قادرين نمسح المسودة من الجهاز. امسحها من مسودات الخدمات لما التخزين يشتغل.',
        );
      }
      setCompleted(true);
      disablePrevention();
      // Deferring navigation lets the unsaved-changes guard observe completion.
      setTimeout(
        () =>
          router.replace({
            pathname: '/provider/success',
            params: { providerId },
          }),
        0,
      );
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
  const next = () => {
    if (step === 2 && !reviewing && hoursPending) {
      focusRequested.current = true;
      setErrors({
        weeklyHours:
          'طبّق المواعيد الجديدة أو احتفظ بالمواعيد الحالية قبل المراجعة.',
      });
      return;
    }
    const basicErrors = validateService(effectiveValues, 1, consent);
    const validation =
      step === 1
        ? basicErrors
        : {
            ...basicErrors,
            ...validateService(effectiveValues, 2, reviewing ? consent : true),
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
    if (listing?.pendingChanges)
      feedback.show(
        'تحديث التعديلات المرسلة؟',
        'التعديلات دي هتحل محل الاقتراح السابق، والخدمة المنشورة هتفضل زي ما هي.',
        [
          { text: 'رجوع', style: 'cancel' },
          { text: 'تحديث وإرسال', onPress: () => void send() },
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
      coverageAreas: undefined,
      weeklyHours: undefined,
    }));
  };
  const selectedCategory = categories.find(
    (category) => category.id === values.categoryId,
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
          />
        </Pressable>
        <Text style={styles.heading}>
          {reviewing
            ? 'مراجعة البيانات'
            : listing
              ? 'تعديل الخدمة'
              : 'إضافة خدمة'}
        </Text>
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
              <>
                <View style={styles.stepHeading}>
                  {([1, 2] as const).map((number) => (
                    <View key={number} style={styles.stepItem}>
                      <View
                        style={[
                          styles.stepCircle,
                          number === step && {
                            backgroundColor: colors.actionBackground,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.stepNumber,
                            number === step && { color: colors.onPrimary },
                          ]}
                        >
                          {number.toLocaleString('ar-EG')}
                        </Text>
                      </View>
                      <Text
                        accessibilityRole={
                          number === step ? 'header' : undefined
                        }
                        style={[
                          styles.stepLabel,
                          number === step && { color: colors.primaryDark },
                        ]}
                      >
                        {number === 1 ? 'بيانات الخدمة' : 'التواصل والمكان'}
                      </Text>
                    </View>
                  ))}
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
              </>
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
            {listing?.publicationStatus === 'unpublished' ? (
              <Text style={styles.body}>
                سبب إخفاء خدمتك:{' '}
                {listing.unpublishReason ?? 'تواصل مع الدعم لمعرفة السبب.'} صحّح
                البيانات وابعتها للمراجعة. الخدمة مش هترجع للدليل قبل الموافقة.
              </Text>
            ) : null}
            {step === 1 && !reviewing ? (
              <View style={styles.welcome}>
                <View style={styles.sectionHeading}>
                  <MaterialCommunityIcons
                    name="handshake-outline"
                    size={30}
                    color={colors.primaryDark}
                    accessibilityElementsHidden
                  />
                  <Text style={styles.label}>
                    أهلًا بيك في دليل أهل منشأة العمار
                  </Text>
                </View>
                <Text style={styles.hint}>
                  عرّف أهل البلد بخدمتك وسهّل عليهم الوصول ليك والتواصل معاك.
                </Text>
              </View>
            ) : null}
            {listing?.status === 'approved' &&
            listing.publicationStatus !== 'unpublished' ? (
              <Text style={styles.notice}>
                التعديلات الجديدة هتظهر بعد مراجعتها، وخدمتك الحالية هتفضل
                منشورة.
              </Text>
            ) : null}
            {reviewing ? (
              <ServiceReview
                values={effectiveValues}
                categoryName={selectedCategory?.name}
                onEdit={(target) => {
                  setReviewing(false);
                  setReturnToReview(true);
                  setConsent(false);
                  setStep(target);
                }}
              />
            ) : step === 1 ? (
              <>
                <FormField
                  label="الاسم اللي هيظهر للناس *"
                  inputRef={(node) => {
                    fieldRefs.current.name = node;
                  }}
                  onFieldLayout={(event) => {
                    fieldY.current.name = event.nativeEvent.layout.y;
                  }}
                  value={values.name}
                  onChangeText={(value) => update('name', value)}
                  placeholder="مثال: أحمد محمود"
                  error={errors.name}
                  editable={!busy}
                  maxLength={100}
                />
                <Text style={styles.label}>نوع الخدمة أو المجال *</Text>
                <Pressable
                  accessibilityRole="button"
                  onLayout={(event) => {
                    fieldY.current.categoryId = event.nativeEvent.layout.y;
                  }}
                  accessibilityLabel="اختيار نوع الخدمة"
                  onPress={() => setCategoryOpen(!categoryOpen)}
                  style={styles.selector}
                  disabled={busy}
                >
                  {selectedCategory ? (
                    <CategoryIcon icon={selectedCategory.icon} />
                  ) : null}
                  <Text style={styles.body}>
                    {selectedCategory?.name ?? 'اختار نوع الخدمة'}
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={24}
                    color={colors.muted}
                  />
                </Pressable>
                {errors.categoryId ? (
                  <Text style={styles.error}>{errors.categoryId}</Text>
                ) : null}
                <FormField
                  label="تخصصك أو اسم مختصر لخدمتك *"
                  inputRef={(node) => {
                    fieldRefs.current.serviceTitle = node;
                  }}
                  onFieldLayout={(event) => {
                    fieldY.current.serviceTitle = event.nativeEvent.layout.y;
                  }}
                  value={values.serviceTitle}
                  onChangeText={(value) => update('serviceTitle', value)}
                  placeholder={
                    serviceExamples[values.categoryId]
                      ? `مثال: ${serviceExamples[values.categoryId].title}`
                      : 'اكتب تخصصك أو اسم مختصر لخدمتك'
                  }
                  error={errors.serviceTitle}
                  editable={!busy}
                  maxLength={160}
                />
                <FormField
                  label="نبذة عن الخدمة (اختياري)"
                  value={values.description}
                  onChangeText={(value) => update('description', value)}
                  placeholder={
                    serviceExamples[values.categoryId]?.description ??
                    'اكتب تفاصيل بسيطة وسريعة عن شغلك وخبرتك...'
                  }
                  multiline
                  editable={!busy}
                  maxLength={2000}
                />
                <Text style={styles.hint}>
                  {values.description.length} / ٢٠٠٠
                </Text>
                <View style={styles.reviewNote}>
                  <MaterialCommunityIcons
                    name="shield-check-outline"
                    size={28}
                    color={colors.primaryDark}
                    accessibilityElementsHidden
                  />
                  <View style={styles.sectionCopy}>
                    <Text style={styles.label}>إضافة خدمتك مجانية</Text>
                    <Text style={styles.body}>
                      هنراجع بيانات خدمتك الأول، وبعد الموافقة هتظهر في الدليل.
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <View
                  style={styles.formPanel}
                  onLayout={(event) => {
                    fieldY.current.phone = event.nativeEvent.layout.y;
                    fieldY.current.whatsapp = event.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.sectionHeading}>
                    <MaterialCommunityIcons
                      name="phone-outline"
                      size={28}
                      color={colors.primaryDark}
                      accessibilityElementsHidden
                    />
                    <View style={styles.sectionCopy}>
                      <Text style={styles.heading}>بيانات التواصل</Text>
                      <Text style={styles.body}>
                        طرق وصول أهالي البلد لخدمتك بسهولة
                      </Text>
                    </View>
                  </View>
                  <FormField
                    label="رقم الموبايل *"
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
                    accessibilityState={{ checked: sameNumber }}
                    onPress={() => setSameNumber(!sameNumber)}
                    disabled={busy}
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
                      رقم الواتساب هو نفس رقم الموبايل
                    </Text>
                  </Pressable>
                  {!sameNumber ? (
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
                    fieldY.current.coverageAreas = event.nativeEvent.layout.y;
                  }}
                >
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
                    <MaterialCommunityIcons
                      name="map-marker-outline"
                      size={28}
                      color={colors.primaryDark}
                      accessibilityElementsHidden
                    />
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
                    placeholder="مثال: شارع المدارس، جنب المسجد الكبير"
                    multiline
                    error={errors.address}
                    editable={!busy}
                    maxLength={500}
                  />
                </View>
                <View
                  style={styles.formPanel}
                  onLayout={(event) => {
                    fieldY.current.weeklyHours = event.nativeEvent.layout.y;
                  }}
                >
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
                  disabled={busy}
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
                    أوافق على عرض اسمي وبيانات التواصل والعنوان داخل التطبيق بعد
                    مراجعة الطلب.
                  </Text>
                </Pressable>
                {errors.consent ? (
                  <Text style={styles.error}>{errors.consent}</Text>
                ) : null}
              </View>
            ) : null}
            {submitError === SERVICE_LIMIT_MESSAGE ? (
              <Pressable
                accessibilityRole="button"
                onPress={support.openEmail}
                style={styles.primary}
              >
                <Text style={styles.white}>
                  تواصل مع الدعم لإضافة خدمات أكتر
                </Text>
              </Pressable>
            ) : null}
            {submitError ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {submitError}
              </Text>
            ) : null}
          </ScrollView>
          <View style={styles.actionBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                busy
                  ? 'جارٍ إرسال الطلب...'
                  : step === 1
                    ? returnToReview
                      ? 'العودة للمراجعة'
                      : 'التالي: بيانات التواصل والمكان'
                    : reviewing
                      ? 'إرسال الطلب للمراجعة'
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
                  ? 'جارٍ إرسال الطلب...'
                  : step === 1
                    ? returnToReview
                      ? 'العودة للمراجعة'
                      : 'التالي'
                    : reviewing
                      ? 'إرسال الطلب للمراجعة'
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
    stepLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'center',
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
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 16,
    },
    back: {
      minWidth: 48,
      minHeight: 48,
      justifyContent: 'center',
      alignItems: 'center',
    },
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
    selector: {
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      minHeight: 56,
    },
    options: { backgroundColor: colors.surface, borderRadius: 16, padding: 8 },
    option: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      padding: 8,
      minHeight: 48,
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
    stepHeading: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    stepBadge: {
      ...typography.caption,
      color: colors.primaryDark,
      backgroundColor: colors.surfaceContainer,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
      writingDirection: 'rtl',
    },
    welcome: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 22,
      padding: spacing.sm + spacing.xs,
      gap: spacing.xs,
    },
    sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    hint: { ...typography.caption, color: colors.muted, textAlign: 'auto' },
    white: { color: colors.onPrimary },
    error: {
      ...typography.caption,
      color: colors.error,
      writingDirection: 'rtl',
    },
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
