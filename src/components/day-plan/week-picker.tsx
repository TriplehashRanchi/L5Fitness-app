import { Pressable, Text, View } from 'react-native';

import { DisplayText } from '@/components/display-text';
import { monthYear, WeekArrows } from '@/components/home-header';
import { addDays, formatWeekday, getWeekDays, isSameDay, toDayKey, type CalendarDay } from '@/lib/datetime';
import { useT } from '@/providers/language-provider';

const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** Month row with the joined prev/next pill and a 7-day strip where tapping a day selects it. */
export function WeekPicker({
  selected,
  today,
  firstWeekday,
  locale,
  onSelect,
  marked,
}: {
  selected: CalendarDay;
  today: CalendarDay;
  firstWeekday: number;
  locale: string;
  onSelect: (day: CalendarDay) => void;
  /** Days (YYYY-MM-DD) that get a small dot: the ones with a logged workout. */
  marked?: ReadonlySet<string>;
}) {
  const t = useT();
  const days = getWeekDays(selected, firstWeekday);
  return (
    <View className="px-5">
      <View className="mt-5 flex-row items-center justify-between">
        <DisplayText {...COMPACT_TEXT} className="text-xl tracking-tight text-white" numberOfLines={1}>
          {monthYear(days[3], locale)}
        </DisplayText>
        <WeekArrows onStep={(s) => onSelect(addDays(selected, s * 7))} />
      </View>
      <View className="mb-5 mt-5 flex-row">
        {days.map((d) => {
          const isSel = isSameDay(d, selected);
          const isToday = isSameDay(d, today);
          const hasDot = marked?.has(toDayKey(d)) ?? false;
          const dayName = `${formatWeekday(d, locale, 'long')} ${d.day}`;
          return (
            <Pressable
              key={`${d.year}-${d.month}-${d.day}`}
              onPress={() => onSelect(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSel }}
              accessibilityLabel={
                isToday
                  ? t(hasDot ? 'act.pickTodayLoggedA11y' : 'act.pickTodayA11y', { day: dayName })
                  : hasDot
                    ? t('act.pickLoggedA11y', { day: dayName })
                    : dayName
              }
              className="min-h-[44px] flex-1 items-center gap-2">
              <Text {...COMPACT_TEXT} className={`text-sm font-semibold ${isSel ? 'text-white' : 'text-muted'}`}>
                {formatWeekday(d, locale, 'narrow')}
              </Text>
              <View style={{ width: 42, height: 42, borderRadius: 21 }} className={`items-center justify-center ${isSel ? 'bg-brand' : ''}`}>
                <Text {...COMPACT_TEXT} className={`text-base font-bold ${isSel ? 'text-ink' : isToday ? 'text-brand' : 'text-muted'}`}>
                  {d.day}
                </Text>
              </View>
              <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: -2, backgroundColor: hasDot ? '#3ddc68' : 'transparent' }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
