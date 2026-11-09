import { Text, View } from 'react-native';

import { fmtKg } from '@/lib/body';
import type { WeightEntry } from '@/lib/wellness-api';

const CHART_HEIGHT = 80;
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** The last few weigh-ins as bars, oldest on the left. The bars start near the lowest weight so changes are visible. */
export function WeightBars({ history, max = 8 }: { history: WeightEntry[]; max?: number }) {
  const entries = history.slice(0, max).reverse(); // newest first → oldest first
  if (entries.length < 2) {
    return (
      <Text {...COMPACT_TEXT} className="text-sm text-muted">
        Log your weight a few times to see your progress here.
      </Text>
    );
  }
  const values = entries.map((e) => e.weightKg);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(high - low, 1);

  return (
    <View className="flex-row items-end gap-1.5" style={{ height: CHART_HEIGHT + 36 }}>
      {entries.map((e, i) => {
        const height = 14 + ((e.weightKg - low) / span) * (CHART_HEIGHT - 14);
        const latest = i === entries.length - 1;
        return (
          <View
            key={e.id}
            accessible
            accessibilityLabel={`${e.day}: ${fmtKg(e.weightKg)}`}
            className="flex-1 items-center justify-end gap-1">
            <Text {...COMPACT_TEXT} numberOfLines={1} className={`text-[10px] font-semibold ${latest ? 'text-brand' : 'text-muted'}`}>
              {parseFloat(e.weightKg.toFixed(1))}
            </Text>
            <View className={`w-full rounded-t-lg ${latest ? 'bg-brand' : 'bg-white/25'}`} style={{ height }} />
            <Text {...COMPACT_TEXT} numberOfLines={1} className="text-[10px] text-muted">
              {e.day.slice(8)}/{e.day.slice(5, 7)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
