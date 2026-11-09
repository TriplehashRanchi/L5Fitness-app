import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { WaterToday } from '@/lib/fitness-api';
import { formatWater, waterPercent, WATER_PRESETS_ML } from '@/lib/water';

const WATER = '#38bdf8';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** Today's water: total against the goal, quick-add buttons, and undo of the last drink. */
export function WaterCard({
  water,
  busy,
  onAdd,
  onUndo,
}: {
  water: WaterToday | null;
  /** true while the server is saving a change */
  busy: boolean;
  onAdd: (ml: number) => void;
  onUndo: () => void;
}) {
  if (!water) return <View className="mx-5 mb-5 h-44 rounded-3xl border border-white/5 bg-card" accessibilityElementsHidden />;

  const percent = waterPercent(water.totalMl, water.goalMl);
  const goalMet = water.totalMl >= water.goalMl;

  return (
    <View className="mx-5 mb-5 rounded-3xl border border-white/5 bg-card p-5">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <SymbolView
            name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }}
            tintColor={WATER}
            size={18}
          />
          <Text {...COMPACT_TEXT} className="text-xs font-bold uppercase tracking-[1px] text-muted">
            Water
          </Text>
        </View>
        <View className={`rounded-full px-3 py-1 ${goalMet ? 'bg-sky-400' : 'bg-card-2'}`}>
          <Text {...COMPACT_TEXT} className={`text-xs font-bold ${goalMet ? 'text-ink' : 'text-sky-400'}`}>
            {goalMet ? 'Goal reached' : `${percent}%`}
          </Text>
        </View>
      </View>

      <View className="mt-3 flex-row items-baseline gap-2">
        <Text
          {...COMPACT_TEXT}
          accessibilityLabel={`${formatWater(water.totalMl)} of ${formatWater(water.goalMl)}`}
          style={{ fontSize: 30, lineHeight: 38 }}
          className="font-bold text-white">
          {formatWater(water.totalMl)}
        </Text>
        <Text {...COMPACT_TEXT} className="text-sm font-semibold text-muted">
          of {formatWater(water.goalMl)}
        </Text>
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        className="mt-3 overflow-hidden rounded-full bg-card-2"
        style={{ height: 6 }}>
        <View className="rounded-full bg-sky-400" style={{ height: 6, width: `${percent}%` }} />
      </View>

      <View className="mt-4 flex-row items-center gap-2">
        {WATER_PRESETS_ML.map((ml) => (
          <Pressable
            key={ml}
            onPress={() => onAdd(ml)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Add ${ml} millilitres of water`}
            className="flex-1 items-center rounded-full bg-card-2 py-2.5 active:opacity-70">
            <Text {...COMPACT_TEXT} className="text-xs font-semibold text-sky-400">
              +{ml} ml
            </Text>
          </Pressable>
        ))}
        {busy ? (
          <View className="w-14 items-center">
            <ActivityIndicator color={WATER} size="small" />
          </View>
        ) : water.lastId ? (
          <Pressable
            onPress={onUndo}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Undo the last drink"
            className="w-14 items-center py-2.5 active:opacity-60">
            <Text {...COMPACT_TEXT} className="text-sm font-semibold text-muted">
              Undo
            </Text>
          </Pressable>
        ) : (
          <View className="w-14" />
        )}
      </View>
    </View>
  );
}
