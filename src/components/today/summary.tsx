import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { DisplayText } from '@/components/display-text';
import { dayCounts } from '@/lib/day-plan';
import type { MyDay } from '@/lib/fitness-api';
import { progressLine } from '@/lib/today-tasks';
import { formatWater } from '@/lib/water';

const BRAND = '#3ddc68';
const WATER = '#38bdf8';
const STEPS = '#fbbf24';
const MEALS = '#fb923c';
const TRACK = 'rgba(255,255,255,0.08)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

function Ring({ percent }: { percent: number }) {
  const size = 104;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const shown = Math.min(1, Math.max(0, percent / 100));
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={TRACK} strokeWidth={stroke} fill="none" />
        {shown > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={BRAND}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${len * shown} ${len}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <DisplayText {...COMPACT_TEXT} style={{ fontSize: 26, lineHeight: 30 }} className="text-white">
        {percent}
        <Text style={{ fontSize: 14 }} className="text-muted">
          %
        </Text>
      </DisplayText>
    </View>
  );
}

function Stat({ icon, color, value, label, ratio }: { icon: SymbolViewProps['name']; color: string; value: string; label: string; ratio: number }) {
  return (
    <View className="flex-1 items-center" accessible accessibilityLabel={`${label}: ${value}`}>
      <SymbolView name={icon} tintColor={color} size={18} />
      <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 14, marginTop: 6 }} numberOfLines={1}>
        {value}
      </Text>
      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 11, marginTop: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <View className="overflow-hidden rounded-full" style={{ height: 4, width: '70%', marginTop: 8, backgroundColor: TRACK }}>
        <View style={{ height: 4, borderRadius: 2, width: `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

const short = (n: number, locale: string) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : n.toLocaleString(locale));

/** The top card: how much of the day is done, as a ring, and one small meter each for workout, meals, water and steps. */
export function DaySummary({ day, percent, locale }: { day: MyDay; percent: number; locale: string }) {
  const counts = dayCounts(day);
  const complete = counts.total > 0 && counts.done >= counts.total;
  const part = (v: number, goal: number) => (goal > 0 ? v / goal : 0);

  return (
    <View className="mx-5 mb-4 rounded-3xl border border-white/5 bg-card" style={{ padding: 18 }}>
      <View
        className="flex-row items-center"
        style={{ gap: 18 }}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${counts.done} of ${counts.total} done, ${percent} percent`}
        accessibilityValue={{ min: 0, max: 100, now: percent }}>
        <Ring percent={percent} />
        <View className="flex-1">
          <DisplayText {...COMPACT_TEXT} accessibilityLiveRegion="polite" style={{ fontSize: 24, lineHeight: 30 }} className={complete ? 'text-brand' : 'text-white'}>
            {progressLine(percent)}
          </DisplayText>
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, marginTop: 4 }}>
            <Text className="font-bold text-white">{counts.done}</Text> of {counts.total} tasks done
          </Text>
        </View>
      </View>

      <View className="flex-row" style={{ marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' }}>
        <Stat
          icon={{ ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }}
          color={BRAND}
          value={!day.training ? '–' : day.training.done ? 'Done' : 'To do'}
          label="Workout"
          ratio={day.training?.done ? 1 : 0}
        />
        <Stat
          icon={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }}
          color={MEALS}
          value={day.diet.total > 0 ? `${day.diet.done}/${day.diet.total}` : '–'}
          label="Meals"
          ratio={part(day.diet.done, day.diet.total)}
        />
        <Stat
          icon={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }}
          color={WATER}
          value={formatWater(day.water.totalMl)}
          label="Water"
          ratio={part(day.water.totalMl, day.water.goalMl)}
        />
        <Stat
          icon={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }}
          color={STEPS}
          value={day.steps.value == null ? '–' : short(day.steps.value, locale)}
          label="Steps"
          ratio={part(day.steps.value ?? 0, day.steps.goal)}
        />
      </View>
    </View>
  );
}
