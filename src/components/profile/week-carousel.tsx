import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { DisplayText } from '@/components/display-text';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { fmtKg } from '@/lib/body';
import type { Report } from '@/lib/progress-api';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const TRACK = 'rgba(255,255,255,0.1)';
const HAIRLINE = 'rgba(255,255,255,0.08)';
const INK = '#050a07';
const MUTED = '#8fa396';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const DASH = '–';
const DAY_MS = 86_400_000;
/** The page's side space. Cards sit twice that far apart, so only one is ever on the screen. */
const SIDE = 20;
const GAP = SIDE * 2;
/** Week buttons in one line: up to six all together, and beyond that five at a time. */
const ALL_AT_ONCE = 6;
const GROUP = 5;
const CARD_PAD = 16;
/** The four rings: their size, thickness, and the room between one ring and the next. */
const RINGS = 112;
const STROKE = 9;
const RING_GAP = 3;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Each thing counted keeps its own colour, in the ring and in the key under it. */
const KINDS = {
  steps: { color: BRAND, icon: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' } },
  checkins: { color: '#38bdf8', icon: { ios: 'heart.fill', android: 'favorite', web: 'favorite' } },
  actions: { color: '#fbbf24', icon: { ios: 'checklist', android: 'checklist', web: 'checklist' } },
  meals: { color: '#fb7185', icon: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' } },
} satisfies Record<string, { color: string; icon: SymbolViewProps['name'] }>;

/** One thing counted in the week. `share` is 0 to 1; null means nothing was logged. */
type Stat = { kind: keyof typeof KINDS; label: string; share: number | null; value: string };

/** The week as rings inside one another: the fuller the ring, the closer to the whole. */
function Rings({ stats }: { stats: Stat[] }) {
  const c = RINGS / 2;
  return (
    <View style={{ width: RINGS, height: RINGS }}>
      <Svg width={RINGS} height={RINGS}>
        {stats.map((x, i) => {
          const r = (RINGS - STROKE) / 2 - i * (STROKE + RING_GAP);
          const len = 2 * Math.PI * r;
          const filled = Math.min(1, Math.max(0, x.share ?? 0));
          const { color } = KINDS[x.kind];
          return [
            <Circle key={`${x.kind}-track`} cx={c} cy={c} r={r} stroke={color} strokeOpacity={0.16} strokeWidth={STROKE} fill="none" />,
            filled > 0 ? (
              <Circle
                key={x.kind}
                cx={c}
                cy={c}
                r={r}
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={`${len * filled} ${len}`}
                transform={`rotate(-90 ${c} ${c})`}
              />
            ) : null,
          ];
        })}
      </Svg>
    </View>
  );
}

/** One line of the key beside the rings: the colour's icon, the figure, and what it counts. */
function Key({ kind, label, share, value }: Stat) {
  const { color, icon } = KINDS[kind];
  return (
    <View className="flex-row items-center" style={{ gap: 8, paddingVertical: 4 }}>
      <SymbolView name={icon} tintColor={color} size={15} />
      <View className="flex-1">
        <Text {...COMPACT_TEXT} style={{ fontSize: 14, lineHeight: 18, fontWeight: '800', color: share == null ? MUTED : '#ffffff' }} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 10, lineHeight: 13 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

/**
 * The weight of every week as a line, bright up to the week on this card, which carries the dot. Tapping it goes
 * to the week at that place.
 */
function Journey({ values, at, width, onPick }: { values: (number | null)[]; at: number; width: number; onPick: (week: number) => void }) {
  const points = values.flatMap((v, i) => (v == null ? [] : [{ i, v }]));
  if (points.length < 2 || width <= 0) return null;
  const H = 28;
  const PAD = 6;
  const low = Math.min(...points.map((x) => x.v));
  const span = Math.max(0.5, Math.max(...points.map((x) => x.v)) - low);
  const x = (i: number) => PAD + (i / Math.max(1, values.length - 1)) * (width - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - low) / span) * (H - PAD * 2);
  const line = (list: typeof points) => list.map((pt, n) => `${n ? 'L' : 'M'} ${x(pt.i)} ${y(pt.v)}`).join(' ');
  const here = points.find((pt) => pt.i === at);
  return (
    // A shortcut for the eye and finger; screen readers have the week buttons above.
    <Pressable
      accessible={false}
      onPress={(e) => {
        const touched = Math.round(((e.nativeEvent.locationX - PAD) / (width - PAD * 2)) * (values.length - 1));
        onPick(Math.min(values.length - 1, Math.max(0, touched)));
      }}>
      <Svg width={width} height={H} pointerEvents="none">
        <Path d={line(points)} stroke={TRACK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <Path d={line(points.filter((pt) => pt.i <= at))} stroke={BRAND} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {here ? (
          <>
            <Circle cx={x(here.i)} cy={y(here.v)} r={6} fill={BRAND} opacity={0.25} />
            <Circle cx={x(here.i)} cy={y(here.v)} r={3} fill="#ffffff" />
          </>
        ) : null}
      </Svg>
    </Pressable>
  );
}

/** A button in a row of equal ones: green when it is the chosen one. Its text stays on one line. */
function Choice({ text, label, chosen, onPress }: { text: string; label: string; chosen: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 5, bottom: 5 }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: chosen }}
      className="flex-1 items-center justify-center active:opacity-70"
      // Colours are written here outright: left to a class, an unset style value can blank them on a phone.
      style={{ minHeight: 34, paddingHorizontal: 1, borderRadius: 17, borderWidth: 1, borderColor: chosen ? BRAND : 'rgba(255,255,255,0.22)', backgroundColor: chosen ? BRAND : 'rgba(255,255,255,0.08)' }}>
      {/* Small enough for "Week 14" in a fifth of a narrow phone; longer words shrink further. */}
      <Text maxFontSizeMultiplier={1.1} style={{ fontSize: 11.5, fontWeight: '800', color: chosen ? INK : '#ffffff' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {text}
      </Text>
    </Pressable>
  );
}

/**
 * The report's weeks: a button for each week on top, all on one line with nothing to slide, and under them the
 * chosen week's card (which can also be swiped). A longer report first picks a block of five weeks. It opens
 * on the latest week. Each card has the week's weight and where it sits in the whole journey, then rings for
 * steps, check-ins, agreed actions and planned meals.
 */
export function WeekCarousel({ report }: { report: Report }) {
  const t = useT();
  const { format } = useDeviceClock();
  const { weeks } = report;
  const last = weeks.length - 1;
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(last);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const opened = useRef(false);

  const cardWidth = Math.max(0, width - SIDE * 2);
  const step = cardWidth + GAP;
  /** Shows a week at once, without sliding past the ones between. */
  const goTo = (i: number) => {
    setIndex(i);
    scroller.current?.scrollTo({ x: i * step, animated: false });
  };

  const per = weeks.length <= ALL_AT_ONCE ? weeks.length : GROUP;
  const block = Math.floor(index / per);
  const blocks = Math.ceil(weeks.length / per);
  const shown = weeks.slice(block * per, block * per + per);

  const date = (day: string) => new Intl.DateTimeFormat(format.locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  const count = (n: number) => Math.round(n).toLocaleString(format.locale);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* A longer report: which block of weeks. */}
      {blocks > 1 ? (
        <View accessibilityRole="tablist" className="flex-row" style={{ gap: 6, paddingHorizontal: SIDE, marginBottom: 8 }}>
          {Array.from({ length: blocks }, (_, b) => {
            const from = b * per + 1;
            const to = Math.min(weeks.length, from + per - 1);
            const text = from === to ? t('rep.week', { n: from }) : t('rep.weekRange', { from, to });
            return <Choice key={from} text={text} label={text} chosen={b === block} onPress={() => goTo(b * per)} />;
          })}
        </View>
      ) : null}

      {/* Which week. */}
      <View accessibilityRole="tablist" className="flex-row" style={{ gap: 5, paddingHorizontal: SIDE, marginBottom: 10 }}>
        {shown.map((week, n) => {
          const i = block * per + n;
          const text = t('rep.week', { n: i + 1 });
          return <Choice key={week.weekStart} text={text} label={text} chosen={i === index} onPress={() => goTo(i)} />;
        })}
        {/* Empty places keep the buttons of a short last block the same size as the others. */}
        {Array.from({ length: per - shown.length }, (_, n) => (
          <View key={n} className="flex-1" />
        ))}
      </View>

      {width > 0 ? (
        <ScrollView
          ref={scroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={step}
          decelerationRate="fast"
          disableIntervalMomentum
          scrollEventThrottle={16}
          onScroll={(e) => {
            // Until the first jump to the latest week has happened, the position says nothing.
            if (opened.current) setIndex(Math.min(last, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step))));
          }}
          onContentSizeChange={() => {
            scroller.current?.scrollTo({ x: index * step, animated: false });
            opened.current = true;
          }}
          contentContainerStyle={{ paddingHorizontal: SIDE, gap: GAP }}>
          {weeks.map((week, i) => {
            // The first and last weeks are only partly inside the report's days.
            const from = week.weekStart < report.start ? report.start : week.weekStart;
            const sunday = new Date(Date.parse(`${week.weekStart}T00:00:00Z`) + 6 * DAY_MS).toISOString().slice(0, 10);
            const to = sunday > report.end ? report.end : sunday;
            const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
            // Against the latest earlier week that has a weight: a week with no weigh-ins is skipped, not counted as zero.
            const previous = weeks.slice(0, i).reverse().find((x) => x.weight != null)?.weight;
            const diff = week.weight != null && previous != null ? round1(week.weight - previous) : null;
            const change = diff == null ? null : diff === 0 ? t('rep.same') : fmtKg(Math.abs(diff));
            const spokenChange = diff ? `${diff > 0 ? '+' : '−'}${change}` : change;
            const goal = report.habits.steps.goal;
            const stats: Stat[] = [
              { kind: 'steps', label: t('rep.colSteps'), share: week.steps == null ? null : week.steps / goal, value: week.steps == null ? DASH : count(week.steps) },
              { kind: 'checkins', label: t('rep.colCheckins'), share: week.checkins ? week.checkins / days : null, value: week.checkins ? `${week.checkins}/${days}` : DASH },
              { kind: 'actions', label: t('rep.colActions'), share: week.total ? week.completed / week.total : null, value: week.total ? `${week.completed}/${week.total}` : DASH },
              { kind: 'meals', label: t('rep.colMeals'), share: week.mealPercent == null ? null : week.mealPercent / 100, value: week.mealPercent == null ? DASH : `${week.mealPercent}%` },
            ];
            const title = t('rep.week', { n: i + 1 });
            const dates = from === to ? date(from) : `${date(from)} – ${date(to)}`;
            // The number and its unit are drawn apart, so the unit can be smaller.
            const [amount, unit] = week.weight == null ? [DASH, ''] : fmtKg(week.weight).split(' ');
            const weight = [amount, unit].filter(Boolean).join(' ');
            return (
              <View
                key={week.weekStart}
                accessible
                accessibilityLabel={[title, dates, weight, spokenChange, ...stats.map((x) => `${x.label}: ${x.value}`)].filter(Boolean).join('. ')}
                style={{ width: cardWidth }}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.11)', 'rgba(255,255,255,0.035)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.6, y: 1 }}
                  style={{ flex: 1, padding: CARD_PAD, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  {/* The dates (the week's name is on its button) and the weight, with how it moved beside it. */}
                  <Text {...COMPACT_TEXT} className="font-semibold text-muted" style={{ fontSize: 12, lineHeight: 17 }}>
                    {dates}
                  </Text>
                  <View className="flex-row items-center" style={{ gap: 10 }}>
                    {/* One text, number and unit together, as wide as the free room: it can shrink but never break. */}
                    <DisplayText {...COMPACT_TEXT} className="flex-1 text-white" style={{ fontSize: 32, lineHeight: 40 }} numberOfLines={1} adjustsFontSizeToFit>
                      {amount}
                      <Text className="text-muted" style={{ fontSize: 16 }}>
                        {unit ? ` ${unit}` : ''}
                      </Text>
                    </DisplayText>
                    {change ? (
                      // Plain, not green: whether a rise or a fall is wanted depends on the goal.
                      <View className="flex-row items-center rounded-full" style={{ gap: 4, minHeight: 26, maxWidth: '50%', paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                        {diff ? (
                          <SymbolView
                            name={diff < 0 ? { ios: 'arrow.down', android: 'arrow_downward', web: 'arrow_downward' } : { ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }}
                            tintColor="white"
                            size={11}
                          />
                        ) : null}
                        <Text {...COMPACT_TEXT} className="shrink font-bold text-white" style={{ fontSize: 12 }} numberOfLines={1} adjustsFontSizeToFit>
                          {change}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={{ marginTop: 4 }}>
                    <Journey values={weeks.map((x) => x.weight)} at={i} width={cardWidth - CARD_PAD * 2 - 2} onPick={goTo} />
                  </View>

                  <View className="flex-row items-center" style={{ gap: 18, marginTop: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
                    <Rings stats={stats} />
                    <View className="flex-1">
                      {stats.map((x) => (
                        <Key key={x.kind} {...x} />
                      ))}
                    </View>
                  </View>
                </LinearGradient>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

    </View>
  );
}
