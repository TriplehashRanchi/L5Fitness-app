import { SymbolView } from 'expo-symbols';
import { Text, View } from 'react-native';

import { SectionTitle } from '@/components/day-plan/section-title';
import type { MyDay } from '@/lib/fitness-api';
import { formatWater } from '@/lib/water';

const BRAND = '#3ddc68';
const INK = '#050a07';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

function Row({ label, value, ratio, done, note }: { label: string; value: string; ratio: number; done: boolean; note?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${value}${done ? ', done' : ''}`}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      className="py-3">
      <View className="flex-row items-center gap-3">
        <View
          style={{ width: 26, height: 26, borderRadius: 13, borderWidth: done ? 0 : 2, borderColor: '#8fa396', backgroundColor: done ? BRAND : 'transparent' }}
          className="items-center justify-center">
          {done ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={INK} size={13} /> : null}
        </View>
        <View className="flex-1">
          <Text {...COMPACT_TEXT} className="text-sm font-semibold text-white">
            {label}
          </Text>
          {note ? (
            <Text {...COMPACT_TEXT} className="text-xs text-muted">
              {note}
            </Text>
          ) : null}
        </View>
        <Text {...COMPACT_TEXT} className={`text-sm font-bold ${done ? 'text-brand' : 'text-white'}`}>
          {value}
        </Text>
      </View>
      <View className="ml-[38px] mt-2 overflow-hidden rounded-full bg-card-2" style={{ height: 6 }}>
        <View style={{ height: 6, width: `${pct}%`, borderRadius: 3, backgroundColor: BRAND }} />
      </View>
    </View>
  );
}

/** Water and steps against their targets. */
export function ProgressRows({ water, steps, locale }: { water: MyDay['water']; steps: MyDay['steps']; locale: string }) {
  const waterDone = water.goalMl > 0 && water.totalMl >= water.goalMl;
  const stepsDone = steps.value != null && steps.goal > 0 && steps.value >= steps.goal;
  return (
    <View className="mb-5">
      <SectionTitle title="Water and steps" />
      <View className="mx-5 rounded-3xl border border-white/10 bg-card px-5 py-1">
        <Row
          label="Water"
          value={`${formatWater(water.totalMl)} / ${formatWater(water.goalMl)}`}
          ratio={water.goalMl > 0 ? water.totalMl / water.goalMl : 0}
          done={waterDone}
        />
        <Row
          label="Steps"
          value={`${steps.value == null ? '–' : steps.value.toLocaleString(locale)} / ${steps.goal.toLocaleString(locale)}`}
          ratio={steps.value == null || steps.goal <= 0 ? 0 : steps.value / steps.goal}
          done={stepsDone}
        />
      </View>
    </View>
  );
}
