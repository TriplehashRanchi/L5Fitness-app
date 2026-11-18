import { Exo2_900Black, useFonts } from '@expo-google-fonts/exo-2';
import { Text, type TextProps } from 'react-native';

/** The heavy sport face used for headlines on the onboarding and login screens. Use it for titles and big numbers. */
export function DisplayText({ style, ...props }: TextProps) {
  const [loaded] = useFonts({ Exo2_900Black });
  // fontWeight must be reset: a bold weight on top of a custom face makes Android fall back to the system font.
  return <Text {...props} style={[style, loaded ? { fontFamily: 'Exo2_900Black', fontWeight: 'normal' } : null]} />;
}
