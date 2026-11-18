import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { DisplayText } from '@/components/display-text';

/** Same size as `imageWidth` of the expo-splash-screen plugin in app.json, so the hand-off is seamless. */
const MARK_SIZE = 110;
/** The native splash's background, and the app's own green for the rings and the heartbeat. */
const BACKGROUND = '#0B0B0D';
const LIME = '#3ddc68';
const BEAT_HEIGHT = 64;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** A heartbeat trace across the full width: flat, a small bump, one tall spike, a small bump, flat. */
function beatPath(w: number) {
  const m = BEAT_HEIGHT / 2;
  const x = (f: number) => (w * f).toFixed(1);
  return `M 0 ${m} L ${x(0.3)} ${m} L ${x(0.35)} ${m - 9} L ${x(0.39)} ${m} L ${x(0.44)} ${m} L ${x(0.47)} 4 L ${x(0.52)} ${BEAT_HEIGHT - 4} L ${x(0.56)} ${m} L ${x(0.61)} ${m} L ${x(0.66)} ${m - 11} L ${x(0.7)} ${m} L ${w} ${m}`;
}

/**
 * App start. The native splash (logo on dark) hands over to this overlay, then:
 * two rings pulse out from the logo, a heartbeat line draws across the screen, the name rises in,
 * and everything fades into the app. With "reduce motion" on there is only a short fade.
 */
export function SplashOverlay() {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const beatLength = width + 190; // a little more than the real length of the trace

  const opacity = useSharedValue(1);
  const logoScale = useSharedValue(1);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const beat = useSharedValue(0);
  const beatOpacity = useSharedValue(1);
  const name = useSharedValue(0);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }] }));
  const ring1Style = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - ring1.value), transform: [{ scale: 1 + ring1.value * 1.7 }] }));
  const ring2Style = useAnimatedStyle(() => ({ opacity: 0.4 * (1 - ring2.value), transform: [{ scale: 1 + ring2.value * 1.7 }] }));
  const beatProps = useAnimatedProps(() => ({ strokeDashoffset: beatLength * (1 - beat.value) }));
  const beatStyle = useAnimatedStyle(() => ({ opacity: beatOpacity.value }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: name.value, transform: [{ translateY: (1 - name.value) * 10 }] }));

  if (!visible) return null;

  const finish = (delay: number) => {
    opacity.set(
      withDelay(
        delay,
        withTiming(0, { duration: 420 }, (finished) => {
          if (finished) scheduleOnRN(setVisible, false);
        })
      )
    );
  };

  const start = () => {
    SplashScreen.hideAsync().finally(() => {
      if (reduceMotion) {
        name.set(1);
        finish(400);
        return;
      }
      // One strong "beat" of the logo, with two rings going out from it.
      logoScale.set(withSequence(withTiming(0.9, { duration: 140 }), withSpring(1, { damping: 7, stiffness: 180 })));
      ring1.set(withDelay(140, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })));
      ring2.set(withDelay(380, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })));
      // The heartbeat draws from left to right, then dims.
      beat.set(withDelay(250, withTiming(1, { duration: 1050, easing: Easing.inOut(Easing.cubic) })));
      beatOpacity.set(withDelay(1500, withTiming(0.35, { duration: 400 })));
      name.set(withDelay(650, withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) })));
      finish(2000);
    });
  };

  return (
    <Animated.View onLayout={start} style={[styles.overlay, containerStyle]}>
      <View style={styles.mark}>
        <Animated.View style={[styles.ring, ring1Style]} />
        <Animated.View style={[styles.ring, ring2Style]} />
        <Animated.View style={logoStyle}>
          <Image source={require('@/assets/images/splash-icon.png')} style={{ width: MARK_SIZE, height: MARK_SIZE }} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.name, nameStyle]}>
        <DisplayText maxFontSizeMultiplier={1.2} style={styles.nameText}>
          L5 FITNESS
        </DisplayText>
      </Animated.View>

      <Animated.View style={[styles.beat, beatStyle]}>
        <Svg width={width} height={BEAT_HEIGHT}>
          <AnimatedPath
            d={beatPath(width)}
            stroke={LIME}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray={`${beatLength} ${beatLength}`}
            animatedProps={beatProps}
          />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE * 0.22, // the logo is a rounded square
    borderWidth: 2,
    borderColor: LIME,
  },
  // Placed absolutely so the logo itself stays exactly where the native splash drew it.
  name: {
    position: 'absolute',
    top: '50%',
    marginTop: MARK_SIZE / 2 + 26,
    alignSelf: 'center',
  },
  nameText: {
    color: '#ffffff',
    fontSize: 22,
    letterSpacing: 6,
  },
  beat: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: MARK_SIZE / 2 + 78,
  },
});
