import { Exo2_900Black, useFonts } from '@expo-google-fonts/exo-2';
import { Children } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

/** Latin letters, digits and the punctuation around them: what the headline face can draw. */
const LATIN = /^[\u0000-\u024F\u2010-\u206F\u20A0-\u20CF\u2190-\u21FF\u2212]*$/;

/**
 * The heavy sport face used for headlines on the onboarding and login screens. Use it for titles and big numbers.
 * It has no Indian scripts: those are drawn in the phone's own bold face, with more room above and below so the
 * vowel signs are not cut off, and without letter spacing, which would pull joined letters apart.
 */
export function DisplayText({ style, children, ...props }: TextProps) {
  const [loaded] = useFonts({ Exo2_900Black });
  const latin = Children.toArray(children).every((c) => typeof c !== 'string' || LATIN.test(c));
  const flat = StyleSheet.flatten(style);
  const size = flat?.fontSize;
  const other = {
    fontWeight: '800' as const,
    letterSpacing: 0,
    ...(size ? { lineHeight: Math.max(flat?.lineHeight ?? 0, Math.round(size * 1.4)) } : null),
  };
  // fontWeight must be reset: a bold weight on top of a custom face makes Android fall back to the system font.
  return (
    <Text {...props} style={[style, !latin ? other : loaded ? { fontFamily: 'Exo2_900Black', fontWeight: 'normal' } : null]}>
      {children}
    </Text>
  );
}
