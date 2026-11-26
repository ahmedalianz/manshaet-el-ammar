import { useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { AddServiceArtwork } from '../provider/AddServiceArtwork';
import { ProviderAction } from '../provider/ProviderPage';
import { useAppTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';
import { getPhotoApiUrl, type PhotoDraft } from './api';
import { deleteDraftPhoto } from './draftFiles';

const PHOTO_TIPS = ['واجهة واضحة', 'إضاءة نهارية', 'بدون أشخاص'] as const;

export function PhotoField({
  value,
  onChange,
  approvedUrl,
  pendingPhotoReview = false,
  disabled,
  progress,
  onCancel,
}: {
  value: PhotoDraft;
  onChange: (value: PhotoDraft) => Promise<void>;
  approvedUrl?: string;
  pendingPhotoReview?: boolean;
  disabled?: boolean;
  progress?: number;
  onCancel: () => void;
}) {
  const { colors } = useAppTheme();
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const apiUrl = getPhotoApiUrl();
  const pick = async () => {
    setPicking(true);
    setError('');
    let preparedUri: string | undefined;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        quality: 1,
        exif: false,
      });
      if (result.canceled) {
        if (
          value.action === 'replace' &&
          value.localUri &&
          Platform.OS !== 'web' &&
          !new File(value.localUri).exists
        ) {
          await onChange({ action: 'keep' });
          throw new Error('ملف الصورة السابقة مبقاش موجود. اختار الصورة من جديد.');
        }
        return;
      }
      const asset = result.assets[0];
      if (
        asset.width > 0 &&
        asset.height > 0 &&
        asset.width * asset.height > 60_000_000
      )
        throw new Error('الصورة كبيرة جدًا. اختار صورة أصغر.');
      let output: { uri: string } | undefined;
      for (const [edge, quality] of [
        [1280, 0.78],
        [1100, 0.65],
        [900, 0.55],
        [768, 0.45],
      ] as const) {
        const context = ImageManipulator.manipulate(asset.uri, {
          maxWidth: edge,
          maxHeight: edge,
        });
        let rendered:
          Awaited<ReturnType<typeof context.renderAsync>> | undefined;
        try {
          if (asset.width > 0 && asset.height > 0) {
            const ratio = Math.min(
              1,
              edge / Math.max(asset.width, asset.height),
            );
            context.resize({
              width: Math.max(1, Math.round(asset.width * ratio)),
              height: Math.max(1, Math.round(asset.height * ratio)),
            });
          }
          rendered = await context.renderAsync();
          if (rendered.width <= 0 || rendered.height <= 0)
            throw new Error('تعذر قراءة أبعاد الصورة.');
          const nextOutput = await rendered.saveAsync({
            format: SaveFormat.JPEG,
            compress: quality,
          });
          if (output && Platform.OS !== 'web') {
            try {
              const previousFile = new File(output.uri);
              if (previousFile.exists) previousFile.delete();
            } catch {}
          }
          output = nextOutput;
          if (Platform.OS === 'web' || new File(output.uri).size <= 300_000)
            break;
        } finally {
          rendered?.release?.();
          context.release?.();
        }
      }
      if (!output) return;
      let uri = output.uri;
      if (Platform.OS !== 'web') {
        const source = new File(uri);
        try {
          if (source.size > 500_000)
            throw new Error('الصورة كبيرة بعد التصغير. جرّب صورة تانية.');
          const directory = new Directory(
            Paths.document,
            'service-photo-drafts',
          );
          directory.create({ idempotent: true, intermediates: true });
          const destination = new File(
            directory,
            `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
          );
          await source.copy(destination);
          if (!destination.exists || destination.size <= 0)
            throw new Error('مش قادرين نحفظ الصورة المؤقتة. جرّب تاني.');
          uri = destination.uri;
        } finally {
          try {
            if (source.exists) source.delete();
          } catch {}
        }
      }
      preparedUri = uri;
      await onChange({ action: 'replace', localUri: uri });
    } catch (cause) {
      if (preparedUri) deleteDraftPhoto(preparedUri);
      setError(
        cause instanceof Error
          ? cause.message
          : 'مش قادرين نفتح الصورة. جرّب تاني.',
      );
    } finally {
      setPicking(false);
    }
  };
  const change = async (next: PhotoDraft) => {
    setPicking(true);
    setError('');
    try {
      await onChange(next);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'مش قادرين نغيّر الصورة. جرّب تاني.',
      );
    } finally {
      setPicking(false);
    }
  };
  const preview =
    value.action === 'replace'
      ? value.localUri
      : value.action === 'remove'
        ? undefined
        : approvedUrl;
  const uploadPercent =
    progress !== undefined
      ? Math.max(0, Math.min(100, Math.round(progress * 100)))
      : 0;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.headerRow}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.iconBox, { backgroundColor: colors.surfaceContainer }]}
        >
          <MaterialCommunityIcons
            name="camera-plus-outline"
            size={24}
            color={colors.primaryDark}
            accessibilityElementsHidden
          />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            صورة المكان — اختياري
          </Text>
        </View>
      </View>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        صورة واضحة لواجهة المحل أو مكان تقديم الخدمة بتساعد أهل البلد يعرفوه.
        تقدر تكمّل من غير صورة. تجنّب صور الناس والمعلومات الخاصة.
      </Text>
      {preview ? (
        <View style={[styles.previewWrap, { borderColor: colors.border }]}>
          <Image
            source={preview}
            style={styles.preview}
            contentFit="cover"
            cachePolicy={value.localUri ? 'none' : 'memory-disk'}
            accessibilityLabel="معاينة صورة المكان"
          />
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.previewBadge,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="image-check-outline"
              size={16}
              color={colors.primaryDark}
              accessibilityElementsHidden
            />
            <Text style={[styles.badgeText, { color: colors.primaryDark }]}>
              معاينة الصورة
            </Text>
          </View>
        </View>
      ) : apiUrl ? (
        <View
          style={[
            styles.dropzone,
            {
              borderColor: colors.primary,
              backgroundColor: colors.surfaceLow,
            },
          ]}
        >
          <AddServiceArtwork variant="photo" />
          <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.tipsRow}
          >
            {PHOTO_TIPS.map((tip) => (
              <View
                key={tip}
                style={[
                  styles.tipPill,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                  {tip}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.unavailableBanner,
            {
              backgroundColor: colors.surfaceLow,
              borderColor: colors.border,
            },
          ]}
        >
          <AddServiceArtwork variant="photo" compact />
          <Text
            style={[styles.unavailableText, { color: colors.textSecondary }]}
          >
            إضافة الصور مش متاحة حاليًا. تقدر تبعت بيانات خدمتك عادي.
          </Text>
        </View>
      )}
      {value.action !== 'keep' ? (
        <Text style={[styles.statusNotice, { color: colors.warning }]}>
          {value.action === 'remove'
            ? 'طلب إزالة الصورة هيتراجع قبل النشر.'
            : 'الصورة الجديدة هتظهر بعد الموافقة عليها.'}
        </Text>
      ) : null}
      {progress !== undefined ? (
        <View
          style={[
            styles.progressBox,
            {
              backgroundColor: colors.surfaceLow,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={[styles.progressText, { color: colors.primaryDark }]}
          >
            جاري رفع الصورة… {uploadPercent}٪
          </Text>
          <View
            accessible={false}
            style={[
              styles.progressTrack,
              { backgroundColor: colors.surfaceContainer },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${uploadPercent}%`,
                  backgroundColor: colors.actionBackground,
                },
              ]}
            />
          </View>
          <ProviderAction
            title="إلغاء رفع الصورة"
            secondary
            onPress={onCancel}
          />
        </View>
      ) : null}
      {pendingPhotoReview ? (
        <Text style={[styles.statusNotice, { color: colors.warning }]}>
          في صورة قيد المراجعة حاليًا للخدمة دي. استنى نتيجة المراجعة قبل تغيير
          الصورة.
        </Text>
      ) : null}
      <ProviderAction
        title={
          picking
            ? 'بنجهّز الصورة…'
            : preview
              ? 'تغيير الصورة'
              : 'اختيار صورة من المعرض'
        }
        secondary
        disabled={disabled || picking || !apiUrl || pendingPhotoReview}
        onPress={() => void pick()}
      />
      {value.action !== 'keep' ? (
        <ProviderAction
          title="كمّل من غير صورة جديدة"
          secondary
          disabled={disabled || picking}
          onPress={() => void change({ action: 'keep' })}
        />
      ) : null}
      {approvedUrl && value.action !== 'remove' ? (
        <ProviderAction
          title="طلب إزالة الصورة المنشورة"
          destructive
          disabled={disabled || picking || pendingPhotoReview}
          onPress={() => void change({ action: 'remove' })}
        />
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={[styles.statusNotice, { color: colors.error }]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 22, borderWidth: 1, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: {
    ...typography.title,
    writingDirection: 'rtl',
    textAlign: 'auto',
  },
  description: {
    ...typography.body,
    writingDirection: 'rtl',
    textAlign: 'auto',
  },
  previewWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  preview: { width: '100%', height: 184 },
  previewBadge: {
    position: 'absolute',
    top: 10,
    start: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    ...typography.caption,
    writingDirection: 'rtl',
  },
  dropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    gap: 10,
  },
  tipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  tipPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  tipText: {
    ...typography.caption,
    writingDirection: 'rtl',
  },
  unavailableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  unavailableText: {
    ...typography.caption,
    flex: 1,
    minWidth: 0,
    writingDirection: 'rtl',
    textAlign: 'auto',
  },
  statusNotice: {
    ...typography.caption,
    writingDirection: 'rtl',
    textAlign: 'auto',
  },
  progressBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  progressText: {
    ...typography.label,
    writingDirection: 'rtl',
    textAlign: 'auto',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
});
