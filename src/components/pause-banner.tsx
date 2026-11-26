import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { messageFrom } from '@/lib/http';
import { PAUSE_REASON_KEY, requestRestart, type Pause } from '@/lib/wellness-api';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const WARN = '#ffc857';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/**
 * Home, while the plan is paused: says so plainly, that reminders are off, and lets the member say
 * they feel ready. Only the dietitian can restart the plan (a check-in first), so after asking it
 * waits for them.
 */
export function PauseBanner({ pause, onChanged }: { pause: Pause; onChanged: (next: Pause) => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waiting = pause.status === 'restart_requested';

  const ready = async () => {
    setBusy(true);
    setError(null);
    try {
      onChanged((await requestRestart()).pause);
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View
      accessibilityRole="summary"
      className="mx-5 mb-4 rounded-2xl border px-4 py-4"
      style={{ borderColor: 'rgba(255,200,87,0.35)', backgroundColor: 'rgba(255,200,87,0.08)' }}>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <SymbolView name={{ ios: 'pause.circle.fill', android: 'pause_circle', web: 'pause_circle' }} tintColor={WARN} size={22} />
        <View className="flex-1">
          <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 16 }}>
            {t('acc.pausedTitle')}
          </Text>
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 1 }}>
            {t('acc.pausedLine', { reason: t(PAUSE_REASON_KEY[pause.reason]) })}
          </Text>
        </View>
      </View>
      {waiting ? (
        <Text {...COMPACT_TEXT} className="mt-3 text-muted" style={{ fontSize: 13, lineHeight: 19 }}>
          {t('acc.restartAsked')}
        </Text>
      ) : (
        <Pressable
          onPress={ready}
          disabled={busy}
          accessibilityRole="button"
          className="mt-3 items-center justify-center self-start rounded-full active:opacity-80"
          style={{ minHeight: 42, paddingHorizontal: 20, paddingVertical: 6, backgroundColor: BRAND }}>
          {busy ? <ActivityIndicator color="#050a07" size="small" /> : <Text {...COMPACT_TEXT} className="text-center font-black" style={{ color: '#050a07', fontSize: 14 }}>{t('acc.restartReady')}</Text>}
        </Pressable>
      )}
      {error ? (
        <Text accessibilityRole="alert" {...COMPACT_TEXT} className="mt-2 text-accent" style={{ fontSize: 13 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
