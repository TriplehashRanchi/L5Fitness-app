import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { DisplayText } from '@/components/display-text';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { useStepHistory, type StepDay } from '@/hooks/use-step-history';
import { dayLabel, getZonedParts, toDayKey } from '@/lib/datetime';
import { DAILY_STEP_GOAL } from '@/lib/steps/summary';
import { useProfile } from '@/providers/profile-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const CHART_HEIGHT = 132;
const RING = 208;
const RING_STROKE = 12;
const HAIRLINE = 'rgba(255,255,255,0.07)';
/** Height of the History box before "Show more": about five days. */
const HISTORY_BOX = 5 * 48;

/**
 * How a day went compared with the target:
 * ice = a quiet day (under half), low = on the way, goal = target reached, hot = way over the target.
 */
type Tier = 'none' | 'ice' | 'low' | 'goal' | 'hot';
const HOT_AT = 1.4;
const tierOf = (steps: number | null, goal: number): Tier =>
  steps == null ? 'none' : steps >= goal * HOT_AT ? 'hot' : steps >= goal ? 'goal' : steps >= goal * 0.5 ? 'low' : 'ice';
const ICE = '#8fd3ff';
const HOT = '#ff5a36';
const TIER_COLOR: Record<Tier, string> = { none: 'rgba(255,255,255,0.1)', ice: ICE, low: 'rgba(61,220,104,0.45)', goal: BRAND, hot: HOT };
/** A soft glow around the bars of the best and the quietest days. */
const TIER_GLOW: Partial<Record<Tier, string>> = { hot: '0 0 10px 2px rgba(255,90,54,0.75)', ice: '0 0 8px 1px rgba(143,211,255,0.5)' };

/** "8.4k" for the chart's target label. */
const short = (n: number) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));

/** The day's steps inside a thin ring that fills toward the target, with the energy that walking used right under them. */
function StepsRing({ steps, goal, kcal, locale }: { steps: number | null; goal: number; kcal: number | null; locale: string }) {
  const r = (RING - RING_STROKE) / 2;
  const length = 2 * Math.PI * r;
  const ratio = steps == null ? 0 : Math.min(1, steps / Math.max(1, goal));
  const tier = tierOf(steps, goal);
  const color = tier === 'hot' ? HOT : tier === 'ice' ? ICE : BRAND;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={steps == null ? 'No steps for this day' : `${steps.toLocaleString(locale)} of ${goal.toLocaleString(locale)} steps${kcal != null ? `, about ${kcal.toLocaleString(locale)} kilocalories` : ''}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}
      style={{ width: RING, height: RING, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={RING_STROKE} fill="none" />
        {tier === 'goal' || tier === 'hot' ? (
          // a soft halo for a day that hit the target
          <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={color} strokeOpacity={0.2} strokeWidth={RING_STROKE + 14} fill="none" />
        ) : null}
        {ratio > 0 ? (
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={color}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${length * ratio} ${length}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        ) : null}
      </Svg>
      <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="text-[44px] leading-[50px] tracking-tight text-white" style={{ maxWidth: RING - 56 }}>
        {steps == null ? '–' : steps.toLocaleString(locale)}
      </DisplayText>
      <Text {...COMPACT_TEXT} className="mt-0.5 text-xs font-semibold text-muted">
        of {goal.toLocaleString(locale)} steps
      </Text>
      {kcal != null ? (
        <View className="flex-row items-center" style={{ gap: 5, marginTop: 10 }}>
          <SymbolView name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }} tintColor="#fb923c" size={15} />
          <Text {...COMPACT_TEXT} className="text-[15px] font-bold text-white">
            {kcal.toLocaleString(locale)} <Text className="text-xs font-semibold text-muted">kcal</Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** One slim bar per day, the dashed line is the daily target. Tap a bar to see that day. */
function MonthChart({
  days,
  goal,
  selected,
  onSelect,
  locale,
  todayKey,
}: {
  days: StepDay[];
  goal: number;
  selected: string;
  onSelect: (key: string) => void;
  locale: string;
  todayKey: string;
}) {
  const top = Math.max(goal, ...days.map((d) => d.steps ?? 0), 1) * 1.08;
  const goalY = CHART_HEIGHT - (goal / top) * CHART_HEIGHT;
  return (
    <View>
      <View style={{ height: CHART_HEIGHT }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: goalY, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.22)' }} />
        <Text {...COMPACT_TEXT} className="text-[10px] font-semibold text-muted" style={{ position: 'absolute', right: 0, top: Math.max(0, goalY - 15) }}>
          {short(goal)}
        </Text>
        <View className="flex-1 flex-row items-end" style={{ gap: 3 }}>
          {days.map((d) => {
            const steps = d.steps ?? 0;
            const isSelected = d.key === selected;
            return (
              <Pressable
                key={d.key}
                onPress={() => onSelect(d.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${dayLabel(d.key, todayKey, locale)}, ${d.steps == null ? 'no data' : `${steps.toLocaleString(locale)} steps`}`}
                className="flex-1 items-center justify-end"
                style={{ height: CHART_HEIGHT }}>
                <View
                  style={{
                    width: '100%',
                    maxWidth: 9,
                    height: d.steps == null ? 3 : Math.max(3, Math.round((steps / top) * CHART_HEIGHT)),
                    borderRadius: 5,
                    backgroundColor: isSelected ? '#ffffff' : TIER_COLOR[tierOf(d.steps, goal)],
                    boxShadow: TIER_GLOW[tierOf(d.steps, goal)],
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
      <View className="mt-4 flex-row flex-wrap items-center justify-center" style={{ gap: 14 }}>
        {(
          [
            ['ice', 'Quiet'],
            ['low', 'On the way'],
            ['goal', 'Target'],
            ['hot', 'On fire'],
          ] as const
        ).map(([tier, label]) => (
          <View key={tier} className="flex-row items-center" style={{ gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TIER_COLOR[tier], boxShadow: TIER_GLOW[tier] }} />
            <Text {...COMPACT_TEXT} className="text-[11px] font-semibold text-muted">
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Steps for the last 30 days. Opened from the Steps tile on Home. */
export default function StepsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { now, format } = useDeviceClock();
  const today = getZonedParts(now, format.timeZone);
  const todayKey = toDayKey(today);
  const history = useStepHistory(today, DAILY_STEP_GOAL);
  const { days, goal, status } = history;
  const [picked, setPicked] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const selected = picked && days?.some((d) => d.key === picked) ? picked : todayKey;
  const fmt = (n: number) => n.toLocaleString(format.locale);
  // Energy used by walking, the same sum Home uses: about 0.0005 kcal per step per kg of body weight
  // (10,000 steps at 70 kg is 350 kcal). 70 kg stands in until the member has given their weight.
  const { profile } = useProfile();
  const kcalOf = (steps: number) => Math.round(steps * 0.0005 * (profile?.weightKg ?? 70));

  const known = (days ?? []).filter((d) => d.steps != null);
  const total = known.reduce((sum, d) => sum + (d.steps ?? 0), 0);
  const average = known.length ? Math.round(total / known.length) : 0;
  const best = known.reduce<StepDay | null>((b, d) => (b == null || (d.steps ?? 0) > (b.steps ?? 0) ? d : b), null);
  const goalDays = known.filter((d) => (d.steps ?? 0) >= goal).length;
  const selectedIndex = days ? days.findIndex((d) => d.key === selected) : -1;
  const canGoBack = selectedIndex > 0;
  const canGoForward = days != null && selectedIndex >= 0 && selectedIndex < days.length - 1;
  const goToDay = (step: number) => {
    if (!days) return;
    const next = days[selectedIndex + step];
    if (next) setPicked(next.key);
  };
  const shown = days?.find((d) => d.key === selected) ?? null;
  const shownSteps = shown?.steps ?? null;
  const shownTier = tierOf(shownSteps, goal);
  const needsConnect = status === 'needs-permission' || status === 'needs-setup';
  const newestFirst = days ? [...days].reverse() : [];
  const stats = [
    { label: 'Average', value: known.length ? fmt(average) : '–' },
    { label: 'Best day', value: best?.steps ? fmt(best.steps) : '–' },
    { label: 'Target met', value: known.length ? `${goalDays}/${known.length}` : '–' },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, width: '100%', maxWidth: 840, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={history.refreshing} onRefresh={history.refresh} tintColor={BRAND} colors={[BRAND]} />}
        showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-3 px-5 pb-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-11 w-11 items-center justify-center rounded-full bg-card active:opacity-70">
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
          </Pressable>
          <DisplayText accessibilityRole="header" className="flex-1 text-[28px] tracking-tight text-white" numberOfLines={1}>
            Steps
          </DisplayText>
        </View>

        {history.error ? (
          <View accessibilityRole="alert" className="mx-5 mb-4 mt-2 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm font-semibold text-white">{history.error}</Text>
            <Pressable onPress={history.reload} accessibilityRole="button" className="mt-3 min-h-11 self-start justify-center rounded-full bg-brand px-5 active:opacity-80">
              <Text className="text-sm font-bold text-ink">Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {history.loading || !days ? (
          <View className="items-center py-28">
            <ActivityIndicator color={BRAND} />
          </View>
        ) : (
          <>
            {/* The picked day (today unless a bar was tapped) */}
            <View className="items-center px-5 pb-6 pt-4">
              <View className="mb-4 w-full flex-row items-center justify-between" style={{ maxWidth: 320 }}>
                <Pressable
                  onPress={() => goToDay(-1)}
                  disabled={!canGoBack}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Previous day"
                  accessibilityState={{ disabled: !canGoBack }}
                  className="h-11 w-11 items-center justify-center rounded-full bg-card active:opacity-70"
                  style={{ opacity: canGoBack ? 1 : 0.3 }}>
                  <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} tintColor="white" size={16} />
                </Pressable>
                <View className="items-center">
                  <Text {...COMPACT_TEXT} className="text-base font-bold text-white">
                    {dayLabel(selected, todayKey, format.locale)}
                  </Text>
                  {selected !== todayKey ? (
                    <Pressable onPress={() => setPicked(todayKey)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to today">
                      <Text {...COMPACT_TEXT} className="mt-0.5 text-xs font-bold text-brand">
                        Go to today
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => goToDay(1)}
                  disabled={!canGoForward}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Next day"
                  accessibilityState={{ disabled: !canGoForward }}
                  className="h-11 w-11 items-center justify-center rounded-full bg-card active:opacity-70"
                  style={{ opacity: canGoForward ? 1 : 0.3 }}>
                  <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor="white" size={16} />
                </Pressable>
              </View>
              <StepsRing steps={shownSteps} goal={goal} kcal={shownSteps == null ? null : kcalOf(shownSteps)} locale={format.locale} />
              {shownTier === 'goal' || shownTier === 'hot' ? (
                <View
                  className="mt-4 flex-row items-center rounded-full"
                  style={{ gap: 8, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: shownTier === 'hot' ? 'rgba(255,90,54,0.14)' : 'rgba(61,220,104,0.14)' }}>
                  <SymbolView
                    name={shownTier === 'hot' ? { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' } : { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }}
                    tintColor={shownTier === 'hot' ? HOT : BRAND}
                    size={18}
                  />
                  <Text {...COMPACT_TEXT} className="text-sm font-bold" style={{ color: shownTier === 'hot' ? HOT : BRAND }}>
                    {shownTier === 'hot' ? `On fire! ${fmt(shownSteps! - goal)} over target` : 'Great day! Target reached'}
                  </Text>
                </View>
              ) : (
                <Text {...COMPACT_TEXT} className="mt-4 text-sm font-semibold" style={{ color: shownTier === 'ice' ? ICE : '#ffffff' }}>
                  {shownSteps == null
                    ? 'No steps saved for this day'
                    : shownTier === 'ice'
                      ? `Quiet day · ${fmt(goal - shownSteps)} steps to go`
                      : `${fmt(goal - shownSteps)} steps to go`}
                </Text>
              )}
              {history.prescribed ? (
                <Text {...COMPACT_TEXT} className="mt-1 text-xs text-muted">
                  Target set by your dietitian
                </Text>
              ) : null}
            </View>

            {needsConnect ? (
              <View className="mx-5 mb-4 flex-row items-center gap-3 rounded-3xl border border-white/5 bg-card" style={{ padding: 16 }}>
                <View className="flex-1">
                  <Text {...COMPACT_TEXT} className="text-sm font-bold text-white">
                    Connect {history.sourceName}
                  </Text>
                  <Text {...COMPACT_TEXT} className="mt-0.5 text-xs leading-4 text-muted">
                    Your phone counts your steps. Connect it to fill this page.
                  </Text>
                </View>
                <Pressable
                  onPress={status === 'needs-setup' ? history.openSettings : () => void history.connect()}
                  disabled={history.connecting}
                  accessibilityRole="button"
                  accessibilityLabel={`Connect ${history.sourceName}`}
                  className="min-h-11 items-center justify-center rounded-full bg-brand px-5 active:opacity-80">
                  {history.connecting ? <ActivityIndicator color={INK} /> : <Text className="text-sm font-bold text-ink">{status === 'needs-setup' ? 'Set up' : 'Connect'}</Text>}
                </Pressable>
              </View>
            ) : null}

            {/* Three numbers in one quiet row: no card, just a thin line above and below */}
            <View className="mx-5 flex-row" style={{ paddingVertical: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: HAIRLINE }}>
              {stats.map((s, i) => (
                <View key={s.label} className="flex-1 items-center" style={i > 0 ? { borderLeftWidth: 1, borderLeftColor: HAIRLINE } : undefined}>
                  <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="text-lg text-white">
                    {s.value}
                  </DisplayText>
                  <Text {...COMPACT_TEXT} className="mt-0.5 text-[11px] font-semibold text-muted">
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            {/* The month, one bar a day: straight on the page, with no heading and no dates under it */}
            <View className="mx-5" style={{ paddingTop: 24, paddingBottom: 22 }}>
              <MonthChart days={days} goal={goal} selected={selected} onSelect={setPicked} locale={format.locale} todayKey={todayKey} />
            </View>

            {/* Day by day, newest first. A short box that scrolls on its own; "Show more" opens it fully. */}
            <View className="mx-5" style={{ paddingTop: 20, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
              <View className="mb-1 flex-row items-end justify-between">
                <Text {...COMPACT_TEXT} className="text-base font-bold text-white">
                  History
                </Text>
                <Text {...COMPACT_TEXT} className="text-xs font-semibold text-muted">
                  {newestFirst.length} days
                </Text>
              </View>
              <ScrollView
                nestedScrollEnabled
                scrollEnabled={!showAll}
                showsVerticalScrollIndicator={!showAll}
                style={showAll ? undefined : { maxHeight: HISTORY_BOX }}>
                {newestFirst.map((d, i) => {
                  const steps = d.steps;
                  const tier = tierOf(steps, goal);
                  return (
                    <Pressable
                      key={d.key}
                      onPress={() => setPicked(d.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`${dayLabel(d.key, todayKey, format.locale)}, ${steps == null ? 'no data' : `${fmt(steps)} steps`}${tier === 'hot' ? ', on fire' : tier === 'goal' ? ', target reached' : tier === 'ice' ? ', quiet day' : ''}`}
                      className="min-h-12 flex-row items-center gap-3 active:opacity-70"
                      style={i > 0 ? { borderTopWidth: 1, borderTopColor: HAIRLINE } : undefined}>
                      <View style={{ width: 26, alignItems: 'center' }}>
                        {tier === 'hot' ? (
                          <SymbolView name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }} tintColor={HOT} size={18} />
                        ) : tier === 'goal' ? (
                          <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} tintColor={BRAND} size={18} />
                        ) : tier === 'ice' ? (
                          <SymbolView name={{ ios: 'snowflake', android: 'ac_unit', web: 'ac_unit' }} tintColor={ICE} size={16} />
                        ) : (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TIER_COLOR[tier] }} />
                        )}
                      </View>
                      <Text {...COMPACT_TEXT} className={`flex-1 text-sm font-semibold ${d.key === selected ? 'text-brand' : 'text-white'}`} numberOfLines={1}>
                        {dayLabel(d.key, todayKey, format.locale)}
                      </Text>
                      <Text {...COMPACT_TEXT} className="text-sm font-bold" style={{ color: tier === 'hot' ? HOT : tier === 'ice' ? ICE : '#ffffff' }}>
                        {steps == null ? '–' : fmt(steps)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                onPress={() => setShowAll((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showAll }}
                className="min-h-12 items-center justify-center active:opacity-70"
                style={{ borderTopWidth: 1, borderTopColor: HAIRLINE }}>
                <Text {...COMPACT_TEXT} className="text-sm font-bold text-brand">
                  {showAll ? 'Show less' : 'Show more'}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
