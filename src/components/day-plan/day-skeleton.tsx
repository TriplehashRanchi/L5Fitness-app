import { View } from 'react-native';

import { useT } from '@/providers/language-provider';

/** Grey placeholder blocks shown while a day is loading. */
export function DaySkeleton() {
  const t = useT();
  return (
    <View accessible accessibilityLabel={t('act.loading')} className="gap-4 px-5">
      <View className="rounded-3xl bg-card" style={{ height: 130 }} />
      <View className="rounded-3xl bg-card" style={{ height: 200 }} />
      <View className="rounded-3xl bg-card" style={{ height: 160 }} />
    </View>
  );
}
