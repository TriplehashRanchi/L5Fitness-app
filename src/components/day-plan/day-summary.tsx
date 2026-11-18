import { Text, View } from 'react-native';

import { DisplayText } from '@/components/display-text';
import { dayCounts } from '@/lib/day-plan';
import type { MyDay } from '@/lib/fitness-api';

const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** The day's overall progress: percent, "N of M done" and a pill bar. */
export function DaySummary({ day, large = false, label }: { day: MyDay | null; large?: boolean; label?: string }) {
  const counts = day ? dayCounts(day) : null;
  const percent = day ? Math.min(100, Math.max(0, day.percent)) : 0;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Progress for the day'}
      accessibilityValue={{ min: 0, max: 100, now: percent, text: counts ? `${percent} percent, ${counts.done} of ${counts.total} done` : 'Loading' }}
      className="mx-5 mb-5 rounded-3xl p-5"
      style={{ backgroundColor: '#58cf7a' }}>
      <View className="flex-row items-end justify-between gap-3">
        <View>
          <DisplayText {...COMPACT_TEXT} className={`${large ? 'text-[56px] leading-[60px]' : 'text-[40px] leading-[44px]'} text-ink`}>
            {day ? `${percent}%` : '–'}
          </DisplayText>
          <Text {...COMPACT_TEXT} className="mt-1 text-sm font-bold text-ink/80">
            {counts ? `${counts.done} of ${counts.total} done` : 'Loading…'}
          </Text>
        </View>
        <Text {...COMPACT_TEXT} className="flex-1 pb-1 text-right text-xs font-semibold text-ink/75">
          {counts && counts.total > 0 && counts.done >= counts.total ? 'Everything done. Well done!' : 'Keep going'}
        </Text>
      </View>
      <View className="mt-4 overflow-hidden rounded-full" style={{ height: 14, backgroundColor: 'rgba(5,10,7,0.15)' }}>
        <View style={{ height: 14, width: `${percent}%`, borderRadius: 7, backgroundColor: '#050a07' }} />
      </View>
    </View>
  );
}
