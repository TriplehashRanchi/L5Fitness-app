import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StepsCard } from '@/components/steps-card';
import { iconFor, type IconName } from '@/constants/icons';
import { BottomTabInset } from '@/constants/theme';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { useHome } from '@/hooks/use-home';
import {
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
import {
  bookClass,
  cancelBooking,
  LEVEL_LABEL,
  logWorkout,
  type GymClass,
} from '@/lib/fitness-api';
import { messageFrom } from '@/lib/http';
import {
  clearActiveWorkout,
  loadActiveWorkout,
  saveActiveWorkout,
  type ActiveWorkout,
} from '@/lib/storage';
import { useAuth } from '@/providers/auth-provider';

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

/** How each of today's three numbers looks. The values come from the member's workout log. */
const STAT_STYLE: { icon: IconName; color: string }[] = [
  {
    icon: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
    color: '#ff6b35',
  },
  { icon: { ios: 'timer', android: 'timer', web: 'timer' }, color: BRAND },
  { icon: { ios: 'heart.fill', android: 'favorite', web: 'favorite' }, color: '#ff4d6d' },
];

/** Card colours for the programs row, in order. */
const PROGRAM_BG = ['bg-brand', 'bg-accent', 'bg-violet-400'];

/** If "Finish" is pressed much later (the member forgot), count at most this long. */
const MAX_WORKOUT_MIN = 240;

/** Whole minutes from `start` until this moment. */
const minutesSince = (start: Date) => Math.round((Date.now() - start.getTime()) / 60_000);

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

function ClassRow({
  item,
  now,
  format,
  busy,
  onToggle,
}: {
  item: GymClass;
  now: Date;
  format: FormatOptions;
  busy: boolean;
  onToggle: () => void;
}) {
  const start = new Date(item.startsAt);
  const end = new Date(start.getTime() + item.durationMin * 60_000);
  const status = now >= end ? 'ended' : now >= start ? 'live' : 'upcoming';

  const localTime = formatTime(start, format);
  const gymTime = formatTime(start, { ...format, timeZone: GYM_TIME_ZONE });
  // Only show the gym time when the phone is set to a different zone (e.g. while travelling).
  const showGymTime = localTime !== gymTime;

  const spots =
    item.spotsLeft === 0 ? 'Full' : `${item.spotsLeft} ${item.spotsLeft === 1 ? 'spot' : 'spots'} left`;

  return (
    <View
      className={`flex-row items-center gap-4 rounded-2xl bg-card p-4 ${
        status === 'ended' ? 'opacity-50' : ''
      }`}>
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-card-2">
        <Icon name={iconFor(item.icon)} color={BRAND} size={22} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-white" numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-xs text-muted" numberOfLines={2}>
          {localTime} · {item.trainer} · {spots}
        </Text>
        {showGymTime ? (
          <Text className="text-[11px] text-muted/70" numberOfLines={1}>
            {gymTime} {GYM_TZ_LABEL} gym time
          </Text>
        ) : null}
      </View>
      {status === 'upcoming' ? (
        busy ? (
          <View className="px-4 py-2">
            <ActivityIndicator color={BRAND} />
          </View>
        ) : item.booked ? (
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={`Booked for ${item.name}. Tap to cancel.`}
            className="rounded-full border border-brand px-4 py-2 active:opacity-70">
            <Text {...COMPACT_TEXT} className="text-xs font-bold text-brand">
              Booked ✓
            </Text>
          </Pressable>
        ) : item.spotsLeft === 0 ? (
          <Text {...COMPACT_TEXT} className="text-xs font-semibold text-muted">
            Full
          </Text>
        ) : (
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={`Book ${item.name}`}
            className="rounded-full bg-brand px-4 py-2 active:opacity-80">
            <Text {...COMPACT_TEXT} className="text-xs font-bold text-ink">
              Book
            </Text>
          </Pressable>
        )
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
  const [category, setCategory] = useState('all');
  const { session, signOut } = useAuth();
  const userId = session?.user.id;
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

  // Everything below comes from the API: the member's own numbers and the gym's catalog.
  const { data, error, loading, refreshing, refresh, reload, setData } = useHome(
    toDayKey(today),
    toDayKey(week[0])
  );
  const plan = data?.plan ?? null;
  const completed = new Set(data?.week.daysTrained ?? []);
  const doneThisWeek = week.filter((d) => completed.has(toDayKey(d))).length;
  const weeklyGoal = data?.week.goal ?? 5;
  const classes = data?.classes ?? [];
  const categories = [{ slug: 'all', name: 'All' }, ...(data?.categories ?? [])];
  const programs = (data?.programs ?? []).filter((p) => category === 'all' || p.category === category);
  const stats = [
    { label: 'Calories', unit: 'kcal', value: data ? String(data.stats.calories) : '–' },
    { label: 'Workout', unit: 'min', value: data ? String(data.stats.minutes) : '–' },
    // Stays "–" until a heart-rate device is connected: the phone alone cannot measure it.
    { label: 'Heart', unit: 'bpm', value: data?.stats.avgHeartRate != null ? String(data.stats.avgHeartRate) : '–' },
  ];

  /** Which button is waiting on the server: 'workout' or a class id. */
  const [busy, setBusy] = useState<string | null>(null);
  /** A problem with the last action, shown at the top of the screen. */
  const [notice, setNotice] = useState<string | null>(null);

  // The workout in progress, if any. Kept on the device so it survives closing the app.
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadActiveWorkout(userId).then((saved) => {
      if (!cancelled) setActive(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const activeStart = active ? new Date(active.startedAt) : null;
  const elapsedMin = activeStart
    ? Math.max(0, Math.floor((now.getTime() - activeStart.getTime()) / 60_000))
    : 0;

  const startWorkout = async () => {
    if (!plan || !userId) return;
    const next: ActiveWorkout = {
      userId,
      workoutId: plan.id,
      title: plan.title,
      startedAt: new Date().toISOString(),
    };
    setNotice(null);
    setActive(next);
    await saveActiveWorkout(next);
  };

  const finishWorkout = async () => {
    if (!active || !activeStart) return;
    setBusy('workout');
    setNotice(null);
    const minutes = minutesSince(activeStart);
    try {
      await logWorkout({
        workoutId: active.workoutId,
        startedAt: active.startedAt,
        durationMin: Math.min(MAX_WORKOUT_MIN, Math.max(1, minutes)),
        // The calendar day it was started on, as the phone sees it.
        day: toDayKey(getZonedParts(activeStart, format.timeZone)),
      });
      setActive(null);
      await clearActiveWorkout();
      await reload();
    } catch (e) {
      // Keep the workout running so nothing is lost; the member can try again.
      setNotice(messageFrom(e));
    } finally {
      setBusy(null);
    }
  };

  const discardWorkout = async () => {
    setNotice(null);
    setActive(null);
    await clearActiveWorkout();
  };

  const toggleBooking = async (item: GymClass) => {
    setBusy(item.id);
    setNotice(null);
    try {
      const updated = item.booked
        ? await cancelBooking(item.id, item.date)
        : await bookClass(item.id, item.date);
      setData((prev) =>
        prev ? { ...prev, classes: prev.classes.map((c) => (c.id === updated.id ? updated : c)) } : prev
      );
    } catch (e) {
      setNotice(messageFrom(e));
      reload(); // e.g. the class just filled up: show the real number of spots
    } finally {
      setBusy(null);
    }
  };

  const message = notice ?? error;

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={BRAND}
            colors={[BRAND]}
            progressViewOffset={topPadding}
          />
        }
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

        {message ? (
          <View
            accessibilityRole="alert"
            className="mx-5 mb-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm text-white">{message}</Text>
            {error && !notice ? (
              <Text className="mt-0.5 text-xs text-muted">Pull down to try again.</Text>
            ) : null}
          </View>
        ) : null}

        {/* Hero: today's workout */}
        <View className="mx-5 overflow-hidden rounded-3xl bg-brand p-6">
          <View className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-dark opacity-60" />
          <View className="absolute -bottom-16 right-10 h-32 w-32 rounded-full bg-white opacity-20" />

          <View className="mb-3 self-start rounded-full bg-ink px-3 py-1">
            <Text
              {...COMPACT_TEXT}
              className="text-xs font-bold uppercase tracking-widest text-brand">
              {active ? 'In progress' : <>{formatWeekday(today, format.locale, 'long')}&apos;s plan</>}
            </Text>
          </View>
          <Text className="text-3xl font-black leading-tight text-ink">
            {active?.title ?? plan?.title ?? (loading ? 'Loading…' : 'Rest day')}
          </Text>
          <Text className="mt-2 text-sm font-medium text-ink/70">
            {active && activeStart
              ? `Started ${formatTime(activeStart, format)} · ${elapsedMin} min so far`
              : plan
                ? [
                    plan.exerciseCount ? `${plan.exerciseCount} exercises` : null,
                    `${plan.durationMin} min`,
                    `${plan.kcal} kcal`,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : loading
                  ? ' '
                  : 'No workout planned for today'}
          </Text>

          <View className="mt-5 flex-row flex-wrap items-center justify-between gap-3">
            <View className="flex-row items-center gap-4">
              <Pressable
                onPress={active ? finishWorkout : startWorkout}
                disabled={busy === 'workout' || (!active && !plan)}
                accessibilityRole="button"
                className={`flex-row items-center gap-2 rounded-full bg-ink px-5 py-3 active:opacity-80 ${
                  !active && !plan ? 'opacity-40' : ''
                }`}>
                {busy === 'workout' ? (
                  <ActivityIndicator color={BRAND} size="small" />
                ) : (
                  <Icon
                    name={
                      active
                        ? { ios: 'checkmark', android: 'check', web: 'check' }
                        : { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }
                    }
                    color={BRAND}
                    size={16}
                  />
                )}
                <Text {...COMPACT_TEXT} className="font-bold text-white">
                  {active ? 'Finish workout' : 'Start workout'}
                </Text>
              </Pressable>
              {active && busy !== 'workout' ? (
                <Pressable onPress={discardWorkout} hitSlop={10} accessibilityRole="button">
                  <Text {...COMPACT_TEXT} className="text-sm font-semibold text-ink/70 underline">
                    Cancel
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View className="items-end">
              <Text {...COMPACT_TEXT} className="text-2xl font-black text-ink">
                {data ? `${data.week.percent}%` : '–'}
              </Text>
              <Text {...COMPACT_TEXT} className="text-xs font-semibold text-ink/60">
                weekly goal
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View className="mt-5 flex-row gap-3 px-5">
          {stats.map((s, i) => (
            <View key={s.label} className="flex-1 rounded-2xl bg-card p-4">
              <View className="mb-3 h-9 w-9 items-center justify-center rounded-xl bg-card-2">
                <Icon name={STAT_STYLE[i].icon} color={STAT_STYLE[i].color} size={18} />
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

        {/* Steps from Apple Health / Health Connect */}
        <StepsCard now={now} locale={format.locale} />

        {/* Weekly streak: real current week, starting on the phone's first day of week */}
        <View className="mx-5 mt-5 rounded-3xl bg-card p-5">
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-base font-bold text-white">This week 🔥</Text>
              <Text className="text-xs text-muted">
                {doneThisWeek} of {weeklyGoal} workouts done
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
            {categories.map((c) => {
              const selected = c.slug === category;
              return (
                <Pressable
                  key={c.slug}
                  onPress={() => setCategory(c.slug)}
                  accessibilityState={{ selected }}
                  className={`rounded-full px-5 py-2.5 ${selected ? 'bg-white' : 'bg-card'}`}>
                  <Text
                    {...COMPACT_TEXT}
                    className={`text-sm font-semibold ${selected ? 'text-ink' : 'text-muted'}`}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="mt-4 gap-4 px-5">
            {programs.map((p, i) => (
              <Pressable
                key={p.id}
                className="w-60 overflow-hidden rounded-3xl bg-card active:opacity-80">
                <View
                  className={`h-32 items-center justify-center ${PROGRAM_BG[i % PROGRAM_BG.length]}`}>
                  <Icon name={iconFor(p.icon)} color={INK} size={56} />
                  <View className="absolute left-3 top-3 rounded-full bg-ink/80 px-2.5 py-1">
                    <Text {...COMPACT_TEXT} className="text-[10px] font-bold uppercase text-white">
                      {LEVEL_LABEL[p.level]}
                    </Text>
                  </View>
                </View>
                <View className="p-4">
                  <Text className="text-base font-bold text-white" numberOfLines={1}>
                    {p.title}
                  </Text>
                  <View className="mt-1 flex-row items-center justify-between">
                    <Text {...COMPACT_TEXT} className="text-xs text-muted">
                      {p.coach ?? ' '}
                    </Text>
                    <Text {...COMPACT_TEXT} className="text-xs font-semibold text-brand">
                      {p.durationMin} min
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          {data && programs.length === 0 ? (
            <Text className="mt-4 px-5 text-sm text-muted">No programs in this category yet.</Text>
          ) : null}
        </View>

        {/* Classes today */}
        <View className="mt-8">
          <SectionHeader title="Classes today" action="Schedule" />
          <View className="gap-3 px-5">
            {classes.map((c) => (
              <ClassRow
                key={c.id}
                item={c}
                now={now}
                format={format}
                busy={busy === c.id}
                onToggle={() => toggleBooking(c)}
              />
            ))}
            {data && classes.length === 0 ? (
              <Text className="text-sm text-muted">No classes today.</Text>
            ) : null}
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
