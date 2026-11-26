import { Pressable, Text, View } from 'react-native';

import { useOutbox } from '@/providers/outbox-provider';
import { useLanguage } from '@/providers/language-provider';

const WARN = '#ffc857';

/** On Home while something logged without a signal is still waiting: says so, and lets the member try now. */
export function OutboxBanner() {
  const { language, t } = useLanguage();
  const { pending, rejected, flushNow, clearRejected } = useOutbox();
  if (!pending && !rejected) return null;
  return (
    <View accessibilityRole="summary" className="mx-5 mb-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'rgba(255,200,87,0.35)', backgroundColor: 'rgba(255,200,87,0.08)' }}>
      {pending ? (
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <Text maxFontSizeMultiplier={1.3} className="flex-1 text-white" style={{ fontSize: 13, lineHeight: language === 'en' ? 18 : 21 }}>
            {t('outbox.waiting', { n: pending })}
          </Text>
          <Pressable onPress={() => void flushNow()} accessibilityRole="button" className="rounded-full active:opacity-70" style={{ minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <Text maxFontSizeMultiplier={1.3} className="font-bold" style={{ color: WARN, fontSize: 13 }}>
              {t('outbox.sendNow')}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {rejected ? (
        <Pressable onPress={clearRejected} accessibilityRole="button" style={{ marginTop: pending ? 8 : 0 }}>
          <Text maxFontSizeMultiplier={1.3} className="text-muted" style={{ fontSize: 12, lineHeight: language === 'en' ? 17 : 20 }}>
            {t('outbox.rejected', { n: rejected })}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
