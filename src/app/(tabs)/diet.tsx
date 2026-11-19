import { DisplayText } from '@/components/display-text';
import { PageHeading } from '@/components/page-heading';
import { GreenBackground } from '@/components/green-background';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClientsList } from '@/components/clients-list';
import { WeekPicker } from '@/components/day-plan/week-picker';
import { BottomTabInset } from '@/constants/theme';
import { useForegroundReload } from '@/hooks/use-foreground-reload';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { formatLongDate, getWeekDays, getZonedParts, toDayKey, type CalendarDay } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import {
  getDiet,
  SLOT_LABEL,
  SLOT_ORDER,
  tickItem,
  untickItem,
  type DietDay,
  type DietItem,
} from '@/lib/wellness-api';
import { useProfile } from '@/providers/profile-provider';

const BRAND = '#3ddc68';
const WEB_TOP_BAR = 72;
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

export default function DietScreen() {
  const { role } = useProfile();
  // Dietitians and the admin do not have a plan of their own here: this tab is their client list.
  return role === 'member' ? <MyDiet /> : <ClientsList />;
}

function MyDiet() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useProfile();
  const { now, format, firstWeekday } = useDeviceClock();

  const todayParts = getZonedParts(now, format.timeZone);
  // The same calendar as Home and Activity: any day of any week, with arrows to move a week at a time.
  const [picked, setPicked] = useState<CalendarDay | null>(null);
  const selectedDay: CalendarDay = picked ?? todayParts;
  const day = toDayKey(selectedDay);
  const weekStart = toDayKey(getWeekDays(selectedDay, firstWeekday)[0]);

  const [data, setData] = useState<DietDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const id = ++latest.current;
    try {
      const next = await getDiet(day, weekStart);
      if (id !== latest.current) return; // a newer request has already answered
      setData(next);
      setError(null);
    } catch (e) {
      if (id === latest.current) setError(messageFrom(e));
    }
  }, [day, weekStart]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useForegroundReload(load);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /** Ticks or unticks at once on screen, then tells the server; goes back if it fails. */
  const toggle = async (item: DietItem) => {
    const done = !item.done;
    setNotice(null);
    const apply = (value: boolean) =>
      setData((d) => {
        const was = d?.items.find((i) => i.id === item.id);
        if (!d || !was || was.done === value) return d;
        const step = value ? 1 : -1;
        return {
          ...d,
          items: d.items.map((i) => (i.id === item.id ? { ...i, done: value } : i)),
          summary: { ...d.summary, done: d.summary.done + step },
          week: d.week.map((w) => (w.day === d.day ? { ...w, done: w.done + step } : w)),
        };
      });
    apply(done);
    try {
      await (done ? tickItem(item.id) : untickItem(item.id));
    } catch (e) {
      setNotice(messageFrom(e));
      // Put this one item back as it was, so a tick that was not saved is not left showing.
      apply(!done);
    }
  };

  const isWeb = Platform.OS === 'web';
  const items = data?.items ?? [];
  const total = data?.summary.total ?? 0;
  const doneCount = data?.summary.done ?? 0;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  const planned = items.reduce((sum, i) => sum + (i.calories ?? 0), 0);
  const selectedDate = new Date(`${day}T12:00:00Z`);
  const planDays = useMemo(() => new Set((data?.week ?? []).filter((w) => w.total > 0).map((w) => w.day)), [data?.week]);

  return (
    <View className="flex-1 bg-ink">
      <GreenBackground />
      <StatusBar style="light" />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={BRAND} colors={[BRAND]} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + (isWeb ? WEB_TOP_BAR : 20),
          width: '100%', maxWidth: 840, alignSelf: 'center',
          paddingBottom: insets.bottom + (isWeb ? 0 : BottomTabInset) + 24,
        }}>
        <PageHeading title="Your diet" subtitle="A simple plan for your day." />

        <WeekPicker
          selected={selectedDay}
          today={todayParts}
          firstWeekday={firstWeekday}
          locale={format.locale}
          onSelect={setPicked}
          // a dot under each day that has a diet plan
          marked={planDays}
        />

        {error || notice ? (
          <View accessibilityRole="alert" className="mx-5 mt-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm text-white">{notice ?? error}</Text>
            {error && !notice ? <Text className="mt-0.5 text-xs text-muted">Pull down to try again.</Text> : null}
          </View>
        ) : null}

        {data === null && !error ? (
          <View className="items-center py-16">
            <ActivityIndicator color={BRAND} />
          </View>
        ) : null}

        {data && !data.sharing ? (
          <View className="mx-5 mt-5 rounded-3xl border border-white/10 bg-card p-5">
            <Text className="text-base font-bold text-white">{profile ? 'Connect with your dietitian' : 'A plan made for you'}</Text>
            <Text className="mt-1 text-sm text-muted">{profile ? 'Choose what you share in your profile to receive a personal diet plan.' : 'Add your fitness profile whenever you’re ready for a personal diet plan.'}</Text>
            <Pressable onPress={() => router.push(profile ? '/edit-profile' : ('/complete-profile' as never))} accessibilityRole="button" className="mt-4 self-start rounded-full bg-brand px-5 py-2.5 active:opacity-80">
              <Text className="text-sm font-bold text-ink">{profile ? 'Manage sharing' : 'Complete fitness profile'}</Text>
            </Pressable>
          </View>
        ) : null}

        {data && total > 0 ? (
          <View className="mx-5 mt-5 rounded-3xl border border-white/5 bg-card p-5">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-base font-bold text-white">{formatLongDate(selectedDate, { ...format, timeZone: 'UTC' })}</Text>
              <Text {...COMPACT_TEXT} className="text-xs font-semibold text-muted">
                {planned > 0 ? `${planned.toLocaleString(format.locale)} kcal planned` : ''}
              </Text>
            </View>
            <View className="mt-3 flex-row items-baseline gap-2">
              <DisplayText {...COMPACT_TEXT} style={{ fontSize: 34, lineHeight: 40 }} className="text-white">
                {doneCount}<Text className="text-muted"> / {total}</Text>
              </DisplayText>
              <Text {...COMPACT_TEXT} className="text-sm font-semibold text-muted">
                done
              </Text>
            </View>
            <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} className="mt-3 overflow-hidden rounded-full bg-card-2" style={{ height: 6 }}>
              <View className="rounded-full bg-brand" style={{ height: 6, width: `${percent}%` }} />
            </View>
            <Text {...COMPACT_TEXT} className="mt-2 text-xs text-muted">
              {doneCount === total ? 'All items completed for today' : `${total - doneCount} to go`}
            </Text>
          </View>
        ) : null}

        {data && data.sharing && total === 0 ? (
          <View className="mx-5 mt-5 items-center rounded-3xl border border-white/10 bg-card px-6 py-12">
            <SymbolView name={{ ios: 'fork.knife', android: 'restaurant_menu', web: 'restaurant_menu' }} tintColor={BRAND} size={30} />
            <Text className="mt-4 text-lg font-bold text-white">{data.coaching.status === 'pending' ? 'Waiting for your dietitian' : 'Your dietitian is connected'}</Text>
            <Text className="mt-1 text-center text-sm text-muted">{data.coaching.status === 'pending'
              ? 'Your coach will assign a dietitian to you soon. Your personal diet plan will appear here once they add it.'
              : `${data.coaching.dietitianName || 'Your dietitian'} is your dietitian. No diet plan has been added for this day yet.`}</Text>
          </View>
        ) : null}

        {SLOT_ORDER.map((slot) => {
          const slotItems = items.filter((i) => i.mealSlot === slot);
          if (!slotItems.length) return null;
          return (
            <View key={slot} className="mt-6 px-5">
              <Text {...COMPACT_TEXT} className="mb-2 px-1 text-xs font-bold uppercase tracking-[1px] text-muted">
                {SLOT_LABEL[slot]}
              </Text>
              <View className="gap-2">
                {slotItems.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => toggle(item)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.done }}
                    accessibilityLabel={`${item.title}${item.calories ? `, ${item.calories} kilocalories` : ''}`}
                    className="flex-row items-start gap-4 rounded-2xl bg-card p-4 active:opacity-80">
                    <View
                      className={`mt-0.5 h-7 w-7 items-center justify-center rounded-full border-2 ${item.done ? 'border-brand bg-brand' : 'border-white/25'}`}>
                      {item.done ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor="#050a07" size={14} /> : null}
                    </View>
                    <View className="flex-1">
                      <Text {...COMPACT_TEXT} className={`text-base font-bold ${item.done ? 'text-muted line-through' : 'text-white'}`}>
                        {item.title}
                      </Text>
                      {item.details ? (
                        <Text {...COMPACT_TEXT} className="mt-0.5 text-sm text-muted">
                          {item.details}
                        </Text>
                      ) : null}
                    </View>
                    {item.calories != null ? (
                      <Text {...COMPACT_TEXT} className="text-xs font-semibold text-brand">
                        {item.calories} kcal
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
