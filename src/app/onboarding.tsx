import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/auth-provider';

const BRAND = '#c6f432';
const INK = '#0b0b0d';

/** Image moves slower than the swipe (parallax). Fraction of screen width. */
const PARALLAX = 0.15;

/** Round "next" button size, and its width once it turns into "Get started". */
const CTA_SIZE = 64;
const CTA_WIDE = 190;

// Photos: Unsplash (free licence), cropped to 1080×2160 portrait. Replace with your own anytime.
const SLIDES = [
  {
    image: require('@/assets/onboarding/slide-1.jpg'),
    tag: 'Train',
    lead: 'Build your',
    accent: 'strongest',
    tail: 'self.',
    body: 'Coach-built plans for every level. From your first rep to your next PR.',
  },
  {
    image: require('@/assets/onboarding/slide-2.jpg'),
    tag: 'Track',
    lead: 'Every rep.',
    accent: 'Every',
    tail: 'win.',
    body: 'Log workouts, watch your numbers climb and keep your streak alive.',
  },
  {
    image: require('@/assets/onboarding/slide-3.jpg'),
    tag: 'Book',
    lead: 'Your gym,',
    accent: 'one tap',
    tail: 'away.',
    body: 'HIIT, strength, yoga, boxing. Reserve your spot in seconds.',
  },
] as const;

type Slide = (typeof SLIDES)[number];

function SlideView({
  slide,
  index,
  scrollX,
  width,
  bottomInset,
}: {
  slide: Slide;
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  bottomInset: number;
}) {
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          range,
          [-PARALLAX * width, 0, PARALLAX * width],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollX.value, range, [30, 0, 30], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={{ width }} className="h-full overflow-hidden bg-ink">
      {/* Full-bleed photo, slightly wider than the screen for the parallax */}
      <Animated.View
        style={[
          { position: 'absolute', top: 0, bottom: 0, left: -PARALLAX * width, width: width * (1 + PARALLAX * 2) },
          imageStyle,
        ]}>
        <Image
          source={slide.image}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      {/* Dark at the top (status bar) and fading to solid ink at the bottom (text) */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)', 'rgba(11,11,13,0.15)', 'rgba(11,11,13,0.92)', INK]}
        locations={[0, 0.2, 0.42, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Copy */}
      <Animated.View
        style={[{ position: 'absolute', left: 24, right: 24, bottom: bottomInset + 120 }, copyStyle]}>
        <View className="mb-5 flex-row items-center">
          <Text
            maxFontSizeMultiplier={1.2}
            className="text-xs font-bold uppercase tracking-[4px] text-brand">
            {String(index + 1).padStart(2, '0')} · {slide.tag}
          </Text>
        </View>

        <Text
          maxFontSizeMultiplier={1.15}
          className="text-[44px] font-black leading-[48px] tracking-tight text-white">
          {slide.lead}
          {'\n'}
          <Text className="text-brand">{slide.accent}</Text> {slide.tail}
        </Text>

        <Text maxFontSizeMultiplier={1.3} className="mt-4 max-w-[330px] text-base leading-6 text-white/65">
          {slide.body}
        </Text>
      </Animated.View>
    </View>
  );
}

function Dot({ index, scrollX, width }: { index: number; scrollX: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const range = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, range, [8, 30, 8], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(scrollX.value, range, [
        'rgba(255,255,255,0.25)',
        BRAND,
        'rgba(255,255,255,0.25)',
      ]),
    };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4 }, style]} />;
}

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuth();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  // 0 = round arrow button, 1 = wide "Get started" button
  const expand = useSharedValue(0);
  useEffect(() => {
    expand.value = withTiming(isLast ? 1 : 0, { duration: 320 });
  }, [isLast, expand]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const goNext = () => {
    if (isLast) {
      completeOnboarding();
      return;
    }
    const next = index + 1;
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setIndex(next);
  };

  const ctaStyle = useAnimatedStyle(() => ({
    width: interpolate(expand.value, [0, 1], [CTA_SIZE, CTA_WIDE]),
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0, 0.4], [1, 0], Extrapolation.CLAMP),
  }));
  const skipStyle = useAnimatedStyle(() => {
    const range = [(SLIDES.length - 2) * width, (SLIDES.length - 1) * width];
    return {
      opacity: interpolate(scrollX.value, range, [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(scrollX.value, range, [0, 24], Extrapolation.CLAMP) }],
    };
  });
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}>
        {SLIDES.map((slide, i) => (
          <SlideView
            key={slide.tag}
            slide={slide}
            index={i}
            scrollX={scrollX}
            width={width}
            bottomInset={insets.bottom}
          />
        ))}
      </Animated.ScrollView>

      {/* Top bar: brand + skip */}
      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-6"
        style={{ top: insets.top + 8 }}>
        <View className="flex-row items-center gap-2.5">
          <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-brand">
            <Text maxFontSizeMultiplier={1.1} className="text-[13px] font-black text-ink">
              L5
            </Text>
          </View>
          <Text maxFontSizeMultiplier={1.1} className="text-[13px] font-black tracking-[3px] text-white">
            FITNESS
          </Text>
        </View>

        {/* Skip: glass pill with a lime arrow chip. Fades + slides away as the last slide arrives. */}
        <Animated.View style={[skipStyle, { pointerEvents: isLast ? 'none' : 'auto' }]}>
          <Pressable
            onPress={() => completeOnboarding()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip intro"
            className="flex-row items-center gap-1.5 rounded-full border border-white/15 bg-black/35 py-1 pl-3 pr-1 active:scale-95 active:opacity-80">
            <Text
              maxFontSizeMultiplier={1.2}
              className="text-[11px] font-semibold uppercase tracking-[1.5px] text-white/90">
              Skip
            </Text>
            <View className="h-5 w-5 items-center justify-center rounded-full bg-brand">
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={9}
                weight="bold"
                tintColor={INK}
              />
            </View>
          </Pressable>
        </Animated.View>
      </View>

      {/* Bottom bar: dots + CTA */}
      <View
        className="absolute left-0 right-0 flex-row items-center justify-between px-6"
        style={{ bottom: insets.bottom + 28 }}>
        <View
          className="flex-row items-center gap-2"
          accessibilityLabel={`Slide ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <Dot key={s.tag} index={i} scrollX={scrollX} width={width} />
          ))}
        </View>

        <Pressable
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Get started' : 'Next slide'}
          className="active:opacity-85">
          <Animated.View
            style={[{ height: CTA_SIZE, borderRadius: CTA_SIZE / 2 }, ctaStyle]}
            className="items-center justify-center overflow-hidden bg-brand">
            <Animated.View style={[StyleSheet.absoluteFill, arrowStyle]} className="items-center justify-center">
              <SymbolView
                name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                size={24}
                tintColor={INK}
              />
            </Animated.View>
            <Animated.View style={labelStyle} className="flex-row items-center gap-2">
              <Text maxFontSizeMultiplier={1.15} numberOfLines={1} className="text-base font-black text-ink">
                Get started
              </Text>
              <SymbolView
                name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
                size={18}
                tintColor={INK}
              />
            </Animated.View>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}
