import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Switch, Text, TextInput, View } from 'react-native';

import { ConfirmSheet } from '@/components/confirm-sheet';
import { Block, GhostButton, PrimaryButton, Screen } from '@/components/screen';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import { splitHighlight } from '@/lib/i18n';
import {
  acceptInvitation,
  createFamily,
  declineInvitation,
  getFamily,
  inviteToFamily,
  leaveFamily,
  removeFamilyInvite,
  removeFamilyMember,
  shareFamilyProgress,
  type FamilyState,
} from '@/lib/together-api';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/**
 * Family: invite the people you live with. Everyone keeps their own account and privacy. By default nothing
 * is shared; each person can choose to show the others one small summary. Weight, health details and meal
 * photos are never shared this way.
 */
export default function FamilyScreen() {
  const { format } = useDeviceClock();
  const t = useT();
  const today = toDayKey(getZonedParts(new Date(), format.timeZone));
  const [state, setState] = useState<FamilyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await getFamily(today));
      setError(null);
    } catch (e) {
      setError(messageFrom(e));
    }
  }, [today]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const run = async (key: string, call: () => Promise<FamilyState>, after?: () => void) => {
    setBusy(key);
    setError(null);
    try {
      setState(await call());
      after?.();
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setBusy(null);
      setLeaving(false);
      setRemoving(null);
    }
  };

  const f = state?.family;
  const input = (value: string, set: (v: string) => void, placeholder: string, label: string, extra?: object) => (
    <TextInput
      value={value}
      onChangeText={set}
      placeholder={placeholder}
      placeholderTextColor="#6f8577"
      selectionColor={BRAND}
      cursorColor={BRAND}
      accessibilityLabel={label}
      maxFontSizeMultiplier={1.4}
      className="rounded-xl border border-white/10 bg-white/5 px-4 text-base text-white"
      style={{ minHeight: 52 }}
      {...extra}
    />
  );

  return (
    <Screen
      title={t('profile.family')}
      intro={t('care.familyIntro')}
      error={error}
      onRefresh={load}>
      {state && !f ? (
        <>
          {state.invitations.length ? (
            <Block title={t('care.familyInvitedTitle')}>
              {state.invitations.map((i) => (
                <View key={i.id} style={{ paddingVertical: 10 }}>
                  <Text {...COMPACT_TEXT} className="text-white" style={{ fontSize: 15, lineHeight: 22 }}>
                    {splitHighlight(t(i.invitedBy ? 'care.familyInvitedBy' : 'care.familyInvited', { name: i.invitedBy ?? '', family: i.familyName })).map((part, n) =>
                      part.highlight ? <Text key={n} className="font-bold">{part.text}</Text> : part.text
                    )}
                  </Text>
                  <View className="flex-row flex-wrap" style={{ gap: 10, marginTop: 10 }}>
                    <View style={{ minWidth: 120 }}>
                      <PrimaryButton label={t('care.join')} busy={busy === i.id} onPress={() => void run(i.id, () => acceptInvitation(i.id, today))} />
                    </View>
                    <GhostButton label={t('care.familyNoThanks')} onPress={() => void run(i.id, () => declineInvitation(i.id, today))} busy={busy === i.id} />
                  </View>
                </View>
              ))}
            </Block>
          ) : null}
          <Block title={t('care.familyStartTitle')}>
            <Text {...COMPACT_TEXT} className="mb-3 text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
              {t('care.familyStartHint', { n: state.maxMembers - 1 })}
            </Text>
            {input(name, setName, t('care.familyNamePlaceholder'), t('care.familyName'), { maxLength: 40 })}
            <View style={{ marginTop: 14 }}>
              <PrimaryButton label={t('home.start')} disabled={name.trim().length < 1} busy={busy === 'create'} onPress={() => void run('create', () => createFamily(name.trim(), today), () => setName(''))} />
            </View>
          </Block>
        </>
      ) : null}

      {f ? (
        <>
          <Block title={f.name} status={t('care.countOf', { done: f.people.length, total: state?.maxMembers ?? '' })}>
            {f.people.map((p, i) => (
              <View key={p.id} style={{ paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: HAIRLINE }}>
                <View className="flex-row items-center" style={{ gap: 10 }}>
                  <Text {...COMPACT_TEXT} className="flex-1 font-bold text-white" style={{ fontSize: 16 }}>
                    {p.role === 'owner' ? t(p.you ? 'care.familyOwnerYou' : 'care.familyOwner', { name: p.name }) : p.you ? t('care.nameYou', { name: p.name }) : p.name}
                  </Text>
                  {f.role === 'owner' && !p.you ? <GhostButton label={t('meal.remove')} danger onPress={() => setRemoving({ id: p.id, name: p.name })} /> : null}
                </View>
                {p.summary ? (
                  <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, marginTop: 4 }}>
                    {p.summary.agreed.total ? `${t('care.familyActions', { done: p.summary.agreed.completed, total: p.summary.agreed.total })} · ` : ''}
                    {t(p.summary.streak === 1 ? 'care.streakOne' : 'care.streakMany', { n: p.summary.streak })}
                  </Text>
                ) : (
                  <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
                    {t('care.familyPrivate')}
                  </Text>
                )}
              </View>
            ))}
          </Block>

          <Block title={t('care.familyWhatShow')}>
            <View className="flex-row items-center" style={{ gap: 14 }}>
              <View className="flex-1">
                <Text {...COMPACT_TEXT} className="font-semibold text-white" style={{ fontSize: 16 }}>
                  {t('care.familyShare')}
                </Text>
                <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, lineHeight: 19, marginTop: 2 }}>
                  {t('care.familyShareHint')}
                </Text>
              </View>
              <Switch
                value={f.shareProgress}
                disabled={busy === 'share'}
                onValueChange={(v) => void run('share', () => shareFamilyProgress(v, today))}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: BRAND }}
                thumbColor="#ffffff"
                accessibilityLabel={t('care.familyShare')}
              />
            </View>
          </Block>

          {f.role === 'owner' ? (
            <Block title={t('care.familyInviteTitle')}>
              {f.invites.map((i) => (
                <View key={i.id} className="flex-row items-center" style={{ gap: 10, paddingVertical: 6 }}>
                  <Text {...COMPACT_TEXT} className="flex-1 text-muted" style={{ fontSize: 14 }} numberOfLines={2}>
                    {t('care.familyWaiting', { email: i.email })}
                  </Text>
                  <GhostButton label={t('care.familyTakeBack')} onPress={() => void run(i.id, () => removeFamilyInvite(i.id, today))} busy={busy === i.id} />
                </View>
              ))}
              <View style={{ marginTop: 8 }}>{input(email, setEmail, t('care.familyEmailPlaceholder'), t('care.familyEmailLabel'), { keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false })}</View>
              <View style={{ marginTop: 12 }}>
                <PrimaryButton label={t('care.familySend')} disabled={!email.includes('@')} busy={busy === 'invite'} onPress={() => void run('invite', () => inviteToFamily(email.trim(), today), () => setEmail(''))} />
              </View>
              <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, lineHeight: 17, marginTop: 10 }}>
                {t('care.familyNeedAccount')}
              </Text>
            </Block>
          ) : null}

          <Block>
            <GhostButton label={t('care.familyLeaveThis')} danger onPress={() => setLeaving(true)} />
          </Block>
        </>
      ) : null}

      <ConfirmSheet
        visible={leaving}
        title={t('care.familyLeaveQ')}
        message={t('care.familyLeaveMsg')}
        confirmLabel={t('care.leave')}
        destructive
        busy={busy === 'leave'}
        onConfirm={() => void run('leave', () => leaveFamily())}
        onCancel={() => setLeaving(false)}
      />
      <ConfirmSheet
        visible={removing != null}
        title={t('care.familyRemoveQ', { name: removing?.name ?? '' })}
        message={t('care.familyRemoveMsg')}
        confirmLabel={t('meal.remove')}
        destructive
        busy={busy === removing?.id}
        onConfirm={() => removing && void run(removing.id, () => removeFamilyMember(removing.id, today))}
        onCancel={() => setRemoving(null)}
      />
    </Screen>
  );
}
