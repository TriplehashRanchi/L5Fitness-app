import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

/** Same size as `imageWidth` of the expo-splash-screen plugin in app.json, so the hand-off is seamless. */
const MARK_SIZE = 110;

/**
 * Covers the app with a copy of the native splash, hides the native one, then zooms + fades out.
 * Gives a smooth start instead of a hard cut.
 */
export function SplashOverlay() {
  const [visible, setVisible] = useState(true);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!visible) return null;

  const start = () => {
    SplashScreen.hideAsync().finally(() => {
      scale.set(withTiming(1.25, { duration: 550 }));
      opacity.set(
        withDelay(
          120,
          withTiming(0, { duration: 450 }, (finished) => {
            if (finished) scheduleOnRN(setVisible, false);
          })
        )
      );
    });
  };

  return (
    <Animated.View onLayout={start} style={[styles.overlay, containerStyle]}>
      <Animated.View style={markStyle}>
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={{ width: MARK_SIZE, height: MARK_SIZE }}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0b0b0d',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
});
