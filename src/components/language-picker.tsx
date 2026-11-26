import { Pressable, Text, View } from 'react-native';

import { useLanguage } from '@/providers/language-provider';

const BRAND = '#3ddc68';

/** The five languages as chips, each written in its own script so people can find theirs. */
export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, languages } = useLanguage();
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }} accessibilityRole="radiogroup">
      {languages.map((l) => {
        const on = l.code === language;
        return (
          <Pressable
            key={l.code}
            onPress={() => setLanguage(l.code)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${l.name}, ${l.native}`}
            className="items-center justify-center rounded-full active:opacity-80"
            style={{ minHeight: compact ? 36 : 44, paddingHorizontal: compact ? 12 : 18, backgroundColor: on ? BRAND : 'rgba(255,255,255,0.08)' }}>
            <Text maxFontSizeMultiplier={1.3} className="font-bold" style={{ fontSize: compact ? 13 : 15, color: on ? '#050a07' : '#ffffff' }}>
              {l.native}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
