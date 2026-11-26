import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useLanguage } from '@/providers/language-provider';

export const BRAND = '#3ddc68';
export const INK = '#050a07';
export const MUTED = '#8fa396';
export const HAIRLINE = 'rgba(255,255,255,0.06)';
export const TRACK = 'rgba(255,255,255,0.08)';
export const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** A slim progress bar whose fill glides to its value (no glide when the phone asks for reduced motion). */
export function Bar({ progress, label, valueText, height = 5 }: { progress: number; label: string; valueText: string; height?: number }) {
  const reduce = useReducedMotion();
  const value = useSharedValue(clamp01(progress));
  useEffect(() => {
    value.value = reduce ? clamp01(progress) : withTiming(clamp01(progress), { duration: 450 });
  }, [progress, reduce, value]);
  const fill = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp01(progress) * 100), text: valueText }}
      className="overflow-hidden rounded-full"
      style={{ height, backgroundColor: TRACK }}>
      <Animated.View style={[{ height, borderRadius: height / 2, backgroundColor: BRAND }, fill]} />
    </View>
  );
}

/** A round tick that pops when it becomes checked. */
export function CheckDot({ done, size = 28 }: { done: boolean; size?: number }) {
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (done && !reduce) scale.value = withSequence(withTiming(1.25, { duration: 110 }), withTiming(1, { duration: 160 }));
  }, [done, reduce, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      className="items-center justify-center"
      style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: done ? 0 : 2, borderColor: MUTED, backgroundColor: done ? BRAND : 'transparent' }, pop]}>
      {done ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={INK} size={size * 0.5} /> : null}
    </Animated.View>
  );
}

/** One block of the card: small round icon, title, a status at the right, then the content. */
export function Section({
  icon,
  title,
  status,
  done,
  first,
  children,
}: {
  icon: SymbolViewProps['name'];
  title: string;
  status?: string;
  done?: boolean;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={[{ paddingVertical: 16 }, first ? null : { borderTopWidth: 1, borderTopColor: HAIRLINE }]}>
      <View className="mb-3 flex-row items-center gap-3">
        <View className="items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: done ? BRAND : 'rgba(255,255,255,0.07)' }}>
          <SymbolView name={icon} tintColor={done ? INK : BRAND} size={15} />
        </View>
        <Text {...COMPACT_TEXT} className="flex-1 text-base font-bold text-white">
          {title}
        </Text>
        {status ? (
          <Text {...COMPACT_TEXT} className={`text-sm font-bold ${done ? 'text-brand' : 'text-muted'}`} numberOfLines={1}>
            {status}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A pill button, at least 44 px tall. Disabled and showing a spinner while `busy`. */
export function PillButton({
  label,
  onPress,
  accessibilityLabel,
  busy,
  disabled,
  primary,
  icon,
  flex,
  small,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  primary?: boolean;
  icon?: SymbolViewProps['name'];
  flex?: boolean;
  /** A shorter pill (36 px) with smaller text. */
  small?: boolean;
}) {
  const off = busy || disabled;
  // Longer words in the other languages shrink to fit the pill.
  const indic = useLanguage().language !== 'en';
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      className={`flex-row items-center justify-center gap-1.5 rounded-full px-4 active:opacity-70 ${primary ? 'bg-brand' : 'border border-white/10 bg-card-2'} ${flex ? 'flex-1' : ''}`}
      style={{ minHeight: small ? 36 : 44, opacity: off && !busy ? 0.5 : 1 }}>
      {busy ? (
        <ActivityIndicator size="small" color={primary ? INK : BRAND} />
      ) : (
        <>
          {icon ? <SymbolView name={icon} tintColor={primary ? INK : BRAND} size={small ? 12 : 15} /> : null}
          <Text {...COMPACT_TEXT} className={`${small ? 'text-xs' : 'text-sm'} font-bold ${primary ? 'text-ink' : 'text-white'} ${indic ? 'shrink text-center' : ''}`} numberOfLines={indic ? 2 : 1} adjustsFontSizeToFit={indic}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** A tappable text link, 44 px tall. */
export function TextLink({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} className="min-h-11 justify-center active:opacity-60">
      <Text {...COMPACT_TEXT} className="text-sm font-bold text-brand">
        {label}
      </Text>
    </Pressable>
  );
}

export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" {...COMPACT_TEXT} className="mt-2 text-xs font-semibold text-accent">
      {message}
    </Text>
  );
}
