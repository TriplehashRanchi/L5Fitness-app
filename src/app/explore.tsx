import { useFocusEffect, useRouter } from 'expo-router';
import { DisplayText } from '@/components/display-text';
import { GreenBackground } from '@/components/green-background';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoryIcon, iconFor } from '@/constants/icons';
import {
  LEVEL_LABEL_KEY,
  listCategories,
  listWorkouts,
  type Category,
  type Workout,
} from '@/lib/fitness-api';
import { messageFrom } from '@/lib/http';
import { useLanguage } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const MUTED = '#8fa396';

/** Tile colours for the category grid, in order. */
const TILE_STYLE = [{ bg: 'bg-card', fg: BRAND }];

export default function ExploreScreen() {
  const { language, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);

  // The catalog is small, so it is loaded once per visit and searched on the phone (instant).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([listWorkouts(), listCategories()])
        .then(([nextWorkouts, nextCategories]) => {
          if (cancelled) return;
          setWorkouts(nextWorkouts);
          setCategories(nextCategories);
          setError(null);
        })
        .catch((e) => {
          if (!cancelled) setError(messageFrom(e));
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const q = query.trim().toLowerCase();
  const categoryName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? '';
  const all = workouts ?? [];
  const results = q
    ? all.filter((w) =>
        `${w.title} ${w.focus ?? ''} ${t(LEVEL_LABEL_KEY[w.level])} ${categoryName(w.category)}`
          .toLowerCase()
          .includes(q)
      )
    : all;
  // Only categories that have workouts get a tile.
  const tiles = categories.filter((c) => c.count > 0);

  return (
    <View className="flex-1 bg-ink">
      <GreenBackground />
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          width: '100%', maxWidth: 840, alignSelf: 'center',
          paddingBottom: insets.bottom + 24,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}>
        <View className="px-5">
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            className="mb-4 h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-70">
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor="white" />
          </Pressable>
          <DisplayText accessibilityRole="header" className="text-[30px] font-bold tracking-tight text-white">{t('acc.findWorkout')}</DisplayText>
          <Text className="mt-2 text-sm leading-5 text-muted">{t('acc.findSub')}</Text>

          {/* Search */}
          <View className="mt-5 h-14 flex-row items-center gap-3 rounded-2xl border border-white/10 bg-card px-5">
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              size={18}
              tintColor={MUTED}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('acc.searchPlaceholder')}
              placeholderTextColor="#6f8577"
              selectionColor={BRAND}
              cursorColor={BRAND}
              accessibilityLabel={t('acc.searchWorkouts')}
              returnKeyType="search"
              autoCorrect={false}
              maxFontSizeMultiplier={1.4}
              className="h-full flex-1 text-base text-white"
            />
            {query ? (
              <Pressable hitSlop={10} onPress={() => setQuery('')} accessibilityLabel={t('acc.clearSearch')}>
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={18}
                  tintColor={MUTED}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        {error ? (
          <View
            accessibilityRole="alert"
            className="mx-5 mt-5 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm text-white">{error}</Text>
          </View>
        ) : null}

        {/* Categories */}
        {!q && tiles.length > 0 ? (
          <View className="mt-7 px-5">
            <Text className="mb-4 text-xl font-bold text-white">{t('acc.categories')}</Text>
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {tiles.map((c, i) => {
                const { bg, fg } = TILE_STYLE[i % TILE_STYLE.length];
                const count = t(c.count === 1 ? 'acc.workoutsOne' : 'acc.workoutsMany', { n: c.count });
                return (
                  <Pressable
                    key={c.slug}
                    // Tapping a category searches for it.
                    onPress={() => setQuery(c.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.name}, ${count}`}
                    className={`w-[48.5%] overflow-hidden rounded-2xl border border-white/5 p-4 active:opacity-80 ${bg}`}
                    style={{ minHeight: 132 }}>
                    <SymbolView name={categoryIcon(c.slug)} size={24} tintColor={fg} />
                    <View className="mt-5">
                      <Text
                        maxFontSizeMultiplier={1.3}
                        className="text-base font-semibold"
                        style={{ color: '#ffffff' }}>
                        {c.name}
                      </Text>
                      <Text maxFontSizeMultiplier={1.3} className="text-xs font-semibold" style={{ color: MUTED }}>
                        {count}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Workouts */}
        <View className="mt-8 px-5">
          <Text className="mb-4 text-xl font-bold text-white">
            {q ? t('acc.results', { n: results.length }) : t('acc.allWorkouts')}
          </Text>
          <View className="gap-3">
            {results.map((w) => (
              <Pressable
                key={w.id}
                accessibilityRole="text"
                accessibilityLabel={w.title}
                className="flex-row items-center gap-4 rounded-2xl bg-card p-4 active:opacity-80">
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-card-2">
                  <SymbolView name={iconFor(w.icon)} size={24} tintColor={BRAND} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-white" numberOfLines={2}>
                    {w.title}
                  </Text>
                  <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
                    {[t('acc.minutes', { n: w.durationMin }), w.focus].filter(Boolean).join(' · ')}
                  </Text>
                  <Text maxFontSizeMultiplier={1.3} className={`mt-1.5 text-[11px] font-bold uppercase text-brand ${language === 'en' ? 'tracking-wider' : ''}`}>
                    {t(LEVEL_LABEL_KEY[w.level])}
                  </Text>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={14}
                  tintColor={MUTED}
                />
              </Pressable>
            ))}
            {workouts === null && !error ? (
              <Text className="py-6 text-center text-sm text-muted">{t('acc.loadingWorkouts')}</Text>
            ) : null}
            {workouts !== null && results.length === 0 ? (
              <View className="items-center rounded-2xl bg-card px-6 py-10">
                <Text className="text-center text-base font-bold text-white">{t('acc.noWorkouts')}</Text>
                <Text className="mt-1 text-center text-sm text-muted">{t('acc.tryWord')}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
