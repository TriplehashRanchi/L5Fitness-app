import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, TextInput, View, Pressable } from 'react-native';

import { ConfirmSheet } from '@/components/confirm-sheet';
import { Block, GhostButton, PrimaryButton, Screen } from '@/components/screen';
import { messageFrom } from '@/lib/http';
import { splitHighlight } from '@/lib/i18n';
import {
  getCommunity,
  joinCommunity,
  joinMission,
  leaveCommunity,
  leaveMission,
  missionWords,
  REGION_LABEL_KEY,
  type CommunityState,
  type Mission,
} from '@/lib/together-api';
import { useLanguage, useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const fmt = (n: number) => n.toLocaleString();

/** One Fitathon mission: what it counts, how long is left, your progress, the group's, and the top of the list. */
function MissionBlock({ m, onJoin, onLeave, busy }: { m: Mission; onJoin: () => void; onLeave: () => void; busy: boolean }) {
  const { t, language } = useLanguage();
  const words = missionWords(m, t);
  const mine = m.board?.mine;
  const percent = mine ? Math.min(100, Math.round((mine.value / m.goal) * 100)) : 0;
  return (
    <Block title={m.upcoming ? t('care.missionSoon') : m.ended ? t('care.missionFinished') : t(m.daysLeft === 1 ? 'care.missionDayLeft' : 'care.missionDaysLeft', { n: m.daysLeft })}>
      <Text {...COMPACT_TEXT} className="font-black text-white" style={{ fontSize: 20 }}>
        {m.title}
      </Text>
      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, marginTop: 4 }}>
        {t('care.missionGoal', { label: words.label, goal: fmt(m.goal), unit: words.unit })}
      </Text>
      {m.description ? (
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          {m.description}
        </Text>
      ) : null}

      {m.joined && mine ? (
        <View style={{ marginTop: 14 }}>
          <View className="flex-row items-baseline justify-between">
            <Text {...COMPACT_TEXT} className="font-black text-white" style={{ fontSize: 26, flexShrink: 1, marginRight: 10 }}>
              {splitHighlight(t('care.bigOf', { done: fmt(mine.value), total: fmt(m.goal) })).map((part, i) =>
                part.highlight ? part.text : <Text key={i} className="text-muted" style={{ fontSize: 14 }}>{part.text}</Text>
              )}
            </Text>
            <Text {...COMPACT_TEXT} className="font-bold" style={{ color: BRAND, fontSize: 14 }}>
              {percent}%
            </Text>
          </View>
          <View className="overflow-hidden rounded-full bg-white/10" style={{ height: 8, marginTop: 8 }}>
            <View className="rounded-full bg-brand" style={{ height: 8, width: `${percent}%` }} />
          </View>
          {mine.onBreak ? (
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>
              {t('care.missionOnBreak')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {m.board && m.joined ? (
        <View style={{ marginTop: 16 }}>
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginBottom: 6 }}>
            {t('care.missionTogether', { reached: m.board.reached, total: m.board.participants, sum: fmt(m.board.total), unit: words.unit })}
          </Text>
          {m.board.top.map((r) => (
            <View
              key={`${r.rank}-${r.name}`}
              className="flex-row items-center"
              style={{ gap: 12, minHeight: 46, borderTopWidth: 1, borderTopColor: HAIRLINE, backgroundColor: r.you ? 'rgba(61,220,104,0.08)' : undefined, paddingHorizontal: r.you ? 8 : 0, borderRadius: r.you ? 10 : 0 }}>
              <Text {...COMPACT_TEXT} className="font-black text-muted" style={{ width: 26, fontSize: 15 }}>
                {r.rank}
              </Text>
              <Text {...COMPACT_TEXT} className="flex-1 font-semibold text-white" style={{ fontSize: 15 }} numberOfLines={language === 'en' ? 1 : 2}>
                {r.you ? t('care.nameYou', { name: r.name }) : r.name}
              </Text>
              <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 15 }}>
                {fmt(r.value)}
              </Text>
            </View>
          ))}
          {m.board.onBreak ? (
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
              {t(m.board.onBreak === 1 ? 'care.missionBreakOne' : 'care.missionBreakMany', { n: m.board.onBreak })}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ marginTop: 16 }}>
        {m.ended ? null : m.joined ? <GhostButton label={t('care.missionLeave')} onPress={onLeave} busy={busy} /> : <PrimaryButton label={t('care.missionJoin')} onPress={onJoin} busy={busy} />}
      </View>
    </Block>
  );
}

/**
 * Community: join a regional group under a name you choose, then take part in Fitathon missions. Only that
 * name and a count of actions are shown to the group. No weight, health details or photos, ever.
 */
export default function CommunityScreen() {
  const t = useT();
  const [state, setState] = useState<CommunityState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await getCommunity();
      setState(next);
      if (!next.joined) setName((n) => n || next.suggestedName);
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

  const run = async (key: string, call: () => Promise<CommunityState | unknown>) => {
    setBusy(key);
    setError(null);
    try {
      const out = await call();
      if (out && typeof out === 'object' && 'joined' in out) setState(out as CommunityState);
      else await load();
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      title={t('profile.community')}
      intro={t('care.communityIntro')}
      error={error}
      refreshing={refreshing}
      onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}>
      {state && !state.joined ? (
        <Block title={t('care.communityPick')}>
          {state.cohorts.length === 0 ? (
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
              {t('care.communityNoGroups')}
            </Text>
          ) : (
            <>
              {state.cohorts.map((c) => {
                const on = cohortId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCohortId(c.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    className="rounded-2xl border-2 px-4 py-3"
                    style={{ marginBottom: 10, borderColor: on ? BRAND : 'transparent', backgroundColor: on ? 'rgba(61,220,104,0.1)' : 'rgba(255,255,255,0.05)' }}>
                    <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 16 }}>
                      {c.name}
                    </Text>
                    <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
                      {t(REGION_LABEL_KEY[c.region])} · {t(c.members === 1 ? 'care.peopleOne' : 'care.peopleMany', { n: c.members })}
                      {c.description ? ` · ${c.description}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
              <Text {...COMPACT_TEXT} className="mb-2 mt-3 text-sm font-semibold text-white">
                {t('care.communityName')}
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                maxLength={24}
                autoCapitalize="words"
                placeholder={t('care.communityNickname')}
                placeholderTextColor="#6f8577"
                selectionColor={BRAND}
                cursorColor={BRAND}
                accessibilityLabel={t('care.communityName')}
                maxFontSizeMultiplier={1.4}
                className="rounded-xl border border-white/10 bg-white/5 px-4 text-base text-white"
                style={{ minHeight: 52 }}
              />
              <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, lineHeight: 17, marginTop: 10 }}>
                {t('care.communityAgreeNote')}
              </Text>
              <View style={{ marginTop: 16 }}>
                <PrimaryButton label={t('care.communityAgree')} disabled={!cohortId || name.trim().length < 2} busy={busy === 'join'} onPress={() => void run('join', () => joinCommunity(cohortId!, name.trim()))} />
              </View>
            </>
          )}
        </Block>
      ) : null}

      {state && state.joined ? (
        <>
          <Block title={t('care.communityYourGroup')}>
            <Text {...COMPACT_TEXT} className="font-black text-white" style={{ fontSize: 22 }}>
              {state.cohort.name}
            </Text>
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, marginTop: 4 }}>
              {splitHighlight(t(state.cohort.members === 1 ? 'care.communityYouAsOne' : 'care.communityYouAsMany', { region: t(REGION_LABEL_KEY[state.cohort.region]), n: state.cohort.members, name: state.displayName })).map((part, i) =>
                part.highlight ? <Text key={i} className="font-bold text-white">{part.text}</Text> : part.text
              )}
            </Text>
            <View className="flex-row" style={{ marginTop: 14 }}>
              <GhostButton label={t('care.communityLeave')} danger onPress={() => setLeaving(true)} />
            </View>
          </Block>
          {state.missions.length === 0 ? (
            <Block title={t('care.missionsTitle')}>
              <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
                {t('care.missionsNone')}
              </Text>
            </Block>
          ) : null}
          {state.missions.map((m) => (
            <MissionBlock
              key={m.id}
              m={m}
              busy={busy === m.id}
              onJoin={() => void run(m.id, () => joinMission(m.id))}
              onLeave={() => void run(m.id, () => leaveMission(m.id))}
            />
          ))}
        </>
      ) : null}

      <ConfirmSheet
        visible={leaving}
        title={t('care.communityLeaveQ')}
        message={t('care.communityLeaveMsg')}
        confirmLabel={t('care.leave')}
        destructive
        busy={busy === 'leave'}
        onConfirm={() => void run('leave', async () => { await leaveCommunity(); setLeaving(false); return await getCommunity(); })}
        onCancel={() => setLeaving(false)}
      />
    </Screen>
  );
}
