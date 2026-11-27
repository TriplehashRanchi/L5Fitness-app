import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { DisplayText } from '@/components/display-text';
import { fmtKg } from '@/lib/body';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
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
  const t = useT();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('prof.ring.label', { kg: fmtKg(weightKg), percent: Math.round(shown * 100) })}
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
        {t('prof.ring.now')}
      </Text>
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
  const t = useT();
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={t('prof.bmiScale.label', { value, min: BMI_MIN, max: BMI_MAX })}>
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
            borderColor: '#000000',
          }}
        />
      </View>
      <View style={{ height: 16, marginTop: 4 }}>
        {[18.5, 25, 30].map((mark) => (
          <Text
            key={mark}
            {...COMPACT_TEXT}
            className="absolute text-center text-muted"
            style={{ fontSize: 11, width: 36, marginLeft: -18, left: `${((mark - BMI_MIN) / (BMI_MAX - BMI_MIN)) * 100}%` }}>
            {mark}
          </Text>
        ))}
      </View>
    </View>
  );
}
