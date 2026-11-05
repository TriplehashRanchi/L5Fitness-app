import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type Variant = 'primary' | 'light' | 'outline' | 'ghost' | 'google' | 'apple';

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-brand',
  light: 'bg-white',
  outline: 'border border-white/15 bg-card',
  ghost: 'bg-transparent',
  // Google sign-in branding (light theme): white fill, #747775 1px stroke, #1F1F1F text
  google: 'border border-[#747775] bg-white',
  // Sign in with Apple, white style (Apple's recommendation on dark backgrounds)
  apple: 'border border-[#747775] bg-white',
};

const LABEL: Record<Variant, string> = {
  primary: 'text-ink',
  light: 'text-ink',
  outline: 'text-white',
  ghost: 'text-white',
  google: 'text-[#1F1F1F] font-semibold',
  apple: 'text-black font-semibold',
};

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  left?: ReactNode;
  className?: string;
  /** Screen-reader label when the visible title is short (defaults to title). */
  accessibilityLabel?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  left,
  className = '',
  accessibilityLabel,
}: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      className={`h-14 flex-row items-center justify-center gap-3 rounded-full px-7 active:opacity-80 ${
        CONTAINER[variant]
      } ${inactive ? 'opacity-60' : ''} ${className}`}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? '#fff' : '#0b0b0d'}
        />
      ) : (
        <>
          {left ? <View>{left}</View> : null}
          <Text maxFontSizeMultiplier={1.4} className={`text-base ${variant === 'google' || variant === 'apple' ? '' : 'font-bold'} ${LABEL[variant]}`}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
