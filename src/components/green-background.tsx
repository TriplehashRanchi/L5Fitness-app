import { LinearGradient } from 'expo-linear-gradient';

/** Base colour of the new dark-green look. Put it on the screen's root view. */
export const GREEN_BG = '#050a07';

// The numbers that draw the background. They live here (and not inline) so greenBackgroundAt() below can work out the exact
// colour at any height of the screen from the same values.
const BASE = [5, 10, 7] as const; // = GREEN_BG
const TOP_HAZE = { rgb: [46, 120, 68], height: 420, alphaAtTop: 0.32, alphaAtMiddle: 0.1, alphaAtBottom: 0 } as const;
const BOTTOM_HAZE = { rgb: [24, 80, 42], height: 300, alphaAtTop: 0, alphaAtBottom: 0.28 } as const;

/** Soft green haze at the top and a fainter one at the bottom, same as the login screen. Place it first inside the root view. */
export function GreenBackground() {
  const [tr, tg, tb] = TOP_HAZE.rgb;
  const [br, bg, bb] = BOTTOM_HAZE.rgb;
  return (
    <>
      <LinearGradient
        colors={[`rgba(${tr},${tg},${tb},${TOP_HAZE.alphaAtTop})`, `rgba(${tr},${tg},${tb},${TOP_HAZE.alphaAtMiddle})`, `rgba(${tr},${tg},${tb},${TOP_HAZE.alphaAtBottom})`]}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: TOP_HAZE.height }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[`rgba(${br},${bg},${bb},${BOTTOM_HAZE.alphaAtTop})`, `rgba(${br},${bg},${bb},${BOTTOM_HAZE.alphaAtBottom})`]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: BOTTOM_HAZE.height }}
        pointerEvents="none"
      />
    </>
  );
}

const mix = (under: readonly number[], over: readonly number[], alpha: number) => under.map((c, i) => c * (1 - alpha) + over[i] * alpha);

/**
 * The exact colour of the background at `y` px from the top of a screen that is `screenHeight` tall, as "r,g,b".
 * Use it for fades that must blend into the background without a visible edge.
 */
export function greenBackgroundAt(y: number, screenHeight: number): string {
  // the top haze: alpha 0.32 at the top, 0.1 half way down its height, 0 at its bottom
  const t = y / TOP_HAZE.height;
  const topAlpha =
    t <= 0 || t >= 1
      ? 0
      : t < 0.5
        ? TOP_HAZE.alphaAtTop + (TOP_HAZE.alphaAtMiddle - TOP_HAZE.alphaAtTop) * (t / 0.5)
        : TOP_HAZE.alphaAtMiddle + (TOP_HAZE.alphaAtBottom - TOP_HAZE.alphaAtMiddle) * ((t - 0.5) / 0.5);
  // the bottom haze: 0 at the top of its box, 0.28 at the bottom of the screen
  const b = (y - (screenHeight - BOTTOM_HAZE.height)) / BOTTOM_HAZE.height;
  const bottomAlpha = b <= 0 ? 0 : Math.min(1, b) * BOTTOM_HAZE.alphaAtBottom;
  // the bottom haze is drawn over the top one
  const withTop = mix(BASE, TOP_HAZE.rgb, topAlpha);
  return mix(withTop, BOTTOM_HAZE.rgb, bottomAlpha)
    .map((c) => Math.round(c))
    .join(',');
}
