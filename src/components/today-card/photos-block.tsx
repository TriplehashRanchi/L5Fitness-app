import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { BRAND, COMPACT_TEXT, Section } from '@/components/today-card/ui';
import { MEAL_LABEL_KEY, type Meal } from '@/lib/fitness-api';
import { useT } from '@/providers/language-provider';

const CAMERA = { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' } as const;
const THUMB = 52;

/** Today's meal photos in a row, ending in a dashed tile that adds one. */
export function PhotosBlock({ meals, onAdd }: { meals: Meal[]; onAdd: () => void }) {
  const t = useT();
  const count = meals.length;
  const shown = meals.slice(0, 4);
  const extra = count - shown.length;
  return (
    <Section icon={CAMERA} title={t('hm.mealPhotos')} status={count > 0 ? t('hm.sent', { n: count }) : undefined} done={count > 0}>
      <View className="flex-row items-center gap-2">
        {shown.map((m) => (
          <View
            key={m.id}
            accessible
            accessibilityLabel={t('hm.mealPhoto', { meal: t(MEAL_LABEL_KEY[m.mealType]) })}
            className="items-center justify-center overflow-hidden rounded-xl bg-card-2"
            style={{ width: THUMB, height: THUMB }}>
            {m.photoUrl ? (
              <Image source={{ uri: m.photoUrl }} contentFit="cover" style={{ width: THUMB, height: THUMB }} accessible={false} />
            ) : (
              <SymbolView name={{ ios: 'fork.knife', android: 'restaurant_menu', web: 'restaurant_menu' }} tintColor="#8fa396" size={18} />
            )}
          </View>
        ))}
        {extra > 0 ? (
          <Text {...COMPACT_TEXT} className="text-sm font-bold" style={{ color: BRAND }}>
            +{extra}
          </Text>
        ) : null}
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t('hm.addMealPhoto')}
          className="flex-row items-center justify-center gap-1.5 rounded-xl active:opacity-70"
          style={{ height: THUMB, minWidth: THUMB, paddingHorizontal: count === 0 ? 16 : 0, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(61,220,104,0.5)' }}>
          <SymbolView name={count === 0 ? CAMERA : { ios: 'plus', android: 'add', web: 'add' }} tintColor={BRAND} size={17} />
          {count === 0 ? (
            <Text {...COMPACT_TEXT} className="text-sm font-bold text-brand">
              {t('hm.addPhoto')}
            </Text>
          ) : null}
        </Pressable>
      </View>
    </Section>
  );
}
