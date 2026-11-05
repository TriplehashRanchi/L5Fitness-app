import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';

type IconName = SymbolViewProps['name'];

const BRAND = '#c6f432';
const INK = '#0b0b0d';
const MUTED = '#8b8b94';
const WEB_TOP_BAR = 72;

const CATEGORIES: { name: string; count: number; icon: IconName; bg: string; fg: string }[] = [
  {
    name: 'Strength',
    count: 42,
    icon: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
    bg: 'bg-brand',
    fg: INK,
  },
  {
    name: 'Cardio',
    count: 28,
    icon: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' },
    bg: 'bg-accent',
    fg: '#ffffff',
  },
  {
    name: 'Yoga',
    count: 19,
    icon: { ios: 'figure.yoga', android: 'self_improvement', web: 'self_improvement' },
    bg: 'bg-violet-400',
    fg: INK,
  },
  {
    name: 'Boxing',
    count: 12,
    icon: { ios: 'figure.boxing', android: 'sports_mma', web: 'sports_mma' },
    bg: 'bg-sky-400',
    fg: INK,
  },
];

const WORKOUTS: { title: string; meta: string; level: string; icon: IconName }[] = [
  {
    title: 'Push Day Power',
    meta: '45 min · Chest, Shoulders',
    level: 'Intermediate',
    icon: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
  },
  {
    title: 'Leg Day Destroyer',
    meta: '50 min · Quads, Glutes',
    level: 'Advanced',
    icon: { ios: 'figure.strengthtraining.functional', android: 'sports_gymnastics', web: 'sports_gymnastics' },
  },
  {
    title: '20 Min Fat Burn',
    meta: '20 min · Full body HIIT',
    level: 'Beginner',
    icon: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  },
  {
    title: 'Core Crusher',
    meta: '15 min · Abs, Obliques',
    level: 'All levels',
    icon: { ios: 'figure.core.training', android: 'accessibility_new', web: 'accessibility_new' },
  },
  {
    title: 'Morning Mobility',
    meta: '25 min · Stretch, Recovery',
    level: 'Beginner',
    icon: { ios: 'figure.flexibility', android: 'self_improvement', web: 'self_improvement' },
  },
];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const isWeb = Platform.OS === 'web';
  const q = query.trim().toLowerCase();
  const results = q
    ? WORKOUTS.filter((w) => `${w.title} ${w.meta} ${w.level}`.toLowerCase().includes(q))
    : WORKOUTS;

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + (isWeb ? WEB_TOP_BAR : 12),
          paddingBottom: insets.bottom + (isWeb ? 0 : BottomTabInset) + 24,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}>
        <View className="px-5">
          <Text className="text-sm font-semibold uppercase tracking-[3px] text-brand">Explore</Text>
          <Text className="mt-1 text-3xl font-black text-white">Find your workout</Text>

          {/* Search */}
          <View className="mt-5 h-14 flex-row items-center gap-3 rounded-full border border-white/10 bg-card px-5">
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              size={18}
              tintColor={MUTED}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search workouts, muscles…"
              placeholderTextColor="#5c5c66"
              selectionColor={BRAND}
              cursorColor={BRAND}
              returnKeyType="search"
              autoCorrect={false}
              maxFontSizeMultiplier={1.4}
              className="h-full flex-1 text-base text-white"
            />
            {query ? (
              <Pressable hitSlop={10} onPress={() => setQuery('')} accessibilityLabel="Clear search">
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  size={18}
                  tintColor={MUTED}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Categories */}
        {!q ? (
          <View className="mt-7 px-5">
            <Text className="mb-4 text-xl font-bold text-white">Categories</Text>
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.name}
                  className={`w-[48.5%] overflow-hidden rounded-3xl p-4 active:opacity-80 ${c.bg}`}
                  style={{ aspectRatio: 1.25 }}>
                  <View className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-black/10" />
                  <SymbolView name={c.icon} size={28} tintColor={c.fg} />
                  <View className="mt-auto">
                    <Text
                      maxFontSizeMultiplier={1.3}
                      className="text-lg font-black"
                      style={{ color: c.fg }}>
                      {c.name}
                    </Text>
                    <Text maxFontSizeMultiplier={1.3} className="text-xs font-semibold" style={{ color: c.fg, opacity: 0.7 }}>
                      {c.count} workouts
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Workouts */}
        <View className="mt-8 px-5">
          <Text className="mb-4 text-xl font-bold text-white">
            {q ? `Results (${results.length})` : 'Popular workouts'}
          </Text>
          <View className="gap-3">
            {results.map((w) => (
              <Pressable
                key={w.title}
                className="flex-row items-center gap-4 rounded-2xl bg-card p-4 active:opacity-80">
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-card-2">
                  <SymbolView name={w.icon} size={24} tintColor={BRAND} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-white" numberOfLines={1}>
                    {w.title}
                  </Text>
                  <Text className="mt-0.5 text-xs text-muted" numberOfLines={1}>
                    {w.meta}
                  </Text>
                  <Text maxFontSizeMultiplier={1.3} className="mt-1.5 text-[11px] font-bold uppercase tracking-wider text-brand">
                    {w.level}
                  </Text>
                </View>
                <SymbolView
                  name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                  size={14}
                  tintColor={MUTED}
                />
              </Pressable>
            ))}
            {results.length === 0 ? (
              <View className="items-center rounded-2xl bg-card px-6 py-10">
                <Text className="text-base font-bold text-white">No workouts found</Text>
                <Text className="mt-1 text-center text-sm text-muted">Try another word, like “legs” or “HIIT”.</Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
