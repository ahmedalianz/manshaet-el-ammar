import { LoadingState } from '../../components/ui/LoadingState';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { returnToRoute } from '../navigation/returnToRoute';
import { auth } from '../../lib/firebase/auth';
import { db } from '../../lib/firebase/firestore';
import { useFeedback } from '../../components/ui/Feedback';
import { getPhotoApiUrl, reviewPhoto } from '../photos/api';
import {
  hasRecoverableServicePhoto,
  retryRestoreServicePhoto,
} from '../provider/firebaseAdminRepository';
import { useProviderState } from '../provider/ProviderContext';
import { ProviderAction, useProviderStyles } from '../provider/ProviderPage';
import { FormField } from '../provider/FormField';
import type { PlacePhoto } from '../discovery/types';
import type { PublishedService, ServiceRequest } from '../provider/types';

export function AdminPhotoReview({
  request,
  onRefresh,
  currentPhoto,
}: {
  request: ServiceRequest;
  currentPhoto?: PlacePhoto;
  onRefresh: () => Promise<void>;
}) {
  const styles = useProviderStyles();
  const feedback = useFeedback();
  const [token, setToken] = useState<string>();
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [savedDecision, setSavedDecision] = useState<'approved' | 'rejected'>();
  const [phase, setPhase] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const base = getPhotoApiUrl();
  if (!request.photoChange || request.photoChange.action === 'keep')
    return null;
  const review = async (decision: 'approved' | 'rejected') => {
    if (inFlight.current || !base) return;
    if (!savedDecision && decision === 'rejected' && !reason.trim()) {
      setError('اكتب سبب رفض الصورة.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    setRefreshFailed(false);
    let decisionSaved = Boolean(savedDecision);
    try {
      if (!savedDecision) {
        setPhase(
          decision === 'approved'
            ? 'بنعتمد الصورة… استنى لحظة'
            : 'بنحفظ رفض الصورة…',
        );
        await reviewPhoto(
          request.id,
          decision,
          reason.trim() ? reason.trim() : undefined,
        );
        decisionSaved = true;
        setSavedDecision(decision);
      }
      setPhase('بنحدّث حالة المراجعة…');
      await onRefresh();
      setToken(undefined);
      feedback.show(
        'تم',
        decision === 'approved'
          ? 'تم اعتماد تغيير الصورة.'
          : 'تم رفض تغيير الصورة.',
      );
      if (request.status !== 'pending') returnToRoute('/admin');
    } catch (cause) {
      if (decisionSaved) {
        setRefreshFailed(true);
        setError(
          'تم حفظ قرار الصورة، لكن مش قادرين نحدّث القائمة. جرّب تحديث الحالة.',
        );
      } else
        setError(
          cause instanceof Error ? cause.message : 'حصلت مشكلة. جرّب تاني.',
        );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>
        مراجعة صورة المكان — مستقلة عن بيانات الخدمة
      </Text>
      <Text style={styles.body}>
        {request.photoChange.action === 'remove'
          ? 'صاحب الخدمة طالب إزالة الصورة المنشورة.'
          : 'صورة جديدة قيد المراجعة. راجع إنها للمكان الفعلي ومفيهاش بيانات خاصة.'}
      </Text>
      {(request.photoChange.action === 'remove' ||
        request.photoChange.action === 'replace') &&
      currentPhoto ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>الصورة المنشورة حاليًا</Text>
          <Image
            source={{ uri: currentPhoto.detailUrl }}
            cachePolicy="memory-disk"
            style={{ width: '100%', height: 180, borderRadius: 16 }}
            contentFit="contain"
            accessibilityLabel={
              request.photoChange.action === 'remove'
                ? 'الصورة المنشورة المطلوب إزالتها'
                : 'الصورة المنشورة حاليًا'
            }
          />
        </View>
      ) : null}
      {busy ? <LoadingState compact label={phase} /> : null}
      {refreshFailed ? (
        <ProviderAction
          title="تحديث حالة المراجعة"
          disabled={busy}
          onPress={() => void review(savedDecision!)}
        />
      ) : null}
      {request.photoReviewStatus === 'pending' && !savedDecision ? (
        <>
          {request.photoChange.action === 'replace' && base ? (
            <>
              {token ? (
                <Image
                  source={{
                    uri: `${base}/v1/photos/candidates/${encodeURIComponent(request.photoChange.candidateId!)}/preview`,
                    headers: { Authorization: `Bearer ${token}` },
                  }}
                  style={{ height: 200, width: '100%', borderRadius: 16 }}
                  contentFit="contain"
                  cachePolicy="none"
                  onError={() => {
                    setToken(undefined);
                    setError(
                      'مش قادرين نعرض الصورة الخاصة. حدّث الطلب وجرّب تاني.',
                    );
                  }}
                  accessibilityLabel="الصورة المقترحة للمراجعة"
                />
              ) : (
                <ProviderAction
                  title="عرض الصورة الخاصة"
                  secondary
                  onPress={() => {
                    setError('');
                    void auth?.currentUser
                      ?.getIdToken()
                      .then(setToken)
                      .catch(() => setError('مش قادرين نعرض الصورة.'));
                  }}
                />
              )}
            </>
          ) : null}
          <FormField
            label="سبب رفض الصورة"
            value={reason}
            onChangeText={setReason}
            maxLength={1000}
            editable={!busy}
          />
          <ProviderAction
            title="اعتماد تغيير الصورة"
            disabled={
              busy ||
              !base ||
              (request.photoChange.action === 'replace' && !token)
            }
            onPress={() => void review('approved')}
          />
          <ProviderAction
            title="رفض تغيير الصورة"
            destructive
            disabled={busy || !base}
            onPress={() => void review('rejected')}
          />
        </>
      ) : (
        <Text style={styles.body}>
          {(savedDecision ?? request.photoReviewStatus) === 'approved'
            ? 'تم اعتماد تغيير الصورة.'
            : `الصورة مرفوضة: ${request.photoReviewReason ?? ''}`}
        </Text>
      )}
      {!base ? (
        <Text style={styles.notice}>خدمة الصور مش مفعّلة في النسخة دي.</Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Lets an admin retry photo restoration if image processing was paused during restore. */
export function RecoverServicePhotoAction({
  service,
  onRestored,
}: {
  service: PublishedService;
  onRestored?: () => void;
}) {
  const feedback = useFeedback();
  const { adminBusy, refresh } = useProviderState();
  const [recoverable, setRecoverable] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const eligible =
    service.publicationStatus === 'published' &&
    !service.placePhoto &&
    Boolean(db && getPhotoApiUrl());

  useEffect(() => {
    if (!eligible || !db) return;
    let active = true;
    void hasRecoverableServicePhoto(db, service.id)
      .then((result) => {
        if (active) setRecoverable(result);
      })
      .catch(() => {
        if (active) setRecoverable(false);
      });
    return () => {
      active = false;
    };
  }, [eligible, service.id]);

  if (!eligible || !recoverable) return null;

  const handleRestore = async () => {
    if (restoring || adminBusy) return;
    setRestoring(true);
    try {
      await retryRestoreServicePhoto(service.id);
      setRecoverable(false);
      refresh();
      onRestored?.();
      feedback.show('تم', 'تم استعادة صورة الخدمة.');
    } catch (cause) {
      feedback.show(
        'تعذر استعادة الصورة',
        cause instanceof Error ? cause.message : 'حصلت مشكلة. جرّب تاني.',
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <ProviderAction
      secondary
      disabled={Boolean(adminBusy) || restoring}
      title={restoring ? 'بنستعيد صورة الخدمة…' : 'استعادة صورة الخدمة'}
      onPress={() => void handleRestore()}
    />
  );
}
