import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

const INK = '#050a07';
const HOODIE = '#aeb8b1';
const HOODIE_DARK = '#8b968f';
const SKIN = '#f0d2b6';
const SHOE = '#f3f8f4';
const BRAND = '#3ddc68';

/** Height / width of the drawing. */
export const ATHLETE_RATIO = 1.35;

/**
 * Original flat illustration of a runner in a grey hoodie with headphones, holding a phone.
 * `size` is the width in px; the height follows from ATHLETE_RATIO.
 */
export function AthleteIllustration({ size = 160 }: { size?: number }) {
  return (
    <Svg width={size} height={size * ATHLETE_RATIO} viewBox="0 0 200 270" accessible={false}>
      {/* back arm */}
      <Path d="M76 88 L48 122 L66 146" stroke={HOODIE_DARK} strokeWidth={17} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={67} cy={149} r={8} fill={SKIN} />
      {/* back leg */}
      <Path d="M88 160 L58 200 L30 228" stroke={INK} strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.85} />
      <Ellipse cx={24} cy={236} rx={17} ry={8} fill={SHOE} transform="rotate(-25 24 236)" />
      {/* front leg */}
      <Path d="M104 158 L142 192 L124 238" stroke={INK} strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Ellipse cx={130} cy={248} rx={20} ry={9} fill={SHOE} />
      <Rect x={112} y={254} width={40} height={5} rx={2.5} fill={BRAND} />
      {/* torso: hoodie */}
      <Path d="M72 76 Q100 64 130 76 L136 164 Q104 176 74 164 Z" fill={HOODIE} />
      <Path d="M92 78 Q102 96 114 78" stroke={HOODIE_DARK} strokeWidth={5} fill="none" strokeLinecap="round" />
      <Rect x={84} y={134} width={44} height={14} rx={7} fill={HOODIE_DARK} opacity={0.55} />
      <Rect x={74} y={158} width={62} height={8} rx={4} fill={BRAND} opacity={0.9} />
      {/* neck + head */}
      <Rect x={95} y={58} width={14} height={14} rx={5} fill={SKIN} />
      <Circle cx={103} cy={42} r={21} fill={SKIN} />
      <Path d="M83 40 Q84 20 104 20 Q124 21 123 40 Q112 28 83 40 Z" fill={INK} />
      {/* headphones */}
      <Path d="M82 44 Q80 14 104 14 Q128 14 124 44" stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />
      <Circle cx={83} cy={46} r={9} fill={INK} />
      <Circle cx={83} cy={46} r={4} fill={BRAND} />
      {/* face hint */}
      <Circle cx={112} cy={44} r={1.8} fill={INK} />
      <Path d="M108 55 Q113 58 118 54" stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
      {/* front arm, raised, holding phone */}
      <Path d="M126 86 L156 118 L150 84" stroke={HOODIE} strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Rect x={140} y={64} width={18} height={30} rx={4} fill={INK} transform="rotate(8 149 79)" />
      <Rect x={143} y={68} width={12} height={22} rx={2} fill={BRAND} opacity={0.7} transform="rotate(8 149 79)" />
      <G>
        <Circle cx={152} cy={90} r={7} fill={SKIN} />
      </G>
    </Svg>
  );
}
