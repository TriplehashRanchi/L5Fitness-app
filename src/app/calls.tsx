import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { ConfirmSheet } from '@/components/confirm-sheet';
import { Block, GhostButton, PrimaryButton, Screen } from '@/components/screen';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { messageFrom } from '@/lib/http';
import { bookCall, cancelCall, getCalls, getLive, rsvpLive, unrsvpLive, type CallSlot, type Calls, type LiveSession } from '@/lib/together-api';
import { useT } from '@/providers/language-provider';

const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const HAIRLINE = 'rgba(255,255,255,0.07)';
const MINUTE = 60_000;

/** Calls with your dietitian, and live group sessions. */
export default function CallsScreen() {
  const { format, now } = useDeviceClock();
  const t = useT();
  const [calls, setCalls] = useState<Calls | null>(null);
  const [live, setLive] = useState<LiveSession[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'book' | 'cancel'; slot: CallSlot } | null>(null);

  const when = (iso: string) =>
    new Intl.DateTimeFormat(format.locale, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: format.timeZone }).format(new Date(iso));

  const load = useCallback(async () => {
    try {
      const [c, l] = await Promise.all([getCalls(), getLive()]);
      setCalls(c);
      setLive(l.sessions);
      setError(null);
    } catch (e) {
      setError(messageFrom(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const run = async (key: string, call: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await call();
      await load();
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  return (
    <Screen title={t('care.callsTitle')} intro={t('care.callsIntro')} error={error} onRefresh={load}>
      <Block title={t('care.callsBooked')}>
        {calls && calls.booked.length === 0 ? <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14 }}>{t('care.callsNone')}</Text> : null}
        {calls?.booked.map((s) => (
          <View key={s.id} style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
            <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 16 }}>
              {when(s.startsAt)}
            </Text>
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
              {t(s.kind === 'video' ? 'care.callsVideoDetail' : 'care.callsPhoneDetail', { n: s.durationMin, name: s.dietitianName ?? calls.dietitianName ?? '' })}
            </Text>
            {s.joinNote ? (
              <Text {...COMPACT_TEXT} className="text-white" style={{ fontSize: 14, lineHeight: 20, marginTop: 8 }}>
                {t('care.callsHowToJoin', { note: s.joinNote })}
              </Text>
            ) : null}
            {calls.recordingAllowed ? (
              <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 6 }}>
                {t('care.callsRecording')}
              </Text>
            ) : null}
            {new Date(s.startsAt).getTime() > now.getTime() + calls.noticeHours * 60 * MINUTE ? (
              <View className="flex-row" style={{ marginTop: 10 }}>
                <GhostButton label={t('care.callsGiveBack')} onPress={() => setConfirm({ kind: 'cancel', slot: s })} />
              </View>
            ) : (
              <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                {t('care.callsStartingSoon')}
              </Text>
            )}
          </View>
        ))}
      </Block>

      <Block title={calls?.dietitianName ? t('care.callsTimesFrom', { name: calls.dietitianName }) : t('care.callsBookTitle')}>
        {calls && !calls.dietitianName ? (
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
            {t('care.callsNeedDietitian')}
          </Text>
        ) : null}
        {calls?.dietitianName && calls.open.length === 0 ? (
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
            {t('care.callsNoTimes')}
          </Text>
        ) : null}
        {calls?.open.map((s) => (
          <View key={s.id} className="flex-row items-center" style={{ gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
            <View className="flex-1">
              <Text {...COMPACT_TEXT} className="font-semibold text-white" style={{ fontSize: 15 }}>
                {when(s.startsAt)}
              </Text>
              <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12 }}>
                {t(s.kind === 'video' ? 'care.callsVideoShort' : 'care.callsPhoneShort', { n: s.durationMin })}
              </Text>
            </View>
            <GhostButton label={t('care.callsBook')} onPress={() => setConfirm({ kind: 'book', slot: s })} busy={busy === s.id} />
          </View>
        ))}
        {calls?.dietitianName ? (
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, lineHeight: 17, marginTop: 10 }}>
            {t('care.callsLimits', { max: calls.maxBooked, hours: calls.noticeHours })}
          </Text>
        ) : null}
      </Block>

      <Block title={t('care.liveTitle')}>
        {live && live.length === 0 ? <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14 }}>{t('care.liveNone')}</Text> : null}
        {live?.map((s) => (
          <View key={s.id} style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
            <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 16 }}>
              {s.title}
            </Text>
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
              {[
                when(s.startsAt),
                t('care.minShort', { n: s.durationMin }),
                s.hostName ? t('care.liveWith', { name: s.hostName }) : null,
                s.capacity ? t('care.liveGoingOf', { n: s.going, total: s.capacity }) : t('care.liveGoing', { n: s.going }),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            {s.description ? (
              <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, lineHeight: 19, marginTop: 6 }}>
                {s.description}
              </Text>
            ) : null}
            <View className="flex-row flex-wrap" style={{ gap: 10, marginTop: 12 }}>
              {s.rsvp ? (
                <>
                  {s.joinUrl ? <PrimaryButtonSmall label={t('care.join')} onPress={() => void Linking.openURL(s.joinUrl!)} /> : null}
                  <GhostButton label={t('care.liveCantCome')} onPress={() => void run(s.id, () => unrsvpLive(s.id))} busy={busy === s.id} />
                </>
              ) : s.full ? (
                <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13 }}>
                  {t('care.liveFull')}
                </Text>
              ) : (
                <GhostButton label={t('care.liveSave')} onPress={() => void run(s.id, () => rsvpLive(s.id))} busy={busy === s.id} />
              )}
            </View>
          </View>
        ))}
      </Block>

      <ConfirmSheet
        visible={confirm != null}
        title={confirm?.kind === 'book' ? t('care.callsBookQ') : t('care.callsGiveBackQ')}
        message={confirm ? t(confirm.kind === 'book' ? 'care.callsBookMsg' : 'care.callsGiveBackMsg', { time: when(confirm.slot.startsAt) }) : ''}
        confirmLabel={confirm?.kind === 'book' ? t('care.callsBook') : t('care.callsGiveBackConfirm')}
        busy={busy != null}
        onConfirm={() => confirm && void run(confirm.slot.id, () => (confirm.kind === 'book' ? bookCall(confirm.slot.id) : cancelCall(confirm.slot.id)))}
        onCancel={() => setConfirm(null)}
      />
    </Screen>
  );
}

/** A compact green button for beside another one. */
function PrimaryButtonSmall({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <View style={{ minWidth: 100 }}>
      <PrimaryButton label={label} onPress={onPress} />
    </View>
  );
}
