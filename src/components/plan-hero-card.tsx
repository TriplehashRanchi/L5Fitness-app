import { Image, type ImageSource } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path } from 'react-native-svg';

import { AthleteIllustration, ATHLETE_RATIO } from '@/components/athlete-illustration';
import { DisplayText } from '@/components/display-text';

const BRAND = '#3ddc68';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const RADIUS = 28;
const NOTCH_DEPTH = 18;
const NOTCH_HALF = 56;
const CARD_MIN_HEIGHT = 128;

/**
 * To use your own photo instead of the drawn athlete, set this to `require('@/assets/your-photo.png')`
 * (a transparent PNG of a person works best), or pass the `heroImage` prop.
 */
const DEFAULT_HERO_IMAGE: ImageSource | null = require('../../assets/images/hero-athlete.png');
/** Height / width of the bundled photo (a cut-out of a runner, Pexels licence). */
const PHOTO_RATIO = 532 / 371;
/** Width of the figure as a share of the card width. */
const FIGURE_SHARE = 0.36;

/** Card outline: rounded rectangle whose top edge has a smooth scoop centred at `cx` (null = flat top). */
function cardPath(w: number, h: number, cx: number | null) {
  const r = RADIUS;
  let top = `M 0 ${r} A ${r} ${r} 0 0 1 ${r} 0`;
  if (cx != null) {
    const a = Math.max(r, cx - NOTCH_HALF);
    const b = Math.min(w - r, cx + NOTCH_HALF);
    const hl = cx - a;
    const hr = b - cx;
    top += ` L ${a} 0 C ${a + hl * 0.55} 0 ${cx - hl * 0.5} ${NOTCH_DEPTH} ${cx} ${NOTCH_DEPTH} C ${cx + hr * 0.5} ${NOTCH_DEPTH} ${b - hr * 0.55} 0 ${b} 0`;
  }
  return `${top} L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} Z`;
}

/**
 * Compact brand-colour card: title and one subtitle line, the athlete on the right. The whole card opens
 * today's plan. Its top edge is scooped out under the selected day (`notchX` = that day's centre as a
 * fraction of the card width, or null).
 */
export function PlanHeroCard({
  title,
  subtitle,
  notchX,
  onPress,
  heroImage,
}: {
  title: string;
  subtitle: string;
  notchX: number | null;
  onPress: () => void;
  /** Optional photo shown instead of the drawn athlete. */
  heroImage?: ImageSource | null;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const photo = heroImage ?? DEFAULT_HERO_IMAGE;
  const w = size?.w ?? 340;
  const h = size?.h ?? CARD_MIN_HEIGHT;
  // About a third of the card wide and no taller than the card (it may poke a few px above the top edge).
  const figureH = Math.min(Math.round(w * FIGURE_SHARE * ATHLETE_RATIO), h + 8);
  const figureW = Math.round(figureH / ATHLETE_RATIO);
  const path = size ? cardPath(size.w, size.h, notchX == null ? null : notchX * size.w) : null;

  return (
    <Pressable
      onPress={onPress}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      accessibilityRole="button"
      accessibilityLabel={`Open today's plan. ${title}`}
      className="mx-5 mb-5 active:opacity-90"
      style={[{ minHeight: CARD_MIN_HEIGHT, justifyContent: 'center' }, size ? null : { backgroundColor: BRAND, borderRadius: RADIUS }]}>
      {size && path ? (
        <Svg width={size.w} height={size.h} style={{ position: 'absolute' }} pointerEvents="none">
          <Defs>
            <ClipPath id="heroClip">
              <Path d={path} />
            </ClipPath>
          </Defs>
          <Path d={path} fill={BRAND} />
          <G clipPath="url(#heroClip)">
            {[34, 68, 102, 136].map((r, i) => (
              <Circle
                key={r}
                cx={size.w - figureW * 0.45}
                cy={size.h * 0.6}
                r={r}
                fill="none"
                stroke={i % 2 === 0 ? 'rgba(5,10,7,0.08)' : 'rgba(255,255,255,0.18)'}
                strokeWidth={26}
              />
            ))}
          </G>
        </Svg>
      ) : null}

      {/* The figure stands on the bottom edge, at the right. */}
      {photo ? (
        // The whole runner, a little taller than the card so the head pops out above its top edge.
        <View
          pointerEvents="none"
          accessible={false}
          style={{
            position: 'absolute',
            right: 24,
            bottom: 0,
            height: Math.round((size?.h ?? 128) * 1.18),
            width: Math.round(((size?.h ?? 128) * 1.18) / PHOTO_RATIO),
          }}>
          <Image source={photo} contentFit="contain" contentPosition="bottom right" style={{ width: '100%', height: '100%' }} accessible={false} />
        </View>
      ) : (
        <View
          pointerEvents="none"
          accessible={false}
          style={{ position: 'absolute', right: 8, bottom: 0, width: figureW, height: figureH, overflow: 'visible' }}>
          <AthleteIllustration size={figureW} />
        </View>
      )}

      <View style={{ width: '60%', paddingLeft: 22, paddingTop: NOTCH_DEPTH + 10, paddingBottom: 18 }}>
        <DisplayText {...COMPACT_TEXT} className="text-[21px] leading-7 tracking-tight text-ink" numberOfLines={1} adjustsFontSizeToFit>
          Today’s plan
        </DisplayText>
        <Text {...COMPACT_TEXT} className="mt-0.5 text-[13px] font-semibold leading-5 text-ink/80" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}
