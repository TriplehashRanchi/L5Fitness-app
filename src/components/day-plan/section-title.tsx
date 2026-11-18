import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** Heading for a block on the day pages, with an optional element on the right. */
export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View className="mb-3 flex-row items-center justify-between gap-3 px-5">
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} className="flex-1 text-lg font-bold tracking-tight text-white" numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}
