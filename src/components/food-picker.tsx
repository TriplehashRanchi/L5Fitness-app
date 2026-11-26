import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import {
  estimateItem,
  estimatePlate,
  nameOf,
  searchFoods,
  type Coconut,
  type Food,
  type Oil,
  type PlateItem,
} from '@/lib/foods-api';
import { en, type Key } from '@/lib/i18n';
import { useLanguage } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const SOFT = 'rgba(255,255,255,0.08)';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const OILS: Oil[] = ['light', 'usual', 'heavy'];
const COCONUTS: Coconut[] = ['none', 'usual', 'extra'];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      className="items-center justify-center rounded-full active:opacity-80"
      style={{ minHeight: 36, paddingHorizontal: 14, backgroundColor: on ? '#1a8f40' : SOFT }}>
      <Text {...COMPACT_TEXT} className="font-semibold" style={{ fontSize: 13, color: on ? '#ffffff' : 'rgba(255,255,255,0.65)' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * "What did you eat?": search the food library in any language, then say how much, and how it was made (oil,
 * coconut). The calories shown are always a range, because a household portion is never exact.
 */
export function FoodPicker({
  foods,
  byId,
  items,
  onChange,
  disabled,
}: {
  foods: Food[];
  byId: Map<string, Food>;
  items: PlateItem[];
  onChange: (items: PlateItem[]) => void;
  disabled?: boolean;
}) {
  const { language, t } = useLanguage();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchFoods(foods, query), [foods, query]);
  const total = useMemo(() => estimatePlate(byId, items), [byId, items]);
  /** The portion's name by its code; a code the app does not know yet is shown as the server sends it. */
  const unitName = (unit: string) => (`unit.${unit}` in en ? t(`unit.${unit}` as Key) : unit);

  const add = (food: Food) => {
    onChange([...items, { foodId: food.id, portionId: food.portions[0].id, count: 1, oil: 'usual', coconut: 'usual' }]);
    setQuery('');
  };
  const change = (index: number, patch: Partial<PlateItem>) => onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        editable={!disabled}
        placeholder={t('meal.search')}
        placeholderTextColor="#6f8577"
        selectionColor={BRAND}
        cursorColor={BRAND}
        autoCorrect={false}
        maxFontSizeMultiplier={1.4}
        accessibilityLabel={t('meal.search')}
        className="px-4 text-base text-white"
        style={{ minHeight: 52, backgroundColor: SOFT, borderRadius: 18 }}
      />
      {query.trim() ? (
        <View style={{ marginTop: 8, borderRadius: 18, backgroundColor: SOFT, overflow: 'hidden' }}>
          {results.length === 0 ? (
            <Text {...COMPACT_TEXT} className="px-4 py-3 text-muted" style={{ fontSize: 14 }}>
              {t('meal.noFoods')}
            </Text>
          ) : (
            results.map((food, i) => (
              <Pressable
                key={food.id}
                onPress={() => add(food)}
                accessibilityRole="button"
                accessibilityLabel={t('acc.addItem', { name: nameOf(food, language) })}
                className="flex-row items-center active:opacity-70"
                style={{ gap: 10, minHeight: 50, paddingHorizontal: 16, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: HAIRLINE }}>
                <View className="flex-1">
                  <Text {...COMPACT_TEXT} className="font-semibold text-white" style={{ fontSize: 15 }}>
                    {nameOf(food, language)}
                  </Text>
                  {language !== 'en' ? (
                    <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12 }}>
                      {food.names.en}
                    </Text>
                  ) : null}
                </View>
                <SymbolView name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} tintColor={BRAND} size={22} />
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      {items.map((item, index) => {
        const food = byId.get(item.foodId);
        if (!food) return null;
        const range = estimateItem(food, item);
        return (
          <View key={`${item.foodId}-${index}`} style={{ marginTop: 14, padding: 14, borderRadius: 20, backgroundColor: SOFT }}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <Text {...COMPACT_TEXT} className="flex-1 font-bold text-white" style={{ fontSize: 16 }}>
                {nameOf(food, language)}
              </Text>
              <Pressable
                onPress={() => onChange(items.filter((_, i) => i !== index))}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('acc.removeItem', { name: nameOf(food, language) })}
                className="h-9 w-9 items-center justify-center rounded-full active:opacity-70"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor="white" size={13} />
              </Pressable>
            </View>

            {/* How much: a portion (if the food has more than one) and a count in halves */}
            <View className="flex-row items-center" style={{ gap: 12, marginTop: 12 }}>
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Pressable
                  onPress={() => change(index, { count: Math.max(0.5, item.count - 0.5) })}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('meal.howMany')}: −`}
                  className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <SymbolView name={{ ios: 'minus', android: 'remove', web: 'remove' }} tintColor="white" size={14} />
                </Pressable>
                <Text {...COMPACT_TEXT} accessibilityLabel={`${t('meal.howMany')}: ${item.count}`} className="text-center font-black text-white" style={{ minWidth: 44, fontSize: 20 }}>
                  {item.count}
                </Text>
                <Pressable
                  onPress={() => change(index, { count: Math.min(10, item.count + 0.5) })}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('meal.howMany')}: +`}
                  className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor="white" size={14} />
                </Pressable>
              </View>
              <View className="flex-1 flex-row flex-wrap" style={{ gap: 6 }}>
                {food.portions.map((p) =>
                  food.portions.length > 1 ? (
                    <Chip key={p.id} label={unitName(p.unit)} on={item.portionId === p.id} onPress={() => change(index, { portionId: p.id })} />
                  ) : (
                    <Text key={p.id} {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14 }}>
                      {unitName(p.unit)}
                    </Text>
                  )
                )}
              </View>
            </View>

            {food.oilMatters ? (
              <View style={{ marginTop: 12 }}>
                <Text {...COMPACT_TEXT} className="mb-1.5 text-muted" style={{ fontSize: 12 }}>
                  {t('meal.oil')}
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {OILS.map((o) => (
                    <Chip key={o} label={t(`oil.${o}`)} on={item.oil === o} onPress={() => change(index, { oil: o })} />
                  ))}
                </View>
              </View>
            ) : null}
            {food.coconutMatters ? (
              <View style={{ marginTop: 10 }}>
                <Text {...COMPACT_TEXT} className="mb-1.5 text-muted" style={{ fontSize: 12 }}>
                  {t('meal.coconut')}
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {COCONUTS.map((c) => (
                    <Chip key={c} label={t(`coconut.${c}`)} on={item.coconut === c} onPress={() => change(index, { coconut: c })} />
                  ))}
                </View>
              </View>
            ) : null}
            {range ? (
              <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
                {t('meal.estimate', { min: range.kcalMin, max: range.kcalMax })}
              </Text>
            ) : null}
          </View>
        );
      })}

      {items.length ? (
        <View style={{ marginTop: 14, padding: 14, borderRadius: 20, backgroundColor: 'rgba(61,220,104,0.1)' }}>
          <Text {...COMPACT_TEXT} accessibilityRole="summary" className="font-black" style={{ color: BRAND, fontSize: 18 }}>
            {t('meal.estimate', { min: total.kcalMin, max: total.kcalMax })}
          </Text>
          <Text {...COMPACT_TEXT} className="text-white" style={{ fontSize: 14, marginTop: 2 }}>
            {t('meal.protein', { min: total.proteinMin, max: total.proteinMax })}
          </Text>
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
            {t('meal.estimateNote')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

