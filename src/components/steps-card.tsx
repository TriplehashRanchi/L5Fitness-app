import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

import { StepsRing } from '@/components/steps-ring';
import type { useSteps } from '@/hooks/use-steps';
import { formatWeekday, type CalendarDay } from '@/lib/datetime';
import { compactSteps, goalPercent } from '@/lib/steps/summary';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
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
        <ActivityIndicator color="#050a07" size="small" />
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
  steps: stepsState,
  locale,
  days,
  goal,
}: {
  /** The 7 days of the week on screen, in order */
  days: CalendarDay[];
  /** The result of useSteps, read once by the Home screen so it can also refresh it */
  steps: ReturnType<typeof useSteps>;
  locale: string;
  /** Daily step goal from Settings */
  goal: number;
}) {
  const t = useT();
  const [showWeek, setShowWeek] = useState(false);
  const { status, week, todaySteps, asked, connecting, connect, openSettings, sourceName } = stepsState;
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
        {/* i18n-ignore: developers only, never in a store build */}
        <Text className="text-sm font-bold text-white">Steps are off in this build</Text>
        <Text className="mt-1 text-xs text-muted">
          {/* i18n-ignore: developers only, never in a store build */}
          {'Reading steps needs the installed app on a phone. It does not work in Expo Go or on web. Developers only: members do not see this note.'}
        </Text>
      </View>
    );
  }

  if (status === 'needs-setup') {
    return (
      <ConnectPrompt
        title={t('act.countSteps')}
        detail={t('act.installHealthConnect')}
        action={{ title: t('act.setUp'), onPress: openSettings }}
      />
    );
  }

  if (status === 'needs-permission') {
    // Asked once and still not allowed: the system will not ask again, so point to settings.
    return (
      <ConnectPrompt
        title={t('act.countSteps')}
        detail={t(asked ? 'act.allowSteps' : 'act.connectToSee', { source: sourceName })}
        action={
          asked
            ? { title: t('act.openSettings'), onPress: openSettings }
            : { title: t('act.connect'), onPress: connect, busy: connecting }
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
          <Text {...COMPACT_TEXT} className="text-base font-semibold text-white">{t('act.yourSteps')}</Text>
        </View>
        <View className={`shrink rounded-full px-3 py-1.5 ${goalMet && todaySteps != null ? 'bg-brand/10' : 'bg-card-2'}`}>
          <Text {...COMPACT_TEXT} className="text-xs font-semibold text-brand">
            {todaySteps == null ? t('act.waitingData') : goalMet ? t('act.goalReachedTick') : t('act.percentOfGoal', { n: percent })}
          </Text>
        </View>
      </View>

      <View className="items-center py-6">
        <StepsRing steps={todaySteps} goal={goal} locale={locale} />
      </View>

      <View className="flex-row rounded-2xl bg-card-2 py-4">
        <View className="flex-1 items-center border-r border-white/10 px-2">
          <Text {...COMPACT_TEXT} className="text-lg font-semibold text-white">{number(goal)}</Text>
          <Text {...COMPACT_TEXT} className="mt-1 text-center text-xs text-muted">{t('act.dailyGoal')}</Text>
        </View>
        <View className="flex-1 items-center px-2">
          <Text {...COMPACT_TEXT} className="text-lg font-semibold text-brand">
            {todaySteps == null ? '–' : number(goalMet ? steps - goal : remaining)}
          </Text>
          <Text {...COMPACT_TEXT} className="mt-1 text-center text-xs text-muted">{t(goalMet && todaySteps != null ? 'act.extraSteps' : 'act.stepsToGo')}</Text>
        </View>
      </View>
      {todaySteps != null ? (
        <Text {...COMPACT_TEXT} className="mt-4 text-center text-xs leading-5 text-muted">
          {goalMet
            ? t('act.goalComplete')
            : t(steps === 0 && Platform.OS === 'ios' ? 'act.takeWalkIos' : 'act.littleMore')}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setShowWeek((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showWeek }}
        accessibilityLabel={t(showWeek ? 'act.hideWeekly' : 'act.showWeekly')}
        className="mt-4 flex-row items-center justify-between border-t border-white/5 pt-4">
        <Text {...COMPACT_TEXT} className="shrink text-sm font-semibold text-white">{t('act.weeklyActivity')}</Text>
        <View className="flex-row items-center gap-2">
          <Text {...COMPACT_TEXT} className="text-xs text-muted">{t('act.stepsCount', { n: number(week.total) })}</Text>
          <SymbolView name={showWeek ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} tintColor="#8fa396" size={14} />
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
                bar.steps == null ? t('act.barNoSteps', { day: label }) : t('act.dayStepsA11y', { day: label, steps: number(bar.steps) })
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
                adjustsFontSizeToFit
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
            {t('act.dailyAverage')}
          </Text>
          <Text {...COMPACT_TEXT} className="text-base font-bold text-white">
            {number(week.average)}
          </Text>
        </View>
        <View className="items-end">
          <Text {...COMPACT_TEXT} className="text-[11px] text-muted">
            {t('act.goalReached')}
          </Text>
          <Text {...COMPACT_TEXT} className="text-base font-bold text-white">
            {t(week.daysCounted === 1 ? 'act.reachedOfOne' : 'act.reachedOfMany', { done: week.daysReachedGoal, total: week.daysCounted })}
          </Text>
        </View>
      </View>
      </> : null}
    </View>
  );
}
