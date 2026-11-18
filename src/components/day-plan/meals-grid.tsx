import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Text, View, useWindowDimensions } from 'react-native';

import { SectionTitle } from '@/components/day-plan/section-title';
import { formatTime, type FormatOptions } from '@/lib/datetime';
import { MEAL_LABEL, type MyDay } from '@/lib/fitness-api';

const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const GAP = 8;

/** Meals the member logged that day, as a photo grid with the note under each. */
export function MealsGrid({ meals, format }: { meals: MyDay['meals']; format: FormatOptions }) {
  const { width } = useWindowDimensions();
  const tile = Math.floor((Math.min(width, 840) - 40 - GAP * 2) / 3);
  return (
    <View className="mb-5">
      <SectionTitle title="Meals logged" />
      {meals.length === 0 ? (
        <View className="mx-5 rounded-3xl border border-white/10 bg-card p-5">
          <Text {...COMPACT_TEXT} className="text-sm text-muted">
            No meals logged for this day.
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap px-5" style={{ gap: GAP }}>
          {meals.map((m) => (
            <View
              key={m.id}
              accessible
              accessibilityLabel={`${MEAL_LABEL[m.mealType]} at ${formatTime(new Date(m.eatenAt), format)}${m.note ? `. ${m.note}` : ''}`}
              style={{ width: tile }}>
              <View className="items-center justify-center overflow-hidden rounded-2xl bg-card-2" style={{ width: tile, height: tile }}>
                {m.photoUrl ? (
                  <Image source={{ uri: m.photoUrl }} contentFit="cover" style={{ width: tile, height: tile }} accessible={false} />
                ) : (
                  <SymbolView name={{ ios: 'fork.knife', android: 'restaurant_menu', web: 'restaurant_menu' }} tintColor="#8fa396" size={26} />
                )}
              </View>
              <Text {...COMPACT_TEXT} className="mt-1 text-xs font-bold text-white" numberOfLines={1}>
                {MEAL_LABEL[m.mealType]}
              </Text>
              {m.note ? (
                <Text {...COMPACT_TEXT} className="text-[11px] text-muted" numberOfLines={2}>
                  {m.note}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
