import { Text, type TextProps } from 'react-native';

import { splitHighlight } from '@/lib/i18n';

/** Text with some words in the brand colour: "What do you {hl}eat?{/hl}" (the markers come from the translation). */
export function Rich({ text, color = '#3ddc68', ...rest }: { text: string; color?: string } & Omit<TextProps, 'children'>) {
  return (
    <Text {...rest}>
      {splitHighlight(text).map((part, i) => (
        <Text key={i} style={part.highlight ? { color } : undefined}>
          {part.text}
        </Text>
      ))}
    </Text>
  );
}
