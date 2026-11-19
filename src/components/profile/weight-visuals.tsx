import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { DisplayText } from '@/components/display-text';
import { fmtKg } from '@/lib/body';
import type { WeightEntry } from '@/lib/wellness-api';

const BRAND = '#3ddc68';
const MUTED = '#8fa396';
const TRACK = 'rgba(255,255,255,0.08)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

const num = (kg: number) => String(parseFloat(kg.toFixed(1)));

/** The current weight inside a ring that fills as the goal gets closer (`progress` is 0 to 1). */
export function WeightRing({ weightKg, progress }: { weightKg: number; progress: number }) {
  const size = 168;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const shown = Math.min(1, Math.max(0, progress));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Current weight ${fmtKg(weightKg)}, ${Math.round(shown * 100)} percent of the way to your goal`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(shown * 100) }}
      className="items-center justify-center"
      style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={TRACK} strokeWidth={stroke} fill="none" />
        {shown > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={BRAND}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${len * shown} ${len}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <DisplayText {...COMPACT_TEXT} className="text-white" style={{ fontSize: 44, lineHeight: 48 }}>
        {num(weightKg)}
      </DisplayText>
      <Text {...COMPACT_TEXT} className="font-semibold text-muted" style={{ fontSize: 14 }}>
        kg now
      </Text>
    </View>
  );
}

/** "2026-11-18" → "18 Nov". */
function shortDay(day: string, locale: string) {
  try {
    return new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    return day;
  }
}

/**
 * The recent weigh-ins as a line, oldest on the left, with the target as a dashed line.
 * The scale runs from just under the lowest value to just over the highest, so small changes show.
 */
export function WeightTrend({ history, targetKg, locale, max = 12 }: { history: WeightEntry[]; targetKg: number; locale: string; max?: number }) {
  const [width, setWidth] = useState(0);
  const entries = history.slice(0, max).reverse(); // newest first → oldest first
  if (entries.length < 2) {
    return (
      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
        Log your weight a few times to see the line here.
      </Text>
    );
  }
  const H = 132;
  const PAD_X = 10;
  const PAD_TOP = 26;
  const PAD_BOTTOM = 10;
  const values = entries.map((e) => e.weightKg);
  const low = Math.min(...values, targetKg);
  const high = Math.max(...values, targetKg);
  const span = Math.max(high - low, 1);
  const x = (i: number) => PAD_X + (i / (entries.length - 1)) * (width - PAD_X * 2);
  const y = (kg: number) => PAD_TOP + (1 - (kg - low) / span) * (H - PAD_TOP - PAD_BOTTOM);

  // A soft curve through the points: each segment bends at the midpoint between two weigh-ins.
  let line = `M ${x(0)} ${y(values[0])}`;
  for (let i = 1; i < values.length; i += 1) {
    const mid = (x(i - 1) + x(i)) / 2;
    line += ` C ${mid} ${y(values[i - 1])} ${mid} ${y(values[i])} ${x(i)} ${y(values[i])}`;
  }
  const area = `${line} L ${x(values.length - 1)} ${H} L ${x(0)} ${H} Z`;
  const last = values.length - 1;
  const first = entries[0];
  const latest = entries[last];

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Weight from ${shortDay(first.day, locale)} to ${shortDay(latest.day, locale)}: ${fmtKg(first.weightKg)} to ${fmtKg(latest.weightKg)}. Target ${fmtKg(targetKg)}.`}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ height: H }}>
        {width > 0 ? (
          <>
            <Svg width={width} height={H}>
              <Defs>
                <LinearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={BRAND} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={BRAND} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Line x1={0} x2={width} y1={y(targetKg)} y2={y(targetKg)} stroke={MUTED} strokeWidth={1} strokeDasharray="4 5" opacity={0.7} />
              <Path d={area} fill="url(#weight-fill)" />
              <Path d={line} stroke={BRAND} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              {values.map((v, i) =>
                i === last ? null : <Circle key={entries[i].id} cx={x(i)} cy={y(v)} r={3} fill="#0b1a11" stroke={BRAND} strokeWidth={2} />
              )}
              <Circle cx={x(last)} cy={y(values[last])} r={9} fill={BRAND} opacity={0.25} />
              <Circle cx={x(last)} cy={y(values[last])} r={5} fill={BRAND} />
            </Svg>
            {/* The latest value, written above its dot. */}
            <Text
              {...COMPACT_TEXT}
              className="absolute font-bold text-brand"
              style={{ fontSize: 13, right: 0, top: Math.max(0, y(values[last]) - 26) }}>
              {num(values[last])}
            </Text>
            <Text {...COMPACT_TEXT} className="absolute text-muted" style={{ fontSize: 11, left: 0, top: Math.max(0, y(targetKg) - 16) }}>
              Target {num(targetKg)}
            </Text>
          </>
        ) : null}
      </View>
      <View className="flex-row justify-between" style={{ marginTop: 6 }}>
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12 }}>
          {shortDay(first.day, locale)}
        </Text>
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12 }}>
          {shortDay(latest.day, locale)}
        </Text>
      </View>
    </View>
  );
}

const BMI_MIN = 15;
const BMI_MAX = 35;
const BANDS = [
  { from: BMI_MIN, to: 18.5, color: '#38bdf8' },
  { from: 18.5, to: 25, color: BRAND },
  { from: 25, to: 30, color: '#fbbf24' },
  { from: 30, to: BMI_MAX, color: '#fb923c' },
];

/** A four-colour bar from 15 to 35 with a marker where this BMI sits. */
export function BmiScale({ value }: { value: number }) {
  const at = Math.min(1, Math.max(0, (value - BMI_MIN) / (BMI_MAX - BMI_MIN)));
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`BMI ${value} on a scale from ${BMI_MIN} to ${BMI_MAX}`}>
      <View style={{ height: 22, justifyContent: 'center' }}>
        <View className="flex-row overflow-hidden rounded-full" style={{ height: 8, gap: 3 }}>
          {BANDS.map((b) => (
            <View key={b.to} style={{ flex: b.to - b.from, backgroundColor: b.color, opacity: 0.85 }} />
          ))}
        </View>
        <View
          style={{
            position: 'absolute',
            left: `${at * 100}%`,
            marginLeft: -9,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#ffffff',
            borderWidth: 4,
            borderColor: '#0b1a11',
          }}
        />
      </View>
      <View style={{ height: 16, marginTop: 4 }}>
        {[18.5, 25, 30].map((t) => (
          <Text
            key={t}
            {...COMPACT_TEXT}
            className="absolute text-center text-muted"
            style={{ fontSize: 11, width: 36, marginLeft: -18, left: `${((t - BMI_MIN) / (BMI_MAX - BMI_MIN)) * 100}%` }}>
            {t}
          </Text>
        ))}
      </View>
    </View>
  );
}
