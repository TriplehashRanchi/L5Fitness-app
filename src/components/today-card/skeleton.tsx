import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { HAIRLINE } from '@/components/today-card/ui';
import { useT } from '@/providers/language-provider';

const BLOCKS = [120, 150, 100, 110, 110];

/** Same card, same block heights, while Home is still loading. */
export function TodayCardSkeleton() {
  const t = useT();
  const reduce = useReducedMotion();
  const o = useSharedValue(0.5);
  useEffect(() => {
    if (!reduce) o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [reduce, o]);
  const pulse = useAnimatedStyle(() => ({ opacity: o.value }));
  const bar = { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8 } as const;
  return (
    <View
      accessible
      accessibilityLabel={t('hm.loadingPlan')}
      accessibilityRole="progressbar"
      className="mx-5 mb-5"
      style={{ padding: 18 }}>
      <Animated.View style={pulse}>
        <View style={{ height: 120 }} className="justify-center">
          <View style={[bar, { height: 26, width: '50%' }]} />
          <View style={[bar, { height: 14, width: '35%', marginTop: 10 }]} />
          <View style={[bar, { height: 6, width: '100%', marginTop: 28 }]} />
        </View>
        {BLOCKS.map((h, i) => (
          <View key={i} style={{ height: h, borderTopWidth: 1, borderTopColor: HAIRLINE, paddingTop: 20 }}>
            <View style={[bar, { height: 16, width: '40%' }]} />
            <View style={[bar, { height: 10, width: '90%', marginTop: 14 }]} />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}
