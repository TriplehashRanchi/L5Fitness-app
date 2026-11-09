import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

import { StepsRing } from '@/components/steps-ring';
import { useSteps } from '@/hooks/use-steps';
import { formatWeekday, type CalendarDay } from '@/lib/datetime';
import { compactSteps, goalPercent } from '@/lib/steps/summary';

const BRAND = '#c6f432';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const CHART_HEIGHT = 80;

function ActionButton({ title, onPress, busy }: { title: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      className="min-w-[96px] items-center rounded-full bg-brand px-5 py-2.5 active:opacity-80">
      {busy ? (
        <ActivityIndicator color="#0b0b0d" size="small" />
      ) : (
        <Text {...COMPACT_TEXT} className="text-sm font-bold text-ink">
          {title}
        </Text>
      )}
    </Pressable>
  );
}

function WalkIcon({ size = 22 }: { size?: number }) {
  return (
    <SymbolView
      name={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }}
      tintColor={BRAND}
      size={size}
    />
  );
}

/** Shown while there is nothing to count yet: asks the member to connect, or says what to install. */
function ConnectPrompt({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action: { title: string; onPress: () => void; busy?: boolean };
}) {
  return (
    <View className="mx-5 mb-5 flex-row items-center gap-4 rounded-3xl border border-brand/30 bg-card p-5">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-card-2">
        <WalkIcon />
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-white">{title}</Text>
        <Text className="mt-0.5 text-xs text-muted">{detail}</Text>
      </View>
      <ActionButton {...action} />
    </View>
  );
}

/**
 * Today's steps, progress to the daily goal, and the week's steps day by day.
 * Counts come from Apple Health (iOS) or Health Connect (Android) and stay on the phone.
 */
export function StepsCard({
  now,
  locale,
  days,
  today,
  goal,
}: {
  now: Date;
  locale: string;
  /** Daily step goal from Settings */
  goal: number;
  /** The 7 days of the week on screen, in order */
  days: CalendarDay[];
  today: CalendarDay;
}) {
  const [showWeek, setShowWeek] = useState(false);
  const { status, week, todaySteps, asked, connecting, connect, openSettings, sourceName } = useSteps(
    now,
    days,
    today,
    goal
  );
  const number = (n: number) => n.toLocaleString(locale);

  if (status === 'loading') {
    return <View className="mx-5 mb-5 h-72 rounded-3xl border border-white/5 bg-card" accessibilityElementsHidden />;
  }

  if (status === 'unavailable') {
    // Members never see this: a store build on a supported phone is never "unavailable".
    // It tells developers why the card is empty in Expo Go and on web.
    if (!__DEV__) return null;
    return (
      <View className="mx-5 mb-5 rounded-3xl border border-white/10 bg-card p-5">
        <Text className="text-sm font-bold text-white">Steps are off in this build</Text>
        <Text className="mt-1 text-xs text-muted">
          Reading steps needs the installed app on a phone. It does not work in Expo Go or on web.
          Developers only: members do not see this note.
        </Text>
      </View>
    );
  }

  if (status === 'needs-setup') {
    return (
      <ConnectPrompt
        title="Count your steps"
        detail="Install or update Health Connect, then come back here."
        action={{ title: 'Set up', onPress: openSettings }}
      />
    );
  }

  if (status === 'needs-permission') {
    // Asked once and still not allowed: the system will not ask again, so point to settings.
    return (
      <ConnectPrompt
        title="Count your steps"
        detail={
          asked
            ? `Allow Steps for L5 Fitness in ${sourceName}.`
            : `Connect ${sourceName} to see your daily steps.`
        }
        action={
          asked
            ? { title: 'Open settings', onPress: openSettings }
            : { title: 'Connect', onPress: connect, busy: connecting }
        }
      />
    );
  }

  const steps = todaySteps ?? 0;
  const percent = goalPercent(steps, goal);
  const goalMet = steps >= goal;
  const remaining = Math.max(0, goal - steps);

  return (
    <View className="mx-5 mb-5 overflow-hidden rounded-3xl border border-white/5 bg-card p-5">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <WalkIcon size={18} />
          <Text {...COMPACT_TEXT} className="text-base font-semibold text-white">Your steps</Text>
        </View>
        <View className={`rounded-full px-3 py-1.5 ${goalMet && todaySteps != null ? 'bg-brand/10' : 'bg-card-2'}`}>
          <Text {...COMPACT_TEXT} className="text-xs font-semibold text-brand">
            {todaySteps == null ? 'Waiting for data' : goalMet ? 'Goal reached ✓' : `${percent}% of goal`}
          </Text>
        </View>
      </View>

      <View className="items-center py-6">
        <StepsRing steps={todaySteps} goal={goal} locale={locale} />
      </View>

      <View className="flex-row rounded-2xl bg-card-2 py-4">
        <View className="flex-1 items-center border-r border-white/10 px-2">
          <Text {...COMPACT_TEXT} className="text-lg font-semibold text-white">{number(goal)}</Text>
          <Text {...COMPACT_TEXT} className="mt-1 text-xs text-muted">Daily goal</Text>
        </View>
        <View className="flex-1 items-center px-2">
          <Text {...COMPACT_TEXT} className="text-lg font-semibold text-brand">
            {todaySteps == null ? '–' : number(goalMet ? steps - goal : remaining)}
          </Text>
          <Text {...COMPACT_TEXT} className="mt-1 text-xs text-muted">{goalMet && todaySteps != null ? 'Extra steps' : 'Steps to go'}</Text>
        </View>
      </View>
      {todaySteps != null ? (
        <Text {...COMPACT_TEXT} className="mt-4 text-center text-xs leading-5 text-muted">
          {goalMet
            ? 'Daily goal complete. Every extra step counts.'
            : steps === 0 && Platform.OS === 'ios'
              ? 'Take a walk to get started. If steps stay at 0, check Steps access in Apple Health.'
              : 'A little more movement, one step at a time.'}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setShowWeek((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showWeek }}
        accessibilityLabel={showWeek ? 'Hide weekly steps' : 'Show weekly steps'}
        className="mt-4 flex-row items-center justify-between border-t border-white/5 pt-4">
        <Text {...COMPACT_TEXT} className="text-sm font-semibold text-white">Weekly activity</Text>
        <View className="flex-row items-center gap-2">
          <Text {...COMPACT_TEXT} className="text-xs text-muted">{number(week.total)} steps</Text>
          <SymbolView name={showWeek ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} tintColor="#9ba2ac" size={14} />
        </View>
      </Pressable>
      {showWeek ? <>
      <View className="mt-4 flex-row gap-2" style={{ height: CHART_HEIGHT + 34 }}>
        {week.bars.map((bar, i) => {
          const day = days[i];
          const label = formatWeekday(day, locale, 'short');
          const height = bar.steps == null ? 4 : Math.max(6, Math.round(bar.ratio * CHART_HEIGHT));
          const fill = bar.isToday
            ? 'bg-brand'
            : bar.reachedGoal
              ? 'bg-brand-dark'
              : bar.isFuture
                ? 'bg-card-2'
                : 'bg-white/25';
          return (
            <View
              key={bar.key}
              accessible
              accessibilityLabel={
                bar.steps == null ? `${label}, no steps yet` : `${label}, ${number(bar.steps)} steps`
              }
              className="flex-1 items-center justify-end gap-1.5">
              <Text
                {...COMPACT_TEXT}
                numberOfLines={1}
                className={`text-[10px] font-semibold ${bar.isToday ? 'text-brand' : 'text-muted'}`}>
                {bar.steps == null ? ' ' : compactSteps(bar.steps)}
              </Text>
              <View className="w-full justify-end" style={{ height: CHART_HEIGHT }}>
                {/* dashed goal line */}
                <View
                  className="absolute left-0 right-0 border-t border-dashed border-white/20"
                  style={{ bottom: Math.round(week.goalRatio * CHART_HEIGHT) }}
                />
                <View className={`w-full rounded-t-lg ${fill}`} style={{ height }} />
              </View>
              <Text
                {...COMPACT_TEXT}
                numberOfLines={1}
                className={`text-[11px] ${bar.isToday ? 'font-bold text-white' : 'text-muted'}`}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      <View className="mt-4 flex-row justify-between rounded-2xl bg-card-2 px-4 py-3">
        <View>
          <Text {...COMPACT_TEXT} className="text-[11px] text-muted">
            Daily average
          </Text>
          <Text {...COMPACT_TEXT} className="text-base font-bold text-white">
            {number(week.average)}
          </Text>
        </View>
        <View className="items-end">
          <Text {...COMPACT_TEXT} className="text-[11px] text-muted">
            Goal reached
          </Text>
          <Text {...COMPACT_TEXT} className="text-base font-bold text-white">
            {week.daysReachedGoal} of {week.daysCounted} {week.daysCounted === 1 ? 'day' : 'days'}
          </Text>
        </View>
      </View>
      </> : null}
    </View>
  );
}
