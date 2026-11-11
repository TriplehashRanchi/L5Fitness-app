import { Exo2_900Black, useFonts } from '@expo-google-fonts/exo-2';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/providers/auth-provider';

// One accent colour, used sparingly: a single headline word, the progress bar and the button.
const BRAND = '#3ddc68';
const INK = '#050806';
/** Wide, heavy sport display face for headlines (loaded in OnboardingScreen). */
const DISPLAY = 'Exo2_900Black';

/** Image moves slower than the swipe (parallax). Fraction of screen width. */
const PARALLAX = 0.15;

/** Height of the full-width "Next" / "Get started" button. */
const CTA_HEIGHT = 58;

// Photos: Unsplash (free licence), cropped to 1080×2160 portrait. Replace with your own anytime.
const SLIDES = [
  {
    image: require('@/assets/onboarding/slide-1.jpg'),
    tag: 'Train',
    lead: 'Train like',
    accent: 'you mean',
    tail: 'it.',
    body: 'Coach-built plans that fit your level, from your very first rep to your next PR.',
  },
] as const;

type Slide = (typeof SLIDES)[number];

function SlideView({
  slide,
  index,
  scrollX,
  width,
  bottomInset,
  fontReady,
}: {
  slide: Slide;
  index: number;
  scrollX: SharedValue<number>;
  width: number;
  bottomInset: number;
  fontReady: boolean;
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

      {/* Neutral black only where text sits, so the photos keep their natural colour */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(5,8,6,0.78)', INK]}
        locations={[0, 0.16, 0.45, 0.76, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Copy: left-aligned, anchored to the bottom */}
      <Animated.View
        style={[{ position: 'absolute', left: 24, right: 24, bottom: bottomInset + 112 }, copyStyle]}>
        <Text
          maxFontSizeMultiplier={1.1}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={fontReady ? { fontFamily: DISPLAY } : { fontWeight: '900' }}
          className="text-[40px] uppercase leading-[44px] text-white">
          {slide.lead}
          {'\n'}
          <Text style={{ color: BRAND }}>{slide.accent}</Text> {slide.tail}
        </Text>

        <Text maxFontSizeMultiplier={1.3} className="mt-4 max-w-[310px] text-[15px] leading-[22px] text-white/70">
          {slide.body}
        </Text>
      </Animated.View>
    </View>
  );
}

const SWIPE_PAD = 6;
const SWIPE_KNOB = CTA_HEIGHT - SWIPE_PAD * 2;

/** One of the ">>>" hints: a light wave runs through the three, and they vanish once you start dragging. */
function WaveChevron({ index, wave, x }: { index: number; wave: SharedValue<number>; x: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const dist = Math.abs(wave.value * 4 - (index + 0.5));
    return { opacity: (0.25 + 0.75 * Math.max(0, 1 - dist)) * (1 - Math.min(x.value / 40, 1)) };
  });
  return (
    <Animated.View style={[{ marginLeft: -5 }, style]}>
      <SymbolView
        name={{ ios: 'chevron.compact.right', android: 'arrow_forward_ios', web: 'arrow_forward_ios' }}
        size={12}
        weight="semibold"
        tintColor="#ffffff"
      />
    </Animated.View>
  );
}

/** Last slide: drag the knob across the track to start (or use the screen-reader "activate" action). */
function SwipeToStart({ onComplete }: { onComplete: () => void }) {
  const x = useSharedValue(0);
  const maxX = useSharedValue(1);
  const press = useSharedValue(0); // 1 while the knob is held
  const wave = useSharedValue(0); // chevron wave, 0 → 1 on repeat
  const done = useSharedValue(false);

  useEffect(() => {
    wave.set(withRepeat(withTiming(1, { duration: 1500, easing: Easing.linear }), -1, false));
  }, [wave]);

  const finish = () => {
    if (done.get()) return;
    done.set(true);
    onComplete();
  };

  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => press.set(withTiming(1, { duration: 120 })),
      onPanResponderMove: (_, g) => {
        x.set(Math.min(Math.max(g.dx, 0), maxX.get()));
      },
      onPanResponderRelease: (_, g) => {
        press.set(withTiming(0, { duration: 160 }));
        if (g.dx >= maxX.get() * 0.8) {
          x.set(withTiming(maxX.get(), { duration: 120 }));
          finish();
        } else {
          x.set(withSpring(0));
        }
      },
      onPanResponderTerminate: () => {
        press.set(withTiming(0, { duration: 160 }));
        x.set(withSpring(0));
      },
    })
  );

  // Knob grows a little and glows green while it is held.
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { scale: 1 + 0.08 * press.value }],
    shadowOpacity: 0.7 * press.value,
    elevation: 10 * press.value,
  }));
  // Bright green fill that follows the knob.
  const fillStyle = useAnimatedStyle(() => ({ width: x.value + SWIPE_KNOB + SWIPE_PAD * 2 }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, Math.max(maxX.value * 0.6, 1)], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel="Swipe to start"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={finish}
      onLayout={(e) => maxX.set(Math.max(1, e.nativeEvent.layout.width - SWIPE_KNOB - SWIPE_PAD * 2))}
      style={{ height: CTA_HEIGHT, padding: SWIPE_PAD }}
      className="w-full justify-center overflow-hidden rounded-full">
      <LinearGradient
        colors={['#24b24c', '#0d6527']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Soft trail behind the knob: fades in from the left, rounded end hugging the knob */}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden', borderRadius: CTA_HEIGHT / 2 },
          fillStyle,
        ]}>
        <LinearGradient
          colors={['rgba(61,220,104,0)', 'rgba(61,220,104,0.6)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Hint: text in the middle, animated chevrons on the right */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, labelStyle]}
        className="flex-row items-center justify-center">
        <Text maxFontSizeMultiplier={1.15} numberOfLines={1} className="text-lg font-semibold text-white">
          Swipe to Start
        </Text>
      </Animated.View>
      <View pointerEvents="none" className="absolute right-6 flex-row items-center">
        {[0, 1, 2].map((i) => (
          <WaveChevron key={i} index={i} wave={wave} x={x} />
        ))}
      </View>

      {/* Draggable knob */}
      <Animated.View
        {...pan.panHandlers}
        style={[
          {
            width: SWIPE_KNOB,
            height: SWIPE_KNOB,
            borderRadius: SWIPE_KNOB / 2,
            backgroundColor: '#ffffff',
            shadowColor: BRAND,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 0 },
          },
          knobStyle,
        ]}
        className="items-center justify-center">
        <SymbolView
          name={{ ios: 'chevron.compact.right', android: 'arrow_forward_ios', web: 'arrow_forward_ios' }}
          size={14}
          weight="semibold"
          tintColor="#0d6527"
        />
      </Animated.View>
    </View>
  );
}

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuth();
  // Never block the screen on the font: it shows right away and the headline font swaps in once loaded.
  const [fontsLoaded] = useFonts({ Exo2_900Black });

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

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

  const skipStyle = useAnimatedStyle(() => {
    const range = [(SLIDES.length - 2) * width, (SLIDES.length - 1) * width];
    return {
      opacity: interpolate(scrollX.value, range, [1, 0], Extrapolation.CLAMP),
      transform: [{ translateX: interpolate(scrollX.value, range, [0, 24], Extrapolation.CLAMP) }],
    };
  });

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
            fontReady={fontsLoaded}
          />
        ))}
      </Animated.ScrollView>

      {/* Top bar: skip */}
      <View
        className="absolute left-0 right-0 flex-row items-center justify-end px-6"
        style={{ top: insets.top + 8 }}>
        {/* Skip: plain text, fades + slides away as the last slide arrives. */}
        <Animated.View style={[skipStyle, { pointerEvents: isLast ? 'none' : 'auto' }]}>
          <Pressable
            onPress={() => completeOnboarding()}
            hitSlop={14}
            accessibilityRole="button"
            accessibilityLabel="Skip intro"
            className="py-1 active:opacity-60">
            <Text
              maxFontSizeMultiplier={1.2}
              className="text-xs font-bold uppercase tracking-[2px] text-white/85">
              Skip
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Bottom: full-width button */}
      <View className="absolute left-0 right-0 px-6" style={{ bottom: insets.bottom + 24 }}>
        {isLast ? (
          <SwipeToStart onComplete={completeOnboarding} />
        ) : (
        <Pressable
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel={isLast ? 'Get started' : 'Next slide'}
          style={{ height: CTA_HEIGHT }}
          className="w-full flex-row items-center justify-center gap-2.5 overflow-hidden rounded-full active:opacity-85">
          <LinearGradient
            colors={['#24b24c', '#0d6527']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Text
            maxFontSizeMultiplier={1.15}
            numberOfLines={1}
            className="text-lg font-semibold text-white">
            Next
          </Text>
          <SymbolView
            name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
            size={18}
            tintColor="#ffffff"
          />
        </Pressable>
        )}
      </View>
    </View>
  );
}
