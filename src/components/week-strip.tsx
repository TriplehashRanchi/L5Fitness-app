import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { formatWeekday, toDayKey, type CalendarDay } from '@/lib/datetime';
import type { WeekDay } from '@/lib/wellness-api';
import { useT } from '@/providers/language-provider';

const INK = '#050a07';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/**
 * Seven days to pick from. Under each day a small mark shows how the plan is going:
 * a tick when everything is done, a dot when something is planned, nothing when nothing is.
 */
export function WeekStrip({
  days,
  summary,
  selected,
  todayKey,
  locale,
  onSelect,
}: {
  days: CalendarDay[];
  summary: WeekDay[];
  selected: string;
  todayKey: string;
  locale: string;
  onSelect: (key: string) => void;
}) {
  const t = useT();
  return (
    <View className="flex-row gap-1.5">
      {days.map((d) => {
        const key = toDayKey(d);
        const info = summary.find((s) => s.day === key);
        const isSelected = key === selected;
        const complete = !!info && info.total > 0 && info.done === info.total;
        const planned = !!info && info.total > 0;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={
              planned
                ? t('act.weekDoneA11y', { day: `${formatWeekday(d, locale, 'long')} ${d.day}`, done: info!.done, total: info!.total })
                : t('act.weekNothingA11y', { day: `${formatWeekday(d, locale, 'long')} ${d.day}` })
            }
            className={`flex-1 items-center gap-1.5 rounded-2xl py-2.5 ${isSelected ? 'bg-brand' : 'bg-card'}`}>
            <Text {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className={`text-[11px] font-semibold ${isSelected ? 'text-ink' : 'text-muted'}`}>
              {formatWeekday(d, locale, 'short')}
            </Text>
            <Text {...COMPACT_TEXT} className={`text-base font-black ${isSelected ? 'text-ink' : key === todayKey ? 'text-brand' : 'text-white'}`}>
              {d.day}
            </Text>
            <View className="h-4 items-center justify-center">
              {complete ? (
                <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} tintColor={isSelected ? INK : '#3ddc68'} size={14} />
              ) : planned ? (
                <View className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-ink' : 'bg-white/50'}`} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
