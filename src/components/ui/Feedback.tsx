import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ThemeColors } from '../../theme/colors';
import { useAppTheme, useThemedStyles } from '../../theme/ThemeProvider';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { MotionPressable, MotionReveal } from './Motion';

type Tone = 'success' | 'error' | 'info';
export type FeedbackButton = {
  text: string;
  style?: 'cancel' | 'destructive' | 'default';
  onPress?: () => void;
};
export type FeedbackApi = {
  show: (
    title: string,
    message: string,
    buttons?: FeedbackButton[],
    options?: { key?: string; tone?: Tone },
  ) => void;
};
type Notice = { id: number; title: string; message: string; tone: Tone };
type Dialog = Notice & { buttons: FeedbackButton[]; key?: string };
const Context = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useAppTheme();
  const [toast, setToast] = useState<Notice | null>(null);
  const [dialogs, setDialogs] = useState<Dialog[]>([]);
  const pending = useRef<Dialog[]>([]);
  const sequence = useRef(0);
  const titleRef = useRef<ComponentRef<typeof Text>>(null);
  const modalShown = useRef(false);
  const focusedDialog = useRef<number | null>(null);
  const show = useCallback<FeedbackApi['show']>(
    (title, message, buttons, options) => {
      const tone =
        options?.tone ??
        (title.startsWith('تم')
          ? 'success'
          : title.startsWith('تعذر') || title.startsWith('مش قادرين')
            ? 'error'
            : 'info');
      const notice = { id: ++sequence.current, title, message, tone };
      if (!buttons?.length) {
        setToast((current) =>
          current?.title === title && current?.message === message
            ? current
            : notice,
        );
        return;
      }
      if (
        options?.key &&
        pending.current.some((dialog) => dialog.key === options.key)
      )
        return;
      pending.current = [
        ...pending.current,
        { ...notice, buttons, key: options?.key },
      ];
      setDialogs(pending.current);
    },
    [],
  );
  const api = useMemo(() => ({ show }), [show]);
  const dialog = dialogs[0];
  const dialogOpen = Boolean(dialog);
  const focusDialog = () => {
    if (!dialog || !modalShown.current || focusedDialog.current === dialog.id)
      return;
    const node = findNodeHandle(titleRef.current);
    if (node) {
      AccessibilityInfo.setAccessibilityFocus(node);
      focusedDialog.current = dialog.id;
    }
  };
  const choose = (id: number, button?: FeedbackButton) => {
    // Remove synchronously before invoking the action: repeated taps cannot run it twice.
    if (pending.current[0]?.id !== id) return;
    pending.current = pending.current.slice(1);
    if (!pending.current.length) modalShown.current = false;
    setDialogs(pending.current);
    try {
      button?.onPress?.();
    } catch (error) {
      show(
        'مش قادرين نكمّل الخطوة دي',
        error instanceof Error ? error.message : 'حصل خطأ. جرّب تاني.',
      );
    }
  };
  const cancel = () => {
    if (dialog)
      choose(
        dialog.id,
        dialog.buttons.find((button) => button.style === 'cancel'),
      );
  };
  useEffect(() => {
    if (!toast || dialogOpen) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (Platform.OS === 'ios')
      AccessibilityInfo.announceForAccessibility(
        [toast.title, toast.message].filter(Boolean).join('. '),
      );
    // Screen reader users control dismissal; other users retain a visible close button.
    AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (!active || enabled) return;
        timer = setTimeout(
          () =>
            setToast((current) => (current?.id === toast.id ? null : current)),
          toast.tone === 'error' ? 6000 : 4000,
        );
      })
      .catch(() => {
        /* Keep the dismissible notice when preference lookup fails. */
      });
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [toast, dialogOpen]);
  return (
    <Context.Provider value={api}>
      <View
        style={styles.root}
        accessibilityElementsHidden={Boolean(dialog)}
        importantForAccessibility={dialog ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {toast ? (
        <SafeAreaView
          pointerEvents="box-none"
          edges={['top', 'left', 'right']}
          style={styles.toastLayer}
        >
          <MotionReveal key={toast.id} animateOnMount style={styles.toast}>
            <View
              style={[
                styles.symbol,
                toast.tone === 'error' && styles.errorSymbol,
              ]}
            >
              <MaterialCommunityIcons
                name={
                  toast.tone === 'success'
                    ? 'check-circle-outline'
                    : toast.tone === 'error'
                      ? 'alert-circle-outline'
                      : 'information-outline'
                }
                size={24}
                color={
                  toast.tone === 'error' ? colors.error : colors.primaryDark
                }
                accessibilityElementsHidden
              />
            </View>
            <View
              style={styles.copy}
              accessible
              accessibilityRole="alert"
              accessibilityLabel={[toast.title, toast.message]
                .filter(Boolean)
                .join('. ')}
              accessibilityLiveRegion="polite"
            >
              <Text style={styles.toastTitle}>{toast.title}</Text>
              {toast.message ? (
                <Text style={styles.message}>{toast.message}</Text>
              ) : null}
            </View>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel="إغلاق الإشعار"
              onPress={() => setToast(null)}
              style={styles.close}
            >
              <MaterialCommunityIcons
                name="close"
                size={20}
                color={colors.muted}
                accessibilityElementsHidden
              />
            </MotionPressable>
          </MotionReveal>
        </SafeAreaView>
      ) : null}
      <Modal
        testID="feedback-dialog"
        visible={Boolean(dialog)}
        transparent
        animationType="none"
        onRequestClose={cancel}
        onShow={() => {
          modalShown.current = true;
          focusDialog();
        }}
      >
        {dialog ? (
          <SafeAreaView
            style={styles.backdrop}
            edges={['top', 'bottom', 'left', 'right']}
          >
            <ScrollView
              contentContainerStyle={styles.dialogScroll}
              keyboardShouldPersistTaps="handled"
            >
              <MotionReveal
                key={dialog.id}
                animateOnMount
                style={styles.dialog}
                accessibilityViewIsModal
                onAccessibilityEscape={cancel}
              >
                <View style={styles.dialogSymbol}>
                  <MaterialCommunityIcons
                    name={
                      dialog.buttons.some(
                        (button) => button.style === 'destructive',
                      )
                        ? 'alert-circle-outline'
                        : 'help-circle-outline'
                    }
                    size={30}
                    color={colors.primaryDark}
                    accessibilityElementsHidden
                  />
                </View>
                <Text
                  ref={titleRef}
                  onLayout={focusDialog}
                  accessible
                  accessibilityRole="header"
                  style={styles.dialogTitle}
                >
                  {dialog.title}
                </Text>
                <Text style={styles.message}>{dialog.message}</Text>
                <View style={styles.actions}>
                  {dialog.buttons.map((button, index) => (
                    <MotionPressable
                      key={index}
                      accessibilityRole="button"
                      onPress={() => choose(dialog.id, button)}
                      style={[
                        styles.action,
                        button.style === 'cancel' && styles.cancelAction,
                        button.style === 'destructive' &&
                          styles.destructiveAction,
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionText,
                          button.style === 'cancel' && styles.cancelText,
                          button.style === 'destructive' &&
                            styles.destructiveText,
                        ]}
                      >
                        {button.text}
                      </Text>
                    </MotionPressable>
                  ))}
                </View>
              </MotionReveal>
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>
    </Context.Provider>
  );
}

export function useFeedback() {
  const feedback = useContext(Context);
  if (!feedback) throw new Error('FeedbackProvider is required');
  return feedback;
}
const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: { flex: 1 },
    toastLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
    toast: {
      margin: spacing.md,
      padding: spacing.sm,
      gap: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.elevatedSurface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      maxWidth: 480,
      alignSelf: 'center',
      width: '92%',
    },
    symbol: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: colors.surfaceContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorSymbol: { backgroundColor: colors.errorContainer },
    copy: { flex: 1, minWidth: 0, gap: spacing.xs },
    toastTitle: {
      ...typography.title,
      color: colors.primaryDark,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    message: {
      ...typography.body,
      color: colors.textSecondary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    close: {
      minWidth: 48,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backdrop: { flex: 1, backgroundColor: colors.overlay },
    dialogScroll: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: spacing.md,
    },
    dialog: {
      width: '100%',
      maxWidth: 420,
      alignSelf: 'center',
      padding: spacing.lg,
      gap: spacing.md,
      borderRadius: 24,
      backgroundColor: colors.elevatedSurface,
    },
    dialogSymbol: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: colors.surfaceLow,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },
    dialogTitle: {
      ...typography.screenTitle,
      color: colors.textPrimary,
      writingDirection: 'rtl',
      textAlign: 'auto',
    },
    actions: { gap: spacing.sm, marginTop: spacing.sm },
    action: {
      minHeight: 52,
      justifyContent: 'center',
      padding: spacing.sm,
      borderRadius: 14,
      backgroundColor: colors.actionBackground,
    },
    actionText: {
      ...typography.button,
      color: colors.onPrimary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    cancelAction: { backgroundColor: colors.surfaceContainer },
    cancelText: { color: colors.primaryDark },
    destructiveAction: { backgroundColor: colors.errorContainer },
    destructiveText: { color: colors.error },
  });
