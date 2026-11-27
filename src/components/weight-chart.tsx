import { useMemo, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { DisplayText } from '@/components/display-text';
import { fmtKg } from '@/lib/body';
import type { Key } from '@/lib/i18n';
import type { WeightEntry } from '@/lib/wellness-api';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const MUTED = '#8fa396';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const H = 150;
const PAD_X = 10;
const PAD_TOP = 18;
const PAD_BOTTOM = 12;
const DAY_MS = 86_400_000;

type Range = 'month' | 'quarter' | 'all';
const RANGES: { id: Range; days: number | null; label: Key }[] = [
  { id: 'month', days: 30, label: 'prof.trend.month' },
  { id: 'quarter', days: 90, label: 'prof.trend.quarter' },
  { id: 'all', days: null, label: 'prof.trend.all' },
];

const time = (day: string) => Date.parse(`${day}T00:00:00Z`);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** "2026-11-18" → "18 Nov". */
function shortDay(day: string, locale: string) {
  try {
    return new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    return day;
  }
}

/**
 * The weigh-ins as a line that answers to touch: tap or slide along it to read any day, and choose how far back
 * to look. It is drawn from whatever `history` holds, so a new or corrected weigh-in shows at once.
 *
 * `history` is newest first; a day weighed more than once counts with its latest weigh-in. `targetKg` adds the
 * dashed target line.
 */
export function WeightChart({ history, targetKg, locale }: { history: WeightEntry[]; targetKg?: number | null; locale: string }) {
  const t = useT();
  const [width, setWidth] = useState(0);
  const [chosen, setChosen] = useState<Range | null>(null);
  /** The day being read; null follows the latest, also when a new weigh-in arrives. */
  const [picked, setPicked] = useState<string | null>(null);

  // One point a day, oldest first.
  const all = useMemo(() => {
    const byDay = new Map<string, WeightEntry>();
    for (const e of history) if (!byDay.has(e.day)) byDay.set(e.day, e);
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [history]);

  const span = all.length > 1 ? (time(all[all.length - 1].day) - time(all[0].day)) / DAY_MS : 0;
  // Only choices that would show something different are offered.
  const ranges = RANGES.filter((r) => r.days == null || span >= r.days);
  const range = ranges.find((r) => r.id === chosen) ?? ranges.find((r) => r.id === 'quarter') ?? ranges[ranges.length - 1];
  const entries = range.days == null || !all.length ? all : all.filter((e) => time(e.day) >= time(all[all.length - 1].day) - (range.days! - 1) * DAY_MS);

  const found = entries.findIndex((e) => e.day === picked);
  const at = found >= 0 ? found : entries.length - 1;

  const first = entries[0];
  const last = entries[entries.length - 1];
  const from = first ? time(first.day) : 0;
  const length = last ? Math.max(1, time(last.day) - from) : 1;
  // Placed by date, so a long gap between weigh-ins looks like one.
  const x = (i: number) => (entries.length < 2 ? width / 2 : PAD_X + ((time(entries[i].day) - from) / length) * (width - PAD_X * 2));

  /** The weigh-in nearest to where the finger is. */
  const pick = (touchX: number) => {
    if (width <= 0 || !entries.length) return;
    let near = 0;
    for (let i = 1; i < entries.length; i += 1) if (Math.abs(x(i) - touchX) < Math.abs(x(near) - touchX)) near = i;
    setPicked(near === entries.length - 1 ? null : entries[near].day);
  };

  // Made anew each draw so it always reads the points now on screen.
  const touch = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
    onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
    // A mostly upward or downward move is the page being scrolled: let it have the touch.
    onPanResponderTerminationRequest: (_, g) => Math.abs(g.dy) > Math.abs(g.dx),
  });

  if (all.length < 2) {
    return (
      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
        {t('prof.trend.empty')}
      </Text>
    );
  }

  const here = entries[at];
  const values = entries.map((e) => e.weightKg);
  const low = Math.min(...values, targetKg ?? Infinity);
  const high = Math.max(...values, targetKg ?? -Infinity);
  const room = Math.max(high - low, 1);
  const y = (kg: number) => PAD_TOP + (1 - (kg - low) / room) * (H - PAD_TOP - PAD_BOTTOM);

  // A soft curve through the points: each part bends at the midpoint between two weigh-ins.
  let line = `M ${x(0)} ${y(values[0])}`;
  for (let i = 1; i < values.length; i += 1) {
    const mid = (x(i - 1) + x(i)) / 2;
    line += ` C ${mid} ${y(values[i - 1])} ${mid} ${y(values[i])} ${x(i)} ${y(values[i])}`;
  }
  const area = `${line} L ${x(values.length - 1)} ${H} L ${x(0)} ${H} Z`;

  const diff = round1(here.weightKg - first.weightKg);
  const change = at === 0 ? null : `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)} kg`;
  const reading = `${shortDay(here.day, locale)}: ${fmtKg(here.weightKg)}`;
  const step = (by: number) => {
    const next = Math.min(entries.length - 1, Math.max(0, at + by));
    setPicked(next === entries.length - 1 ? null : entries[next].day);
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* The day being read. */}
      <View className="flex-row items-end" style={{ gap: 12, marginBottom: 6 }}>
        <View className="flex-1">
          <DisplayText {...COMPACT_TEXT} className="text-white" style={{ fontSize: 28, lineHeight: 34 }} numberOfLines={1} adjustsFontSizeToFit>
            {fmtKg(here.weightKg)}
          </DisplayText>
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, lineHeight: 18 }}>
            {shortDay(here.day, locale)}
          </Text>
        </View>
        {change ? (
          <View className="items-end" style={{ flexShrink: 1 }}>
            <Text {...COMPACT_TEXT} className="font-black text-white" style={{ fontSize: 15, lineHeight: 21 }}>
              {change}
            </Text>
            <Text {...COMPACT_TEXT} className="text-right text-muted" style={{ fontSize: 12, lineHeight: 18 }}>
              {t('prof.trend.since', { date: shortDay(first.day, locale) })}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ height: H }}>
        {width > 0 ? (
          <>
            <Svg width={width} height={H}>
              <Defs>
                <LinearGradient id="weight-chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={BRAND} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={BRAND} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {targetKg != null ? <Line x1={0} x2={width} y1={y(targetKg)} y2={y(targetKg)} stroke={MUTED} strokeWidth={1} strokeDasharray="4 5" opacity={0.7} /> : null}
              {entries.length > 1 ? (
                <>
                  <Path d={area} fill="url(#weight-chart-fill)" />
                  <Path d={line} stroke={BRAND} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </>
              ) : null}
              {/* Dots only while there is room between them. */}
              {entries.length <= 35
                ? entries.map((e, i) => (i === at ? null : <Circle key={e.id} cx={x(i)} cy={y(e.weightKg)} r={3} fill="#000000" stroke={BRAND} strokeWidth={2} />))
                : null}
              <Line x1={x(at)} x2={x(at)} y1={0} y2={H} stroke="#ffffff" strokeWidth={1} opacity={0.35} />
              <Circle cx={x(at)} cy={y(here.weightKg)} r={10} fill={BRAND} opacity={0.28} />
              <Circle cx={x(at)} cy={y(here.weightKg)} r={5} fill="#ffffff" stroke={BRAND} strokeWidth={2} />
            </Svg>
            {targetKg != null ? (
              <Text {...COMPACT_TEXT} className="absolute text-muted" style={{ fontSize: 11, left: 0, top: Math.max(0, y(targetKg) - 16) }}>
                {t('prof.trend.target', { kg: String(round1(targetKg)) })}
              </Text>
            ) : null}
            {/* Takes the touches, above the drawing, so the finger's place is measured from the chart's edge. */}
            <View
              {...touch.panHandlers}
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel={t('prof.trend.hint')}
              accessibilityValue={{ text: reading }}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            />
          </>
        ) : null}
      </View>

      <View className="flex-row justify-between" style={{ marginTop: 6 }}>
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12 }}>
          {shortDay(first.day, locale)}
        </Text>
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12 }}>
          {shortDay(last.day, locale)}
        </Text>
      </View>

      {ranges.length > 1 ? (
        <View accessibilityRole="tablist" className="flex-row" style={{ gap: 8, marginTop: 14 }}>
          {ranges.map((r) => {
            const on = r.id === range.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => {
                  setChosen(r.id);
                  setPicked(null);
                }}
                hitSlop={{ top: 5, bottom: 5 }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                className="flex-1 items-center justify-center active:opacity-70"
                style={{ minHeight: 34, paddingHorizontal: 4, borderRadius: 17, borderWidth: 1, borderColor: on ? BRAND : 'rgba(255,255,255,0.18)', backgroundColor: on ? BRAND : 'rgba(255,255,255,0.05)' }}>
                <Text {...COMPACT_TEXT} style={{ fontSize: 12, fontWeight: '800', color: on ? INK : '#ffffff' }} numberOfLines={1} adjustsFontSizeToFit>
                  {t(r.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <Text {...COMPACT_TEXT} className="text-center text-muted" style={{ fontSize: 11, lineHeight: 16, marginTop: 10 }}>
        {t('prof.trend.hint')}
      </Text>
    </View>
  );
}
