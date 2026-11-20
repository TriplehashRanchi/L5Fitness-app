import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ExerciseFigure } from '@/components/active-workout/exercise-figure';
import type { Pose } from '@/components/active-workout/exercise-info';

/**
 * Two photos per move: where it starts and where it ends.
 * Pictures are from the public-domain free-exercise-db (github.com/yuhonas/free-exercise-db).
 */
const PHOTOS: Partial<Record<Pose, [number, number]>> = {
  jack: [require('@/assets/exercises/jack-0.jpg'), require('@/assets/exercises/jack-1.jpg')],
  knees: [require('@/assets/exercises/knees-0.jpg'), require('@/assets/exercises/knees-1.jpg')],
  climber: [require('@/assets/exercises/climber-0.jpg'), require('@/assets/exercises/climber-1.jpg')],
  bicycle: [require('@/assets/exercises/bicycle-0.jpg'), require('@/assets/exercises/bicycle-1.jpg')],
  crunch: [require('@/assets/exercises/crunch-0.jpg'), require('@/assets/exercises/crunch-1.jpg')],
  plank: [require('@/assets/exercises/plank-1.jpg'), require('@/assets/exercises/plank-1.jpg')],
  pushup: [require('@/assets/exercises/pushup-0.jpg'), require('@/assets/exercises/pushup-1.jpg')],
  squat: [require('@/assets/exercises/squat-0.jpg'), require('@/assets/exercises/squat-1.jpg')],
  lunge: [require('@/assets/exercises/lunge-0.jpg'), require('@/assets/exercises/lunge-1.jpg')],
  burpee: [require('@/assets/exercises/burpee-0.jpg'), require('@/assets/exercises/burpee-1.jpg')],
  stretch: [require('@/assets/exercises/stretch-0.jpg'), require('@/assets/exercises/stretch-1.jpg')],
  warmup: [require('@/assets/exercises/warmup-0.jpg'), require('@/assets/exercises/warmup-1.jpg')],
};

/**
 * A photo of the move, `width` wide at 3:2. With `animate` it fades between the start and the end of the
 * move, like a short clip. A move with no photo gets the drawn figure instead.
 */
export function ExercisePhoto({ pose, width, radius = 14, animate = false }: { pose: Pose; width: number; radius?: number; animate?: boolean }) {
  const reduce = useReducedMotion();
  const [end, setEnd] = useState(true);
  const moving = animate && !reduce;
  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => setEnd((v) => !v), 900);
    return () => clearInterval(id);
  }, [moving]);

  const height = Math.round((width * 2) / 3);
  const photos = PHOTOS[pose];
  if (!photos) {
    return (
      <View accessible={false} className="items-center justify-center" style={{ width, height, borderRadius: radius, backgroundColor: 'rgba(61,220,104,0.07)' }}>
        <ExerciseFigure pose={pose} height={height * 0.9} animate={animate} />
      </View>
    );
  }
  return (
    <Image
      accessible={false}
      source={photos[moving ? (end ? 1 : 0) : 1]}
      contentFit="cover"
      transition={moving ? 250 : 0}
      style={{ width, height, borderRadius: radius, backgroundColor: '#111' }}
    />
  );
}
