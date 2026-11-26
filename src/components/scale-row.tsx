import { Pressable, Text, View } from 'react-native';

import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/**
 * One question answered on a 1 to 5 scale: five round buttons with a word at each end.
 * Tapping the chosen number again takes the answer back (unanswered is fine).
 */
export function ScaleRow({
  question,
  low,
  high,
  value,
  onChange,
}: {
  question: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const t = useT();
  return (
    <View accessible={false}>
      <Text {...COMPACT_TEXT} className="text-base font-semibold text-white">
        {question}
      </Text>
      <View className="mt-3 flex-row justify-between">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(on ? null : n)}
              accessibilityRole="button"
              accessibilityLabel={t('prof.scale.option', { question, n })}
              accessibilityState={{ selected: on }}
              className="items-center justify-center rounded-full active:opacity-70"
              style={{ width: 52, height: 52, backgroundColor: on ? BRAND : 'rgba(255,255,255,0.08)' }}>
              <Text {...COMPACT_TEXT} className="font-black" style={{ fontSize: 18, color: on ? '#050a07' : '#ffffff' }}>
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View className="mt-2 flex-row justify-between gap-3">
        <Text {...COMPACT_TEXT} className="shrink text-xs text-muted">
          {low}
        </Text>
        <Text {...COMPACT_TEXT} className="shrink text-right text-xs text-muted">
          {high}
        </Text>
      </View>
    </View>
  );
}
