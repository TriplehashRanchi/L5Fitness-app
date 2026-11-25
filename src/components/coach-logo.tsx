import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * The mark of L5 Coach, the AI assistant: a glossy green ball (lit from the top left, darker at the
 * bottom, so it reads as round), a steel dumbbell resting on it with its shadow, and the four-point
 * "AI" spark at the top right. Fitness first, AI second.
 *
 * Drawn as vectors, so it is sharp at any size: 26 beside an answer, 46 on Home, 84 on the empty chat.
 */
export function CoachLogo({ size }: { size: number }) {
  // The two halves of the dumbbell (bar, big plate, small plate), drawn twice: once as a shadow, once in steel.
  const dumbbell = (
    <>
      <Rect x={30} y={50.5} width={38} height={9} rx={4.5} />
      <Rect x={23} y={37} width={11} height={36} rx={5} />
      <Rect x={64} y={37} width={11} height={36} rx={5} />
      <Rect x={15} y={43.5} width={8.5} height={23} rx={4.2} />
      <Rect x={74.5} y={43.5} width={8.5} height={23} rx={4.2} />
    </>
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessible={false}>
      <Defs>
        <RadialGradient id="coachBall" cx="34%" cy="26%" r="78%">
          <Stop offset="0" stopColor="#c9ffd9" />
          <Stop offset="0.32" stopColor="#4fe67a" />
          <Stop offset="0.68" stopColor="#1fae4a" />
          <Stop offset="1" stopColor="#0a5f26" />
        </RadialGradient>
        <LinearGradient id="coachRim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.45" stopColor="#000000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.38} />
        </LinearGradient>
        <LinearGradient id="coachGloss" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.75} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="coachSteel" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.55" stopColor="#eaf7ee" />
          <Stop offset="1" stopColor="#b5d8c1" />
        </LinearGradient>
      </Defs>

      {/* the ball */}
      <Circle cx={50} cy={52} r={44} fill="url(#coachBall)" />
      <Circle cx={50} cy={52} r={44} fill="url(#coachRim)" />

      {/* the dumbbell, tilted, with its shadow falling on the ball */}
      <G rotation={-32} origin="49, 55">
        <G translateY={4.5} fill="#053a17" opacity={0.5}>
          {dumbbell}
        </G>
        <G fill="url(#coachSteel)">{dumbbell}</G>
      </G>

      {/* light on the top of the ball */}
      <Ellipse cx={40} cy={25} rx={25} ry={12} fill="url(#coachGloss)" rotation={-18} origin="40, 25" />

      {/* the AI spark, and a small one beside it */}
      <Path d="M78 6 C79.6 15.5 84.5 20.4 94 22 C84.5 23.6 79.6 28.5 78 38 C76.4 28.5 71.5 23.6 62 22 C71.5 20.4 76.4 15.5 78 6 Z" fill="#ffffff" />
      <Path d="M93 37 C93.6 40.6 95.4 42.4 99 43 C95.4 43.6 93.6 45.4 93 49 C92.4 45.4 90.6 43.6 87 43 C90.6 42.4 92.4 40.6 93 37 Z" fill="#ffffff" />
    </Svg>
  );
}
