import type { ReactNode } from 'react';
import { DisplayText } from '@/components/display-text';
import { Text, View } from 'react-native';

/** A consistent, quiet heading for the app's main screens. */
export function PageHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-4 px-5 pb-4">
      <View className="flex-1 gap-2">
        <DisplayText accessibilityRole="header" maxFontSizeMultiplier={1.3} className="text-[32px] uppercase leading-9 tracking-tight text-white">{title}</DisplayText>
        {subtitle ? <Text maxFontSizeMultiplier={1.4} className="text-sm leading-5 text-muted">{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}
