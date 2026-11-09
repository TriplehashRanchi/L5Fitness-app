import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

/** A consistent, quiet heading for the app's main screens. */
export function PageHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-4 px-5 pb-2">
      <View className="flex-1 gap-2">
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} className="text-[30px] font-bold leading-9 tracking-tight text-white">{title}</Text>
        {subtitle ? <Text maxFontSizeMultiplier={1.4} className="text-sm leading-5 text-muted">{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}
