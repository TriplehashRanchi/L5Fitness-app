import { Text, View } from 'react-native';

const SIZE = 216;
const STROKE = 12;
const SEGMENTS = 72;
const RADIUS = (SIZE - STROKE) / 2;
const BRAND = '#c6f432';

/** Native views keep the activity ring lightweight without another graphics dependency. */
export function StepsRing({ steps, goal, locale }: { steps: number | null; goal: number; locale: string }) {
  const progress = steps == null || goal <= 0 ? 0 : Math.min(1, Math.max(0, steps / goal));
  const filled = Math.floor(progress * SEGMENTS);
  const count = steps == null ? '–' : steps.toLocaleString(locale);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Steps today"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100), text: steps == null ? 'Steps not available' : `${count} of ${goal.toLocaleString(locale)} steps` }}
      style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: SEGMENTS }, (_, index) => {
        const angle = (index / SEGMENTS) * Math.PI * 2 - Math.PI / 2;
        return (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: SIZE / 2 + Math.cos(angle) * RADIUS - 3.5,
              top: SIZE / 2 + Math.sin(angle) * RADIUS - STROKE / 2,
              width: 7,
              height: STROKE,
              borderRadius: 3.5,
              backgroundColor: index < filled ? BRAND : '#2b3238',
              transform: [{ rotate: `${index * (360 / SEGMENTS)}deg` }],
            }}
          />
        );
      })}
      <View className="items-center px-7" style={{ width: SIZE - 36 }}>
        <Text maxFontSizeMultiplier={1.2} className="mb-1 text-xs font-semibold uppercase tracking-[2px] text-muted">Today</Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          maxFontSizeMultiplier={1.2}
          style={{ fontSize: 44, lineHeight: 54, fontVariant: ['tabular-nums'] }}
          className="w-full text-center font-bold tracking-tight text-white">
          {count}
        </Text>
        <Text maxFontSizeMultiplier={1.3} className="mt-1 text-sm text-muted">steps</Text>
      </View>
    </View>
  );
}
