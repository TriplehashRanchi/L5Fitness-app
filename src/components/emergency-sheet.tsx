import { SymbolView } from 'expo-symbols';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { emergencyLine, SELF_HARM_HELPLINE, type Urgency } from '@/lib/emergency';
import type { Key } from '@/lib/i18n';
import { useLanguage } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const DANGER = '#ff5a5f';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

const call = (number: string) => void Linking.openURL(`tel:${number}`).catch(() => {});

/**
 * Shown the moment someone writes about an urgent symptom, before anything else: call the emergency
 * number now. The app cannot call for help and nobody here is watching, so it says so plainly.
 */
export function EmergencySheet({ kind, onClose }: { kind: Urgency | null; onClose: () => void }) {
  const { language, t } = useLanguage();
  // Indian scripts are taller: more room between lines, so vowel signs are not cut off.
  const roomy = language !== 'en';
  const line = emergencyLine();
  const selfHarm = kind === 'self_harm';
  return (
    <Modal visible={kind != null} transparent animationType="fade" onRequestClose={onClose}>
      {/* Scrolls when the words are too tall for a small phone, so every call button can be reached. */}
      <View className="flex-1 bg-black/80">
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 }}>
          <View accessibilityViewIsModal className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-card" style={{ padding: 22 }}>
            <View className="items-center justify-center self-start rounded-full" style={{ width: 44, height: 44, backgroundColor: 'rgba(255,90,95,0.15)' }}>
              <SymbolView name={{ ios: 'cross.case.fill', android: 'emergency', web: 'emergency' }} tintColor={DANGER} size={22} />
            </View>
            <Text {...COMPACT_TEXT} accessibilityRole="header" className="mt-4 font-black text-white" style={{ fontSize: 22, lineHeight: roomy ? 34 : 28 }}>
              {selfHarm ? t('emergency.selfTitle') : t('emergency.sheetTitle')}
            </Text>
            <Text {...COMPACT_TEXT} className="mt-2 text-muted" style={{ fontSize: 15, lineHeight: roomy ? 24 : 22 }}>
              {selfHarm ? t('emergency.selfBody') : t('emergency.sheetBody')}
            </Text>

            <Pressable
              onPress={() => call(line.number)}
              accessibilityRole="button"
              accessibilityLabel={`${t('emergency.call', { number: line.number })}, ${t(line.label)}`}
              className="flex-row items-center justify-center rounded-full active:opacity-80"
              style={{ gap: 10, minHeight: 56, marginTop: 20, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: DANGER }}>
              <SymbolView name={{ ios: 'phone.fill', android: 'call', web: 'call' }} tintColor="white" size={18} />
              <Text {...COMPACT_TEXT} className="shrink text-center font-black text-white" style={{ fontSize: 17 }}>
                {t('emergency.call', { number: line.number })}
              </Text>
            </Pressable>
            <Text {...COMPACT_TEXT} className="mt-1.5 text-center text-muted" style={{ fontSize: 12 }}>
              {t(line.label)}
            </Text>

            {selfHarm ? (
              <Pressable
                onPress={() => call(SELF_HARM_HELPLINE.number)}
                accessibilityRole="button"
                accessibilityLabel={`${t('emergency.call', { number: SELF_HARM_HELPLINE.number })}, ${t(SELF_HARM_HELPLINE.label)}`}
                className="mt-3 items-center justify-center rounded-full border border-white/15 active:opacity-70"
                style={{ minHeight: 50, paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text {...COMPACT_TEXT} className="text-center font-bold text-white" style={{ fontSize: 15 }}>
                  {t('emergency.call', { number: SELF_HARM_HELPLINE.number })} · {t(SELF_HARM_HELPLINE.label)}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              className="mt-3 items-center justify-center rounded-full active:opacity-70"
              style={{ minHeight: 48, backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <Text {...COMPACT_TEXT} className="font-bold" style={{ fontSize: 15, color: BRAND }}>
                {t('emergency.understand')}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** A plain card for Profile: the number to call, always one tap away. */
export function EmergencyCard({ number, label }: { number: string; label: Key }) {
  const { language, t } = useLanguage();
  return (
    <View>
      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: language === 'en' ? 21 : 23 }}>
        {t('emergency.card')}
      </Text>
      <Pressable
        onPress={() => call(number)}
        accessibilityRole="button"
        accessibilityLabel={`${t('emergency.call', { number })}, ${t(label)}`}
        className="flex-row items-center justify-center rounded-full active:opacity-80"
        style={{ gap: 10, minHeight: 52, marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: DANGER }}>
        <SymbolView name={{ ios: 'phone.fill', android: 'call', web: 'call' }} tintColor="white" size={16} />
        <Text {...COMPACT_TEXT} className="shrink text-center font-black text-white" style={{ fontSize: 16 }}>
          {t('emergency.call', { number })} · {t(label)}
        </Text>
      </Pressable>
    </View>
  );
}

