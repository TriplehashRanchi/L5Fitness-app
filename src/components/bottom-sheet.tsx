import { SymbolView } from 'expo-symbols';
import { useMemo, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, PanResponder, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/providers/language-provider';

const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

type Props = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** The scrolling middle of the sheet. */
  children: ReactNode;
  /** Stays at the bottom, under the content: the main button. */
  footer?: ReactNode;
};

/** The sheet itself. It is made anew each time it opens, so a half-finished drag never carries over. */
function Panel({ title, subtitle, onClose, children, footer }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const drag = useSharedValue(0);
  const dragged = useAnimatedStyle(() => ({ transform: [{ translateY: drag.get() }] }));
  // Pulling the top of the sheet down far or fast enough closes it; otherwise it springs back.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
        onPanResponderMove: (_, g) => drag.set(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => (g.dy > 110 || g.vy > 1 ? onClose() : drag.set(withSpring(0))),
        onPanResponderTerminate: () => drag.set(withSpring(0)),
      }),
    [drag, onClose]
  );

  return (
    // 'padding' on both: inside a modal the window does not shrink for the keyboard, so the sheet is lifted.
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <View className="flex-1 justify-end">
        <Animated.View entering={FadeIn.duration(180)} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('common.close')} className="flex-1" />
        </Animated.View>
        <Animated.View entering={SlideInDown.duration(280)} style={{ width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: height * 0.9 }}>
          <Animated.View
            accessibilityViewIsModal
            style={[
              dragged,
              { flexShrink: 1, backgroundColor: '#111111', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.1)' },
            ]}>
            <View {...pan.panHandlers}>
              <View className="items-center" style={{ paddingTop: 10, paddingBottom: 6 }}>
                <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' }} />
              </View>
              <View className="flex-row items-center" style={{ gap: 12, paddingHorizontal: 20, paddingBottom: 12 }}>
                <View className="flex-1">
                  <Text {...COMPACT_TEXT} accessibilityRole="header" className="font-black text-white" style={{ fontSize: 20, lineHeight: 26 }}>
                    {title}
                  </Text>
                  {subtitle ? (
                    <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, lineHeight: 19, marginTop: 1 }}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  className="items-center justify-center rounded-full active:opacity-60"
                  style={{ width: 34, height: 34, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                  <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor="white" size={13} />
                </Pressable>
              </View>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}>
              {children}
            </ScrollView>
            <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 14 }}>{footer}</View>
          </Animated.View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * A sheet that comes up from the bottom over a dimmed screen. It closes with its cross, a tap on the dimmed
 * part, a pull downwards, or the phone's back button.
 */
export function BottomSheet({ visible, ...panel }: Props & { visible: boolean }) {
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={panel.onClose}>
      {visible ? <Panel {...panel} /> : null}
    </Modal>
  );
}
