import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayText } from '@/components/display-text';
import { ScaleRow } from '@/components/scale-row';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import { getCheckins, saveCheckin } from '@/lib/progress-api';
import { useT } from '@/providers/language-provider';
import { goBack } from '@/lib/navigation';

const BRAND = '#3ddc68';
const INK = '#050a07';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/**
 * The optional daily check-in: how long they slept, and how sleep, energy, hunger and stress felt.
 * Every question can be left blank; a blank day is unknown, never a bad day.
 */
export default function CheckInScreen() {
  const router = useRouter();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { format } = useDeviceClock();
  const today = toDayKey(getZonedParts(new Date(), format.timeZone));

  const [sleep, setSleep] = useState<number | null>(null);
  const [quality, setQuality] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [hunger, setHunger] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Today's earlier answers, if any.
  useEffect(() => {
    let live = true;
    getCheckins(today, 1)
      .then(({ checkins }) => {
        const c = checkins.find((x) => x.day === today);
        if (!live || !c) return;
        setSleep(c.sleepHours);
        setQuality(c.sleepQuality);
        setEnergy(c.energy);
        setHunger(c.hunger);
        setStress(c.stress);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [today]);

  const step = (delta: number) => setSleep((s) => Math.max(0, Math.min(24, Math.round(((s ?? 7) + delta) * 2) / 2)));
  const answered = sleep != null || quality != null || energy != null || hunger != null || stress != null;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveCheckin(today, { sleepHours: sleep, sleepQuality: quality, energy, hunger, stress });
      goBack(router);
    } catch (e) {
      setError(messageFrom(e));
      setBusy(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110, width: '100%', maxWidth: 840, alignSelf: 'center' }}>
        <View className="flex-row items-center gap-3 px-5 pb-2">
          <Pressable onPress={() => goBack(router)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')} className="h-11 w-11 items-center justify-center rounded-full border border-white/10 active:opacity-70">
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
          </Pressable>
          <DisplayText className="flex-1 text-[30px] font-bold tracking-tight text-white">{t('checkin.title')}</DisplayText>
        </View>
        <Text {...COMPACT_TEXT} className="px-5 text-sm leading-5 text-muted">
          {t('checkin.intro')}
        </Text>

        <View className="gap-8 px-5 pt-8">
          <View>
            <Text {...COMPACT_TEXT} className="text-base font-semibold text-white">
              {t('checkin.sleepHours')}
            </Text>
            <View className="mt-3 flex-row items-center justify-between">
              <Pressable onPress={() => step(-0.5)} accessibilityRole="button" accessibilityLabel={t('acc.halfLess')} className="items-center justify-center rounded-full bg-card-2 active:opacity-70" style={{ width: 56, height: 56 }}>
                <SymbolView name={{ ios: 'minus', android: 'remove', web: 'remove' }} tintColor="white" size={18} />
              </Pressable>
              <View className="items-center">
                <Text {...COMPACT_TEXT} className="font-black text-white" style={{ fontSize: 44 }}>
                  {sleep == null ? '–' : sleep}
                </Text>
                <Text {...COMPACT_TEXT} className="text-xs text-muted">
                  {sleep == null ? t('checkin.tapToAnswer') : t('checkin.hours')}
                </Text>
              </View>
              <Pressable onPress={() => step(0.5)} accessibilityRole="button" accessibilityLabel={t('acc.halfMore')} className="items-center justify-center rounded-full bg-card-2 active:opacity-70" style={{ width: 56, height: 56 }}>
                <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor="white" size={18} />
              </Pressable>
            </View>
          </View>

          <ScaleRow question={t('checkin.sleepQuality')} low={t('checkin.badly')} high={t('checkin.veryWell')} value={quality} onChange={setQuality} />
          <ScaleRow question={t('checkin.energy')} low={t('checkin.drained')} high={t('checkin.fullEnergy')} value={energy} onChange={setEnergy} />
          <ScaleRow question={t('checkin.hunger')} low={t('checkin.notHungry')} high={t('checkin.alwaysHungry')} value={hunger} onChange={setHunger} />
          <ScaleRow question={t('checkin.stress')} low={t('checkin.calm')} high={t('checkin.veryStressed')} value={stress} onChange={setStress} />
        </View>

        {error ? (
          <View accessibilityRole="alert" className="mx-5 mt-6 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm text-white">{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 flex-row gap-3 px-5" style={{ paddingBottom: insets.bottom + 16, paddingTop: 12, backgroundColor: 'rgba(0,0,0,0.92)' }}>
        <Pressable onPress={() => goBack(router)} accessibilityRole="button" className="h-14 items-center justify-center rounded-full border border-white/15 px-7 active:opacity-70">
          <Text {...COMPACT_TEXT} className="text-base font-bold text-white">
            {t('common.skip')}
          </Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={busy || !answered}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || !answered }}
          className="h-14 flex-1 items-center justify-center rounded-full active:opacity-80"
          style={{ backgroundColor: answered ? BRAND : 'rgba(255,255,255,0.1)' }}>
          {busy ? <ActivityIndicator color={INK} /> : <Text {...COMPACT_TEXT} className="text-base font-black" style={{ color: answered ? INK : '#6f8577' }}>{t('common.save')}</Text>}
        </Pressable>
      </View>
    </View>
  );
}
