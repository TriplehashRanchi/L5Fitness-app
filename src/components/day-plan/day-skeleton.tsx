import { View } from 'react-native';

/** Grey placeholder blocks shown while a day is loading. */
export function DaySkeleton() {
  return (
    <View accessible accessibilityLabel="Loading" className="gap-4 px-5">
      <View className="rounded-3xl bg-card" style={{ height: 130 }} />
      <View className="rounded-3xl bg-card" style={{ height: 200 }} />
      <View className="rounded-3xl bg-card" style={{ height: 160 }} />
    </View>
  );
}
