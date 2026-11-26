import Svg, { Circle, G, Path } from 'react-native-svg';
import { Pressable, Text, View } from 'react-native';

import { DisplayText } from '@/components/display-text';
import { useLanguage, useT } from '@/providers/language-provider';

const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const INK = '#050a07';

/** Footprints, two soles with toes. */
function Footprints({ color }: { color: string }) {
  const foot = (x: number, y: number, rot: number) => (
    <G transform={`translate(${x} ${y}) rotate(${rot})`}>
      <Path d="M0 0 C-7 0 -9 8 -8 15 C-7 22 -4 24 0 24 C4 24 6 20 6 14 C6 6 4 0 0 0 Z" fill={color} />
      <Circle cx={-6} cy={-5} r={2.6} fill={color} />
      <Circle cx={-1} cy={-7} r={2.6} fill={color} />
      <Circle cx={4} cy={-5} r={2.6} fill={color} />
    </G>
  );
  return (
    <Svg width={44} height={56} viewBox="0 0 44 56" accessible={false}>
      {foot(15, 36, -12)}
      {foot(32, 18, 12)}
    </Svg>
  );
}

/** Steps tile: today's steps against the goal. */
export function StepsTile({ steps, goal, locale, onPress }: { steps: number | null; goal: number; locale: string; onPress?: () => void }) {
  const t = useT();
  const count = steps == null ? '–' : steps.toLocaleString(locale);
  const spoken = steps == null ? t('hm.stepsNA') : t('hm.stepsOfGoalToday', { count, goal: goal.toLocaleString(locale) });
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `${spoken}. ${t('hm.openStepsHistory')}` : spoken}
      className="flex-1 justify-between rounded-3xl p-4 active:opacity-80"
      style={{ minHeight: 150, backgroundColor: '#d2f5dd' }}>
      <View className="flex-row items-start justify-between">
        <DisplayText {...COMPACT_TEXT} className="shrink text-lg text-ink">
          {t('hm.steps')}
        </DisplayText>
        <View style={{ opacity: 0.35 }}>
          <Footprints color={INK} />
        </View>
      </View>
      <View>
        <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="text-[30px] leading-9 text-ink">
          {count}
        </DisplayText>
        <Text {...COMPACT_TEXT} className="text-sm font-semibold text-ink/80">
          {t('hm.steps')}
        </Text>
      </View>
    </Pressable>
  );
}

/** Goals tile: how much of today's plan is done, as a pill track with a knob and the percentage inside. */
export function GoalsTile({ percent }: { percent: number | null }) {
  const { t, language } = useLanguage();
  const indic = language !== 'en';
  const value = percent ?? 0;
  const TRACK_W = 112;
  const TRACK_H = 34;
  const inner = TRACK_W - 8; // inside the 4px border
  const fillW = Math.round((inner * value) / 100);
  return (
    <View className="flex-1 justify-between rounded-3xl p-4" style={{ minHeight: 150, backgroundColor: '#58cf7a' }}>
      <View>
        <DisplayText {...COMPACT_TEXT} className="text-lg text-ink">
          {t('hm.myGoals')}
        </DisplayText>
        <Text {...COMPACT_TEXT} className="mt-1 text-xs font-semibold leading-4 text-ink/80" style={indic ? { lineHeight: 18, marginBottom: 8 } : undefined}>
          {t('hm.keepItUp')}
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t('hm.planProgress')}
        accessibilityValue={{ min: 0, max: 100, now: value, text: percent == null ? t('hm.notAvailable') : t('hm.percent', { n: value }) }}
        className="items-end">
        <View
          className="justify-center"
          style={{
            width: TRACK_W,
            height: TRACK_H,
            borderRadius: TRACK_H / 2,
            borderWidth: 4,
            borderColor: '#f3f8f4',
            backgroundColor: 'rgba(5,10,7,0.12)',
          }}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: fillW,
              borderRadius: TRACK_H / 2,
              backgroundColor: 'rgba(255,255,255,0.7)',
            }}
          />
          <Text {...COMPACT_TEXT} className="text-center text-xs font-black text-ink">
            {percent == null ? '–' : `${value}%`}
          </Text>
        </View>
      </View>
    </View>
  );
}

export type SummaryItem = {
  key: string;
  value: string;
  label: string;
  /** 0 to 1 */
  progress: number;
  color: string;
};

const SIZE = 168;
const STROKE = 24;
const R = (SIZE - STROKE) / 2;
const C = SIZE / 2;
const GAP = 26; // degrees left open between parts (round caps eat some of it)

const polar = (deg: number, r = R) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};
const arc = (from: number, to: number) => {
  const s = polar(from);
  const e = polar(to);
  return `M ${s.x} ${s.y} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
};

/** Donut of three arcs with round ends. Each arc fills with that item's progress; a numbered badge sits on each. */
function Donut({ items, percent }: { items: SummaryItem[]; percent: number | null }) {
  const t = useT();
  const sector = 360 / items.length;
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        {items.map((item, i) => {
          const from = i * sector + GAP / 2;
          const to = (i + 1) * sector - GAP / 2;
          const p = Math.min(1, Math.max(0, item.progress));
          return (
            <G key={item.key}>
              <Path d={arc(from, to)} stroke={item.color} strokeOpacity={0.22} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
              {p > 0.02 ? (
                <Path d={arc(from, from + (to - from) * p)} stroke={item.color} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
              ) : null}
            </G>
          );
        })}
      </Svg>
      {items.map((item, i) => {
        const mid = polar(i * sector + sector / 2, R + STROKE / 2 + 2);
        return (
          <View
            key={item.key}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: mid.x - 12,
              top: mid.y - 12,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: 'rgba(143,163,150,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text maxFontSizeMultiplier={1} className="text-[11px] font-bold text-white">
              {i + 1}
            </Text>
          </View>
        );
      })}
      <DisplayText {...COMPACT_TEXT} className="text-2xl text-white">
        {percent == null ? '–' : `${percent}%`}
      </DisplayText>
      <Text {...COMPACT_TEXT} className="text-[11px] text-muted">
        {t('hm.todayLower')}
      </Text>
    </View>
  );
}

/** Large card: legend on the left, donut on the right. */
export function HomeSummaryCard({ items, percent }: { items: SummaryItem[]; percent: number | null }) {
  const { t, language } = useLanguage();
  const indic = language !== 'en';
  return (
    <View
      accessible
      // i18n-ignore: whole sentences from t(), listed one after another
      accessibilityLabel={`${percent == null ? t('hm.todayProgress') : t('hm.todayProgressPercent', { n: percent })}. ${items
        .map((i) => `${i.label}: ${i.value}`)
        .join('. ')}`}
      className="mx-5 mb-5 flex-row items-center justify-between gap-2 rounded-3xl border border-white/5 bg-card py-5 pl-5 pr-3">
      <View className="flex-1 gap-4">
        {items.map((i) => (
          <View key={i.key}>
            <View className="flex-row items-center gap-2">
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i.color }} />
              <Text {...COMPACT_TEXT} className="text-lg font-bold text-white" numberOfLines={1} adjustsFontSizeToFit>
                {i.value}
              </Text>
            </View>
            <Text {...COMPACT_TEXT} className="ml-[18px] text-xs text-muted" numberOfLines={indic ? 2 : 1}>
              {i.label}
            </Text>
          </View>
        ))}
      </View>
      <Donut items={items} percent={percent} />
    </View>
  );
}
