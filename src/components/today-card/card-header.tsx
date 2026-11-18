import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';

import { DisplayText } from '@/components/display-text';
import { BRAND, COMPACT_TEXT, TRACK } from '@/components/today-card/ui';

const SIZE = 76;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Ring({ percent }: { percent: number }) {
  const reduce = useReducedMotion();
  const p = useSharedValue(percent);
  useEffect(() => {
    p.value = reduce ? percent : withTiming(percent, { duration: 600 });
  }, [percent, reduce, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - p.value / 100) }));
  const done = percent >= 100;
  return (
    <View style={{ width: SIZE, height: SIZE }} className="items-center justify-center">
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={TRACK} strokeWidth={STROKE} fill={done ? 'rgba(61,220,104,0.12)' : 'none'} />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={BRAND}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRC} ${CIRC}`}
          rotation={-90}
          origin={`${SIZE / 2}, ${SIZE / 2}`}
          animatedProps={props}
        />
      </Svg>
      <View className="absolute items-center justify-center">
        {done ? (
          <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={BRAND} size={28} />
        ) : (
          <DisplayText {...COMPACT_TEXT} style={{ fontSize: 22, lineHeight: 26 }} className="text-white">
            {percent}
            <Text style={{ fontSize: 12 }}>%</Text>
          </DisplayText>
        )}
      </View>
    </View>
  );
}

/** A short, warm line for how the day is going. */
function headline(percent: number, total: number, done: number) {
  if (total > 0 && done >= total) return 'Day complete';
  if (percent === 0) return 'Let’s get started';
  if (percent < 40) return 'Nice start';
  if (percent < 75) return 'Going great';
  return 'Almost there';
}

/** One calm header: a short line about how the day is going, the count, and the ring. */
export function CardHeader({
  dateLabel,
  percent,
  done,
  total,
}: {
  dateLabel: string;
  percent: number;
  done: number;
  total: number;
}) {
  const complete = total > 0 && done >= total;
  const line = headline(percent, total, done);
  return (
    <View className="flex-row items-center gap-4">
      <View className="flex-1">
        <DisplayText {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit className="text-[26px] leading-8 tracking-tight text-white">
          {line}
        </DisplayText>
        <Text {...COMPACT_TEXT} className="mt-1 text-sm text-muted" numberOfLines={1}>
          {dateLabel} · {done} of {total} done
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Today's plan, ${line}`}
        accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent} percent complete, ${done} of ${total} done` }}>
        <Ring percent={complete ? 100 : percent} />
      </View>
    </View>
  );
}
