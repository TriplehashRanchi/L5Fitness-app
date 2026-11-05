import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useDeviceClock } from '@/hooks/use-device-clock';
import {
  addDays,
  formatLongDate,
  formatTime,
  formatWeekday,
  getGreeting,
  getWeekDays,
  getZonedParts,
  isSameDay,
  toDayKey,
  type CalendarDay,
  type FormatOptions,
} from '@/lib/datetime';
import { useAuth } from '@/providers/auth-provider';

type IconName = SymbolViewProps['name'];

const BRAND = '#c6f432';
const INK = '#0b0b0d';
const MUTED = '#8b8b94';

/** The gym's own time zone. Class times are set in this zone. */
const GYM_TIME_ZONE = 'Asia/Kolkata';
const GYM_TZ_LABEL = 'IST';

/** On web the tab bar sits at the top of the page instead of the bottom. */
const WEB_TOP_BAR = 72;

/** Keeps compact labels from overflowing when the user has very large system text. */
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

const STATS: { label: string; value: string; unit: string; icon: IconName; color: string }[] = [
  {
    label: 'Calories',
    value: '642',
    unit: 'kcal',
    icon: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
    color: '#ff6b35',
  },
  {
    label: 'Workout',
    value: '48',
    unit: 'min',
    icon: { ios: 'timer', android: 'timer', web: 'timer' },
    color: BRAND,
  },
  {
    label: 'Heart',
    value: '128',
    unit: 'bpm',
    icon: { ios: 'heart.fill', android: 'favorite', web: 'favorite' },
    color: '#ff4d6d',
  },
];

const CATEGORIES = ['All', 'Strength', 'Cardio', 'HIIT', 'Yoga', 'CrossFit', 'Boxing'];

const PROGRAMS: {
  title: string;
  coach: string;
  duration: string;
  level: string;
  icon: IconName;
  bg: string;
}[] = [
  {
    title: 'Full Body Burn',
    coach: 'Coach Arjun',
    duration: '45 min',
    level: 'Intermediate',
    icon: {
      ios: 'figure.strengthtraining.traditional',
      android: 'fitness_center',
      web: 'fitness_center',
    },
    bg: 'bg-brand',
  },
  {
    title: 'Morning Cardio',
    coach: 'Coach Priya',
    duration: '30 min',
    level: 'Beginner',
    icon: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' },
    bg: 'bg-accent',
  },
  {
    title: 'Power Yoga',
    coach: 'Coach Neha',
    duration: '40 min',
    level: 'All levels',
    icon: { ios: 'figure.yoga', android: 'self_improvement', web: 'self_improvement' },
    bg: 'bg-violet-400',
  },
];

type GymClass = {
  id: string;
  name: string;
  trainer: string;
  spots: number;
  /** Absolute start time as ISO with offset, the same way the API should send it. */
  startsAt: string;
  durationMin: number;
  icon: IconName;
};

/**
 * Sample data. Builds today's classes at fixed gym times (IST, +05:30).
 * Replace with the API response, which should carry ISO strings with an offset or `Z`.
 */
function getSampleClasses(now: Date): GymClass[] {
  const gymToday = toDayKey(getZonedParts(now, GYM_TIME_ZONE));
  const at = (hhmm: string) => `${gymToday}T${hhmm}:00+05:30`;
  return [
    {
      id: 'hiit',
      name: 'HIIT Blast',
      trainer: 'Rahul S.',
      spots: 4,
      startsAt: at('06:30'),
      durationMin: 45,
      icon: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
    },
    {
      id: 'strength',
      name: 'Strength Lab',
      trainer: 'Arjun K.',
      spots: 2,
      startsAt: at('08:00'),
      durationMin: 60,
      icon: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
    },
    {
      id: 'boxing',
      name: 'Boxing Basics',
      trainer: 'Vikram R.',
      spots: 8,
      startsAt: at('18:30'),
      durationMin: 50,
      icon: { ios: 'figure.boxing', android: 'sports_mma', web: 'sports_mma' },
    },
  ];
}

/** Sample workout log: the 3 days before today. Replace with real check-in dates. */
function getSampleCompletedDays(today: CalendarDay): Set<string> {
  return new Set([1, 2, 3].map((n) => toDayKey(addDays(today, -n))));
}

function Icon({ name, color, size = 20 }: { name: IconName; color: string; size?: number }) {
  return <SymbolView name={name} tintColor={color} size={size} />;
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View className="mb-4 flex-row items-center justify-between gap-3 px-5">
      <Text className="flex-1 text-xl font-bold text-white" numberOfLines={1}>
        {title}
      </Text>
      {action ? (
        <Pressable hitSlop={8} className="active:opacity-60">
          <Text {...COMPACT_TEXT} className="text-sm font-semibold text-brand">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ClassRow({ item, now, format }: { item: GymClass; now: Date; format: FormatOptions }) {
  const start = new Date(item.startsAt);
  const end = new Date(start.getTime() + item.durationMin * 60_000);
  const status = now >= end ? 'ended' : now >= start ? 'live' : 'upcoming';

  const localTime = formatTime(start, format);
  const gymTime = formatTime(start, { ...format, timeZone: GYM_TIME_ZONE });
  // Only show the gym time when the phone is set to a different zone (e.g. while travelling).
  const showGymTime = localTime !== gymTime;

  return (
    <View
      className={`flex-row items-center gap-4 rounded-2xl bg-card p-4 ${
        status === 'ended' ? 'opacity-50' : ''
      }`}>
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-card-2">
        <Icon name={item.icon} color={BRAND} size={22} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-white" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-xs text-muted" numberOfLines={2}>
          {localTime} · {item.trainer} · {item.spots} spots left
        </Text>
        {showGymTime ? (
          <Text className="text-[11px] text-muted/70" numberOfLines={1}>
            {gymTime} {GYM_TZ_LABEL} gym time
          </Text>
        ) : null}
      </View>
      {status === 'upcoming' ? (
        <Pressable className="rounded-full bg-brand px-4 py-2 active:opacity-80">
          <Text {...COMPACT_TEXT} className="text-xs font-bold text-ink">
            Book
          </Text>
        </Pressable>
      ) : status === 'live' ? (
        <View className="flex-row items-center gap-1.5 rounded-full bg-accent/20 px-3 py-2">
          <View className="h-1.5 w-1.5 rounded-full bg-accent" />
          <Text {...COMPACT_TEXT} className="text-xs font-bold text-accent">
            Live
          </Text>
        </View>
      ) : (
        <Text {...COMPACT_TEXT} className="text-xs font-semibold text-muted">
          Ended
        </Text>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { now, format, firstWeekday } = useDeviceClock();
  const [category, setCategory] = useState('All');
  const { session, signOut } = useAuth();
  const userName = session?.user.name ?? 'Athlete';
  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || 'L5';

  const onAvatarPress = () =>
    Alert.alert(userName, session?.user.email, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => signOut() },
    ]);

  // Everything "today" is computed in the phone's time zone.
  const nowParts = getZonedParts(now, format.timeZone);
  const today: CalendarDay = nowParts;
  const week = getWeekDays(today, firstWeekday);
  const completed = getSampleCompletedDays(today);
  const doneThisWeek = week.filter((d) => completed.has(toDayKey(d))).length;
  const classes = getSampleClasses(now);

  const isWeb = Platform.OS === 'web';
  const topPadding = insets.top + (isWeb ? WEB_TOP_BAR : 8);
  // Content scrolls behind the tab bar, so leave room for the bar and the home indicator / nav bar.
  const bottomPadding = insets.bottom + (isWeb ? 0 : BottomTabInset) + 24;

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: topPadding,
          paddingBottom: bottomPadding,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}
        scrollIndicatorInsets={{ top: insets.top, bottom: bottomPadding - 24 }}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="flex-row items-center justify-between gap-3 px-5 pb-6">
          <View className="flex-1 flex-row items-center gap-3">
            <Pressable
              onPress={onAvatarPress}
              accessibilityRole="button"
              accessibilityLabel="Account"
              className="h-12 w-12 items-center justify-center rounded-full bg-brand active:opacity-80">
              <Text {...COMPACT_TEXT} className="text-lg font-black text-ink">
                {initials}
              </Text>
            </Pressable>
            <View className="flex-1">
              <Text className="text-sm text-muted" numberOfLines={1}>
                {formatLongDate(now, format)}
              </Text>
              <Text className="text-lg font-bold text-white" numberOfLines={1}>
                {getGreeting(nowParts.hour)}, {userName.split(' ')[0]} 👋
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityLabel="Notifications"
            className="h-11 w-11 items-center justify-center rounded-full bg-card active:opacity-70">
            <Icon
              name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
              color="white"
            />
            <View className="absolute right-3 top-3 h-2 w-2 rounded-full bg-accent" />
          </Pressable>
        </View>

        {/* Hero: today's workout */}
        <View className="mx-5 overflow-hidden rounded-3xl bg-brand p-6">
          <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-dark opacity-60" />
          <View className="absolute -bottom-16 right-10 h-32 w-32 rounded-full bg-white opacity-20" />

          <View className="mb-3 self-start rounded-full bg-ink px-3 py-1">
            <Text
              {...COMPACT_TEXT}
              className="text-xs font-bold uppercase tracking-widest text-brand">
              {formatWeekday(today, format.locale, 'long')}&apos;s plan
            </Text>
          </View>
          <Text className="text-3xl font-black leading-tight text-ink">
            {'Chest &\nTriceps Day'}
          </Text>
          <Text className="mt-2 text-sm font-medium text-ink/70">
            8 exercises · 52 min · 480 kcal
          </Text>

          <View className="mt-5 flex-row flex-wrap items-center justify-between gap-3">
            <Pressable className="flex-row items-center gap-2 rounded-full bg-ink px-5 py-3 active:opacity-80">
              <Icon
                name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
                color={BRAND}
                size={16}
              />
              <Text {...COMPACT_TEXT} className="font-bold text-white">
                Start workout
              </Text>
            </Pressable>
            <View className="items-end">
              <Text {...COMPACT_TEXT} className="text-2xl font-black text-ink">
                65%
              </Text>
              <Text {...COMPACT_TEXT} className="text-xs font-semibold text-ink/60">
                weekly goal
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View className="mt-5 flex-row gap-3 px-5">
          {STATS.map((s) => (
            <View key={s.label} className="flex-1 rounded-2xl bg-card p-4">
              <View className="mb-3 h-9 w-9 items-center justify-center rounded-xl bg-card-2">
                <Icon name={s.icon} color={s.color} size={18} />
              </View>
              <View className="flex-row items-baseline gap-1">
                <Text
                  {...COMPACT_TEXT}
                  className="text-2xl font-black text-white"
                  numberOfLines={1}
                  adjustsFontSizeToFit>
                  {s.value}
                </Text>
                <Text {...COMPACT_TEXT} className="text-xs font-semibold text-muted">
                  {s.unit}
                </Text>
              </View>
              <Text {...COMPACT_TEXT} className="mt-0.5 text-xs text-muted" numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Weekly streak: real current week, starting on the phone's first day of week */}
        <View className="mx-5 mt-5 rounded-3xl bg-card p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-base font-bold text-white">This week 🔥</Text>
              <Text className="text-xs text-muted">
                {doneThisWeek} of 5 workouts done
              </Text>
            </View>
            <Text {...COMPACT_TEXT} className="text-2xl font-black text-brand">
              {doneThisWeek}
            </Text>
          </View>
          <View className="flex-row justify-between">
            {week.map((d) => {
              const key = toDayKey(d);
              const done = completed.has(key);
              const isToday = isSameDay(d, today);
              return (
                <View key={key} className="flex-1 items-center gap-2">
                  <Text
                    {...COMPACT_TEXT}
                    className={`text-[11px] ${isToday ? 'font-bold text-white' : 'text-muted'}`}>
                    {formatWeekday(d, format.locale, 'short')}
                  </Text>
                  <View
                    className={`h-9 w-9 items-center justify-center rounded-full ${
                      done
                        ? 'bg-brand'
                        : isToday
                          ? 'border-2 border-brand bg-transparent'
                          : 'bg-card-2'
                    }`}>
                    {done ? (
                      <Icon
                        name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                        color={INK}
                        size={14}
                      />
                    ) : (
                      <Text
                        {...COMPACT_TEXT}
                        className={`text-xs font-bold ${isToday ? 'text-brand' : 'text-muted'}`}>
                        {d.day}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Categories + programs */}
        <View className="mt-8">
          <SectionHeader title="Programs" action="See all" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-5">
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  accessibilityState={{ selected: active }}
                  className={`rounded-full px-5 py-2.5 ${active ? 'bg-white' : 'bg-card'}`}>
                  <Text
                    {...COMPACT_TEXT}
                    className={`text-sm font-semibold ${active ? 'text-ink' : 'text-muted'}`}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="mt-4 gap-4 px-5">
            {PROGRAMS.map((p) => (
              <Pressable
                key={p.title}
                className="w-60 overflow-hidden rounded-3xl bg-card active:opacity-80">
                <View className={`h-32 items-center justify-center ${p.bg}`}>
                  <Icon name={p.icon} color={INK} size={56} />
                  <View className="absolute left-3 top-3 rounded-full bg-ink/80 px-2.5 py-1">
                    <Text {...COMPACT_TEXT} className="text-[10px] font-bold uppercase text-white">
                      {p.level}
                    </Text>
                  </View>
                </View>
                <View className="p-4">
                  <Text className="text-base font-bold text-white" numberOfLines={1}>
                    {p.title}
                  </Text>
                  <View className="mt-1 flex-row items-center justify-between">
                    <Text {...COMPACT_TEXT} className="text-xs text-muted">
                      {p.coach}
                    </Text>
                    <Text {...COMPACT_TEXT} className="text-xs font-semibold text-brand">
                      {p.duration}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Classes today */}
        <View className="mt-8">
          <SectionHeader title="Classes today" action="Schedule" />
          <View className="gap-3 px-5">
            {classes.map((c) => (
              <ClassRow key={c.id} item={c} now={now} format={format} />
            ))}
          </View>
        </View>

        {/* Membership CTA */}
        <Pressable className="mx-5 mt-8 flex-row items-center gap-4 rounded-3xl border border-brand/30 bg-card p-5 active:opacity-80">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent">
            <Icon
              name={{ ios: 'crown.fill', android: 'workspace_premium', web: 'workspace_premium' }}
              color="white"
              size={26}
            />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold text-white">Go L5 Premium</Text>
            <Text className="text-xs text-muted">
              Personal trainer, diet plans & unlimited classes
            </Text>
          </View>
          <Icon
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            color={MUTED}
            size={16}
          />
        </Pressable>
      </ScrollView>

      {/* Solid strip behind the status bar / notch so scrolled content never sits under the clock */}
      {!isWeb ? (
        <View
          className="absolute left-0 right-0 top-0 bg-ink/95"
          style={{ height: insets.top, pointerEvents: 'none' }}
        />
      ) : null}
    </View>
  );
}
