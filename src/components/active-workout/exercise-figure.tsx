import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';

import type { Pose } from '@/components/active-workout/exercise-info';

const SHIRT = '#3ddc68';
const SHORTS = '#f3f8f4';
const SHOE = '#f3f8f4';
const SKIN = '#e9b993';
const SKIN_BACK = '#b98862';
const HAIR = '#1b1f1c';

type P = [number, number];
/** One drawn position of the body. Limb 0 is the far side (drawn darker, behind), limb 1 the near side. */
type Frame = { head: P; neck: P; hip: P; arms: [P, P][]; legs: [P, P][]; floor?: boolean };

const STAND: Frame = {
  head: [60, 13],
  neck: [60, 25],
  hip: [60, 56],
  arms: [[[53, 40], [51, 54]], [[67, 40], [69, 54]]],
  legs: [[[57, 74], [56, 92]], [[63, 74], [64, 92]]],
};
const HIGH_PLANK: Frame = {
  head: [18, 46],
  neck: [27, 52],
  hip: [78, 66],
  arms: [[[31, 70], [31, 90]], [[29, 70], [29, 90]]],
  legs: [[[94, 77], [110, 90]], [[94, 77], [110, 90]]],
  floor: true,
};

/** The two ends of each move; the picture flips between them like a short clip. */
const FRAMES: Record<Pose, [Frame, Frame]> = {
  jack: [
    STAND,
    { ...STAND, arms: [[[47, 15], [42, 3]], [[73, 15], [78, 3]]], legs: [[[50, 74], [40, 92]], [[70, 74], [80, 92]]] },
  ],
  knees: [
    { ...STAND, arms: [[[68, 38], [74, 28]], [[52, 40], [48, 52]]], legs: [[[58, 74], [57, 92]], [[78, 58], [76, 78]]] },
    { ...STAND, arms: [[[52, 40], [48, 52]], [[68, 38], [74, 28]]], legs: [[[78, 58], [76, 78]], [[58, 74], [57, 92]]] },
  ],
  climber: [
    { ...HIGH_PLANK, legs: [[[94, 77], [110, 90]], [[58, 72], [54, 88]]] },
    { ...HIGH_PLANK, legs: [[[58, 72], [54, 88]], [[94, 77], [110, 90]]] },
  ],
  bicycle: [
    { head: [20, 68], neck: [29, 76], hip: [62, 84], arms: [[[36, 62], [24, 62]], [[38, 64], [26, 60]]], legs: [[[86, 80], [108, 76]], [[78, 60], [96, 66]]], floor: true },
    { head: [20, 68], neck: [29, 76], hip: [62, 84], arms: [[[36, 62], [24, 62]], [[38, 64], [26, 60]]], legs: [[[78, 60], [96, 66]], [[86, 80], [108, 76]]], floor: true },
  ],
  crunch: [
    { head: [18, 80], neck: [29, 82], hip: [66, 84], arms: [[[34, 72], [22, 72]], [[34, 72], [22, 72]]], legs: [[[86, 60], [100, 88]], [[86, 60], [100, 88]]], floor: true },
    { head: [34, 50], neck: [41, 60], hip: [66, 84], arms: [[[50, 54], [40, 46]], [[50, 54], [40, 46]]], legs: [[[86, 60], [100, 88]], [[86, 60], [100, 88]]], floor: true },
  ],
  plank: [
    { head: [18, 54], neck: [27, 60], hip: [78, 70], arms: [[[30, 88], [44, 88]], [[30, 88], [44, 88]]], legs: [[[94, 79], [110, 90]], [[94, 79], [110, 90]]], floor: true },
    { head: [18, 54], neck: [27, 60], hip: [78, 72], arms: [[[30, 88], [44, 88]], [[30, 88], [44, 88]]], legs: [[[94, 80], [110, 90]], [[94, 80], [110, 90]]], floor: true },
  ],
  pushup: [
    HIGH_PLANK,
    { head: [18, 68], neck: [27, 73], hip: [78, 78], arms: [[[42, 72], [31, 90]], [[40, 72], [29, 90]]], legs: [[[94, 84], [110, 90]], [[94, 84], [110, 90]]], floor: true },
  ],
  squat: [
    STAND,
    { head: [50, 28], neck: [54, 39], hip: [46, 66], arms: [[[68, 46], [84, 46]], [[68, 48], [84, 48]]], legs: [[[70, 68], [66, 92]], [[72, 70], [68, 92]]] },
  ],
  lunge: [
    STAND,
    { head: [60, 21], neck: [60, 33], hip: [60, 62], arms: [[[54, 46], [54, 58]], [[66, 46], [66, 58]]], legs: [[[46, 80], [28, 90]], [[82, 66], [82, 92]]] },
  ],
  burpee: [
    HIGH_PLANK,
    { head: [60, 12], neck: [60, 24], hip: [60, 52], arms: [[[50, 12], [48, 2]], [[70, 12], [72, 2]]], legs: [[[57, 68], [56, 84]], [[63, 68], [64, 84]]] },
  ],
  stretch: [
    { ...STAND, arms: [[[54, 12], [57, 1]], [[66, 12], [63, 1]]] },
    { head: [50, 15], neck: [54, 26], hip: [60, 56], arms: [[[46, 12], [36, 5]], [[58, 10], [46, 1]]], legs: STAND.legs },
  ],
  warmup: [
    STAND,
    { ...STAND, arms: [[[45, 27], [30, 27]], [[75, 27], [90, 27]]] },
  ],
  generic: [
    STAND,
    { ...STAND, arms: [[[48, 34], [40, 24]], [[72, 34], [80, 24]]] },
  ],
};

const mid = (a: P, b: P, t = 0.5): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function Seg({ a, b, c, w }: { a: P; b: P; c: string; w: number }) {
  return <Line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={c} strokeWidth={w} strokeLinecap="round" />;
}

function Leg({ hip, knee, foot, skin }: { hip: P; knee: P; foot: P; skin: string }) {
  // The shoe points the way the shin leans, or forward when the shin is upright.
  const dx = foot[0] - knee[0];
  const toe: P = Math.abs(dx) > 8 && Math.abs(foot[1] - knee[1]) < 8 ? [foot[0], foot[1] - 6] : [foot[0] + 6, foot[1]];
  return (
    <>
      <Seg a={hip} b={knee} c={skin} w={10} />
      <Seg a={knee} b={foot} c={skin} w={8} />
      <Seg a={hip} b={mid(hip, knee, 0.55)} c={SHORTS} w={12} />
      <Seg a={foot} b={toe} c={SHOE} w={7} />
    </>
  );
}

function Arm({ shoulder, elbow, hand, skin }: { shoulder: P; elbow: P; hand: P; skin: string }) {
  return (
    <>
      <Seg a={shoulder} b={elbow} c={skin} w={7.5} />
      <Seg a={elbow} b={hand} c={skin} w={6.5} />
      <Seg a={shoulder} b={mid(shoulder, elbow, 0.35)} c={SHIRT} w={8.5} />
      <Circle cx={hand[0]} cy={hand[1]} r={3.6} fill={skin} />
    </>
  );
}

function Person({ f }: { f: Frame }) {
  const shoulder = mid(f.neck, f.hip, 0.08);
  // Hair sits on the side of the head away from the body.
  const hx = f.head[0] - f.neck[0];
  const hy = f.head[1] - f.neck[1];
  const len = Math.hypot(hx, hy) || 1;
  const hair: P = [f.head[0] + (hx / len) * 3, f.head[1] + (hy / len) * 3];
  return (
    <>
      {f.floor ? <Line x1={4} y1={95} x2={116} y2={95} stroke="rgba(255,255,255,0.14)" strokeWidth={2} strokeLinecap="round" /> : <Ellipse cx={60} cy={96} rx={30} ry={3} fill="rgba(255,255,255,0.08)" />}
      <Arm shoulder={shoulder} elbow={f.arms[0][0]} hand={f.arms[0][1]} skin={SKIN_BACK} />
      <Leg hip={f.hip} knee={f.legs[0][0]} foot={f.legs[0][1]} skin={SKIN_BACK} />
      <Leg hip={f.hip} knee={f.legs[1][0]} foot={f.legs[1][1]} skin={SKIN} />
      <Seg a={f.neck} b={f.head} c={SKIN} w={6} />
      <Seg a={shoulder} b={f.hip} c={SHIRT} w={17} />
      <Seg a={mid(f.neck, f.hip, 0.82)} b={f.hip} c={SHORTS} w={17} />
      <Circle cx={hair[0]} cy={hair[1]} r={9} fill={HAIR} />
      <Circle cx={f.head[0]} cy={f.head[1]} r={8.5} fill={SKIN} />
      <Path d={`M${f.head[0] - 8.5} ${f.head[1] - 1} A8.5 8.5 0 0 1 ${f.head[0] + 8.5} ${f.head[1] - 1} Z`} fill={HAIR} transform={`rotate(${(Math.atan2(hy, hx) * 180) / Math.PI + 90} ${f.head[0]} ${f.head[1]})`} />
      <Arm shoulder={shoulder} elbow={f.arms[1][0]} hand={f.arms[1][1]} skin={SKIN} />
    </>
  );
}

/**
 * A drawing of the move. With `animate` it flips between the two ends of the move, like a short clip
 * (it stays on the end position when the phone asks for reduced motion).
 */
export function ExerciseFigure({ pose, height = 90, animate = false }: { pose: Pose; height?: number; animate?: boolean }) {
  const reduce = useReducedMotion();
  const [b, setB] = useState(true);
  const moving = animate && !reduce;
  useEffect(() => {
    if (!moving) return;
    const id = setInterval(() => setB((v) => !v), 650);
    return () => clearInterval(id);
  }, [moving]);
  const frame = FRAMES[pose][moving ? (b ? 1 : 0) : 1];
  return (
    <View accessible={false} style={{ width: height * 1.2, height }}>
      <Svg width={height * 1.2} height={height} viewBox="0 0 120 100">
        <Person f={frame} />
      </Svg>
    </View>
  );
}
