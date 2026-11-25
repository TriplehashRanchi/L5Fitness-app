import { SymbolView } from 'expo-symbols';
import { useEffect, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { CoachLogo } from '@/components/coach-logo';
import { DisplayText } from '@/components/display-text';
import { blobPath } from '@/lib/blob-path';
import { addDays, formatWeekday, getWeekDays, isSameDay, type CalendarDay } from '@/lib/datetime';

const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

const BRAND = '#3ddc68';

function greeting(hour: number) {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** "Kunal Kumar" -> "Kunal"; an email-like name keeps the part before the @. */
function firstName(name: string) {
  return name.trim().split('@')[0].split(/\s+/)[0] || 'Athlete';
}

/**
 * The bell on Home. Quiet when there is nothing new; with unread notifications it turns green,
 * swings every few seconds and a soft ring pulses around it.
 */
function NotificationBell({ unread, onPress }: { unread: number; onPress: () => void }) {
  const reduced = useReducedMotion();
  const swing = useSharedValue(0);
  const pulse = useSharedValue(0);
  const has = unread > 0;

  useEffect(() => {
    if (!has || reduced) {
      swing.value = 0;
      pulse.value = 0;
      return;
    }
    const t = (to: number, ms: number) => withTiming(to, { duration: ms, easing: Easing.inOut(Easing.quad) });
    swing.value = withRepeat(withSequence(t(1, 90), t(-1, 160), t(0.6, 140), t(-0.4, 120), t(0, 100), withDelay(3200, t(0, 1))), -1);
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), withDelay(2200, withTiming(0, { duration: 1 }))), -1);
  }, [has, reduced, swing, pulse]);

  const bellStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value * 16}deg` }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: (1 - pulse.value) * 0.55, transform: [{ scale: 1 + pulse.value * 0.55 }] }));

  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={has ? `Notifications, ${unread} unread` : 'Notifications'}
      className="items-center justify-center active:opacity-80"
      style={{ width: 46, height: 46 }}>
      {has ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: BRAND }, ringStyle]}
        />
      ) : null}
      <View
        className="items-center justify-center"
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          borderWidth: 1,
          borderColor: has ? 'rgba(61,220,104,0.55)' : 'rgba(255,255,255,0.1)',
          backgroundColor: has ? 'rgba(61,220,104,0.16)' : '#0b1a11',
        }}>
        <Animated.View style={bellStyle}>
          <SymbolView
            name={
              has
                ? { ios: 'bell.badge.fill', android: 'notifications_active', web: 'notifications_active' }
                : { ios: 'bell', android: 'notifications_none', web: 'notifications_none' }
            }
            tintColor={has ? BRAND : 'white'}
            size={20}
          />
        </Animated.View>
      </View>
      {has ? (
        <View
          className="absolute items-center justify-center"
          style={{ right: -3, top: -3, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: BRAND, borderWidth: 2, borderColor: '#000000' }}>
          <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 10, lineHeight: 13 }}>
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * The way into the AI coach, at the top right of Home: the coach's own mark (a glossy ball with a dumbbell
 * and the AI spark) inside a green ring that breathes slowly, so it reads as something alive you can talk to.
 */
function CoachButton({ onPress }: { onPress: () => void }) {
  const reduced = useReducedMotion();
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    glow.value = withRepeat(withSequence(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) })), -1);
  }, [reduced, glow]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.25 + glow.value * 0.45, transform: [{ scale: 1 + glow.value * 0.12 }] }));
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Ask L5 Coach, your AI assistant"
      className="items-center justify-center active:opacity-80"
      style={{ width: 46, height: 46 }}>
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: 44, height: 44, borderRadius: 22, top: 3, borderWidth: 2, borderColor: BRAND }, ringStyle]} />
      <CoachLogo size={50} />
    </Pressable>
  );
}

export function monthYear(day: CalendarDay, locale: string) {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(day.year, day.month - 1, day.day))
  );
}

/** One white peanut shape with two lobes: previous week on the left, next week on the right. */
export function WeekArrows({ onStep }: { onStep: (step: number) => void }) {
  const R = 22;
  const D = 46;
  const lobes = [
    { label: 'Previous week', step: -1, icon: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' } },
    { label: 'Next week', step: 1, icon: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' } },
  ] as const;
  return (
    <View style={{ width: R * 2 + D, height: R * 2 }}>
      <Svg width={R * 2 + D} height={R * 2} style={{ position: 'absolute' }} pointerEvents="none">
        <Path d={blobPath(2, R, D, 10)} fill="#e9ebea" />
      </Svg>
      {lobes.map((b, i) => (
        <Pressable
          key={b.label}
          onPress={() => onStep(b.step)}
          accessibilityRole="button"
          accessibilityLabel={b.label}
          style={{ position: 'absolute', left: i * D + (i === 0 ? 0 : 0), top: 0, width: R * 2, height: R * 2, alignItems: 'center', justifyContent: 'center' }}
          className="active:opacity-60">
          <SymbolView name={b.icon} tintColor="#1c241f" size={22} weight="light" />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Big title, month row with the joined previous/next pill, and the 7-day strip.
 * The arrows only move the week that is shown; the plan and numbers below are always today's.
 */
export function HomeHeader({
  userName,
  unread,
  today,
  firstWeekday,
  locale,
  offset,
  onOffsetChange,
  onNotifications,
  onCoach,
  hero,
}: {
  userName: string;
  unread: number;
  today: CalendarDay;
  firstWeekday: number;
  locale: string;
  offset: number;
  onOffsetChange: (offset: number) => void;
  onNotifications: () => void;
  /** Opens the AI coach. (The member's own profile is the Profile tab.) */
  onCoach: () => void;
  /** Shown under the greeting, above the calendar. */
  hero?: ReactNode;
}) {
  const days = getWeekDays(addDays(today, offset * 7), firstWeekday);
  const shownMonth = monthYear(days[3], locale);

  return (
    <View className="px-5 pt-3">
      <View className="flex-row items-center justify-between gap-4">
        <View className="flex-1">
          <Text {...COMPACT_TEXT} className="text-sm font-semibold text-muted" numberOfLines={1}>
            {greeting(new Date().getHours())}
          </Text>
          <DisplayText className="text-[32px] leading-10 tracking-tight text-white" numberOfLines={1}>
            {firstName(userName)}
          </DisplayText>
        </View>
        <View className="flex-row items-center gap-2.5">
          <NotificationBell unread={unread} onPress={onNotifications} />
          <CoachButton onPress={onCoach} />
        </View>
      </View>

      {hero}

      <View className="mt-5 flex-row items-center justify-between">
        <DisplayText {...COMPACT_TEXT} className="text-xl tracking-tight text-white" numberOfLines={1}>
          {shownMonth}
        </DisplayText>
        <WeekArrows onStep={(s) => onOffsetChange(offset + s)} />
      </View>

      <View className="mt-5 flex-row">
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <View
              key={`${d.year}-${d.month}-${d.day}`}
              accessible
              accessibilityLabel={`${formatWeekday(d, locale, 'long')} ${d.day}${isToday ? ', today' : ''}`}
              className="flex-1 items-center gap-2">
              <Text {...COMPACT_TEXT} className={`text-sm font-semibold ${isToday ? 'text-white' : 'text-muted'}`}>
                {formatWeekday(d, locale, 'narrow')}
              </Text>
              <View
                style={{ width: 42, height: 42, borderRadius: 21 }}
                className={`items-center justify-center ${isToday ? 'bg-brand' : ''}`}>
                <Text {...COMPACT_TEXT} className={`text-base font-bold ${isToday ? 'text-ink' : 'text-muted'}`}>
                  {d.day}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
