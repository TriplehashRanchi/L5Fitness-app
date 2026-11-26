import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ConfirmSheet } from '@/components/confirm-sheet';
import { formatTime, type FormatOptions } from '@/lib/datetime';
import { type Meal } from '@/lib/fitness-api';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const MUTED = '#8fa396';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** Today's meals, each with its photo, and a button to add one. */
export function MealsSection({
  meals,
  format,
  onDelete,
}: {
  /** null while Home is still loading */
  meals: Meal[] | null;
  format: FormatOptions;
  /** Resolves when the meal is gone (the section shows a spinner-free confirm box meanwhile) */
  onDelete: (id: string) => Promise<void>;
}) {
  const router = useRouter();
  const t = useT();
  const [toDelete, setToDelete] = useState<Meal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await onDelete(toDelete.id);
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <View className="mt-8">
      <View className="mb-4 flex-row items-center justify-between gap-3 px-5">
        <Text className="flex-1 text-xl font-bold text-white" numberOfLines={2}>
          {t('acc.mealsToday')}
        </Text>
        <Pressable
          onPress={() => router.push('/add-meal')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('acc.addAMeal')}
          className="flex-row items-center gap-1.5 rounded-full bg-brand px-4 py-2 active:opacity-80">
          <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} tintColor="#050a07" size={14} />
          <Text {...COMPACT_TEXT} className="text-xs font-bold text-ink">
            {t('meal.title')}
          </Text>
        </Pressable>
      </View>

      <View className="gap-3 px-5">
        {meals === null ? (
          <View className="h-20 rounded-2xl bg-card" accessibilityElementsHidden />
        ) : meals.length === 0 ? (
          <Pressable
            onPress={() => router.push('/add-meal')}
            accessibilityRole="button"
            className="items-center rounded-2xl border border-white/10 bg-card px-6 py-8 active:opacity-80">
            <SymbolView name={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }} tintColor={BRAND} size={26} />
            <Text className="mt-3 text-center text-base font-bold text-white">{t('acc.noMeals')}</Text>
            <Text className="mt-1 text-center text-sm text-muted">{t('acc.noMealsSub')}</Text>
          </Pressable>
        ) : (
          meals.map((meal) => (
            <View key={meal.id} className="flex-row items-center gap-4 rounded-2xl bg-card p-3">
              <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-card-2">
                {meal.photoUrl ? (
                  <Image
                    source={{ uri: meal.photoUrl }}
                    style={{ width: 64, height: 64 }}
                    contentFit="cover"
                    transition={150}
                    // The link changes on every load, so cache by the meal, not by the address.
                    cachePolicy="memory-disk"
                    recyclingKey={meal.id}
                    accessibilityLabel={t(`meal.${meal.mealType}`)}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <SymbolView name={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }} tintColor={MUTED} size={22} />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-white" numberOfLines={1}>
                  {t(`meal.${meal.mealType}`)}
                </Text>
                <Text {...COMPACT_TEXT} className="text-xs text-muted" numberOfLines={1}>
                  {formatTime(new Date(meal.eatenAt), format)}
                </Text>
                {meal.note ? (
                  <Text {...COMPACT_TEXT} className="mt-0.5 text-xs text-white/80" numberOfLines={2}>
                    {meal.note}
                  </Text>
                ) : null}
                {meal.kcalMin != null && meal.kcalMax != null ? (
                  <Text {...COMPACT_TEXT} className="mt-0.5 text-xs text-muted" numberOfLines={2}>
                    {t('meal.estimate', { min: meal.kcalMin, max: meal.kcalMax })}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => setToDelete(meal)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('acc.removeItem', { name: t(`meal.${meal.mealType}`) })}
                className="h-10 w-10 items-center justify-center rounded-full active:bg-card-2">
                <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} tintColor={MUTED} size={18} />
              </Pressable>
            </View>
          ))
        )}
      </View>

      <ConfirmSheet
        visible={toDelete !== null}
        title={t('acc.deleteMealTitle')}
        message={t('acc.deleteMealBody')}
        confirmLabel={t('acc.delete')}
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </View>
  );
}
