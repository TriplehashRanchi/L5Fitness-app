import { DisplayText } from '@/components/display-text';
import { BmiScale, WeightRing, WeightTrend } from '@/components/profile/weight-visuals';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { EmergencyCard } from '@/components/emergency-sheet';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { PauseSheet } from '@/components/pause-sheet';
import { BottomTabInset } from '@/constants/theme';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { usePause } from '@/hooks/use-pause';
import { useMembership } from '@/hooks/use-membership';
import { useWeek } from '@/hooks/use-week';
import { useLanguage, useT } from '@/providers/language-provider';
import {
  ACTIVITY_KEY,
  bmi,
  bmiCategory,
  DIET_KEY,
  fmtKg,
  goalProgress,
  goalRemaining,
  GOAL_KEY,
  parseDecimal,
  SEX_KEY,
} from '@/lib/body';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { emergencyLine } from '@/lib/emergency';
import { messageFrom } from '@/lib/http';
import type { Translate } from '@/lib/i18n';
import { requestCancel } from '@/lib/membership-api';
import { summaryUrl } from '@/lib/progress-api';
import { PAUSE_REASON_KEY, requestRestart, startPause, type BodyProfile, type PauseReason, type WeightEntry } from '@/lib/wellness-api';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/providers/profile-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const MUTED = '#8fa396';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const WEB_TOP_BAR = 72;
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** A section of the page: an icon, a title and a short status on the right, then its content. */
function Card({
  icon,
  title,
  status,
  statusColor,
  children,
}: {
  icon: SymbolViewProps['name'];
  title: string;
  status?: string | null;
  statusColor?: string;
  children: ReactNode;
}) {
  const { language } = useLanguage();
  // No box around a section: a small heading, the content on the page itself, and a thin line between sections.
  return (
    <View className="px-5" style={{ paddingTop: 22, paddingBottom: 24, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
      <View className="flex-row items-center" style={{ gap: 10, marginBottom: 14 }}>
        <SymbolView name={icon} tintColor={MUTED} size={16} />
        <Text {...COMPACT_TEXT} accessibilityRole="header" className="flex-1 font-bold uppercase text-muted" style={{ fontSize: 12, letterSpacing: language === 'en' ? 1.4 : 0 }}>
          {title}
        </Text>
        {status ? (
          <Text {...COMPACT_TEXT} className="font-bold" style={{ fontSize: 13, color: statusColor ?? '#ffffff', flexShrink: 1, maxWidth: '55%', textAlign: 'right' }}>
            {status}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** One of the three numbers under the weight ring. */
function Figure({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} className="flex-1 items-center" style={{ borderLeftWidth: divider ? 1 : 0, borderLeftColor: HAIRLINE }}>
      <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 16 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text {...COMPACT_TEXT} className="text-center text-muted" style={{ fontSize: 12, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

/** One fact about the member as a row: icon, what it is, and the value at the right. */
function Row({ icon, label, value, tone, first }: { icon: SymbolViewProps['name']; label: string; value: string; tone?: string; first?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="flex-row items-center"
      style={{ gap: 12, minHeight: 50, borderTopWidth: first ? 0 : 1, borderTopColor: HAIRLINE }}>
      <SymbolView name={icon} tintColor={MUTED} size={17} />
      <Text {...COMPACT_TEXT} className="flex-1 text-muted" style={{ fontSize: 15 }} numberOfLines={2}>
        {label}
      </Text>
      <Text {...COMPACT_TEXT} className="font-bold" style={{ fontSize: 15, color: tone ?? '#ffffff', flexShrink: 1, maxWidth: '55%', textAlign: 'right' }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

/** One thing worked out from the member's numbers: a short title and a sentence in plain words. */
function Insight({ icon, title, text, first }: { icon: SymbolViewProps['name']; title: string; text: string; first?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${title}. ${text}`} className="flex-row" style={{ gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: HAIRLINE }}>
      <SymbolView name={icon} tintColor={BRAND} size={18} style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 15 }}>
          {title}
        </Text>
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, lineHeight: 19, marginTop: 2 }}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const ACTIVITY_FACTOR = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 } as const;

/**
 * What the member's own numbers say, in three plain sentences:
 * the healthy weight range for their height (BMI 18.5 to 24.9), roughly how much energy they use in a day
 * (the Mifflin-St Jeor estimate times their activity level), and how fast their weight is moving.
 */
function insightsFor(profile: BodyProfile, history: WeightEntry[], locale: string, t: Translate) {
  const m = profile.heightCm / 100;
  const low = 18.5 * m * m;
  const high = 24.9 * m * m;
  const inRange = profile.weightKg >= low && profile.weightKg <= high;
  const range = {
    title: t('prof.range.title', { low: fmtKg(low), high: fmtKg(high) }),
    text: inRange
      ? t('prof.range.inside')
      : profile.weightKg > high
        ? t('prof.range.above', { kg: fmtKg(profile.weightKg - high) })
        : t('prof.range.below', { kg: fmtKg(low - profile.weightKg) }),
  };

  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age + (profile.sex === 'male' ? 5 : profile.sex === 'female' ? -161 : -78);
  const daily = Math.round((base * ACTIVITY_FACTOR[profile.activityLevel]) / 10) * 10;
  const energy = {
    title: t('prof.energy.title', { kcal: daily.toLocaleString(locale) }),
    text: t(profile.goal === 'lose' ? 'prof.energy.lose' : profile.goal === 'gain' ? 'prof.energy.gain' : 'prof.energy.maintain'),
  };

  // Pace: from the oldest to the newest of the recent weigh-ins (newest first in `history`).
  const recent = history.slice(0, 12);
  const newest = recent[0];
  const oldest = recent[recent.length - 1];
  const days = newest && oldest ? (Date.parse(newest.day) - Date.parse(oldest.day)) / 86_400_000 : 0;
  let pace: { title: string; text: string };
  if (profile.goal === 'maintain') {
    const off = Math.abs(profile.weightKg - profile.targetWeightKg);
    pace =
      off <= 2
        ? { title: t('prof.pace.steady'), text: t('prof.pace.within', { kg: fmtKg(off) }) }
        : { title: t('prof.pace.offTitle', { kg: fmtKg(off) }), text: t('prof.pace.offText') };
  } else if (!newest || !oldest || days < 7) {
    pace = { title: t('prof.pace.soonTitle'), text: t('prof.pace.soonText') };
  } else {
    const perWeek = ((newest.weightKg - oldest.weightKg) / days) * 7;
    const toward = profile.goal === 'lose' ? perWeek < -0.05 : perWeek > 0.05;
    const left = Math.abs(profile.targetWeightKg - profile.weightKg);
    const reached = profile.goal === 'lose' ? profile.weightKg <= profile.targetWeightKg : profile.weightKg >= profile.targetWeightKg;
    if (reached) pace = { title: t('prof.pace.reachedTitle'), text: t('prof.pace.reachedText') };
    else if (toward) {
      const weeks = Math.max(1, Math.round(left / Math.abs(perWeek)));
      const one = weeks === 1;
      const sentence =
        profile.goal === 'lose' ? (one ? 'prof.pace.losingWeek' : 'prof.pace.losingWeeks') : one ? 'prof.pace.gainingWeek' : 'prof.pace.gainingWeeks';
      pace = {
        title: t(one ? 'prof.pace.weekTitle' : 'prof.pace.weeksTitle', { weeks }),
        text: t(sentence, { kg: fmtKg(Math.abs(perWeek)), weeks }),
      };
    } else pace = { title: t('prof.pace.notTitle'), text: t(Math.abs(perWeek) < 0.05 ? 'prof.pace.same' : profile.goal === 'lose' ? 'prof.pace.up' : 'prof.pace.down') };
  }
  return { range, energy, pace };
}

/** A line of free text the member wrote (allergies, medical notes). */
function Note({ label, value }: { label: string; value: string | null }) {
  const t = useT();
  return (
    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text {...COMPACT_TEXT} className={value ? 'font-semibold text-white' : 'text-muted'} style={{ fontSize: 15, lineHeight: 21, marginTop: 2 }}>
        {value || t('prof.about.none')}
      </Text>
    </View>
  );
}

/** Yes / No, or "Not answered": a blank screening answer is unknown, never "no". */
const answer = (v: boolean | null, t: Translate) => t(v == null ? 'prof.health.notAnswered' : v ? 'common.yes' : 'common.no');

export default function ProfileScreen() {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { format } = useDeviceClock();
  const { session } = useAuth();
  const { profile, role, weightHistory, logWeight } = useProfile();
  const user = session?.user;

  const [sheet, setSheet] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pausing the plan for illness, injury or a doctor's advice.
  const { pause, setPause } = usePause();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
  const [pauseError, setPauseError] = useState<string | null>(null);
  const emergency = emergencyLine();

  // The membership: what they are on, until when, and an easy way to ask to stop.
  const { state: membership, setState: setMembership } = useMembership();
  const [cancelAsk, setCancelAsk] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const sendCancel = async () => {
    setCancelBusy(true);
    setCancelError(null);
    try {
      setMembership(await requestCancel());
      setCancelAsk(false);
    } catch (e) {
      setCancelError(messageFrom(e));
      setCancelAsk(false);
    } finally {
      setCancelBusy(false);
    }
  };

  // This week's agreed actions and the 30/60/90-day summaries.
  const todayKey = toDayKey(getZonedParts(new Date(), format.timeZone));
  const { card: weekCard, summaries } = useWeek(todayKey);
  const [openingSummary, setOpeningSummary] = useState<number | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const openSummary = async (days: number) => {
    setOpeningSummary(days);
    setSummaryError(null);
    try {
      await Linking.openURL(await summaryUrl(days));
    } catch (e) {
      setSummaryError(messageFrom(e));
    } finally {
      setOpeningSummary(null);
    }
  };

  const doPause = async (reason: PauseReason, note: string) => {
    setPauseBusy(true);
    setPauseError(null);
    try {
      setPause((await startPause(reason, note)).pause);
      setPauseOpen(false);
    } catch (e) {
      setPauseError(messageFrom(e));
    } finally {
      setPauseBusy(false);
    }
  };
  const doRestart = async () => {
    setPauseBusy(true);
    setPauseError(null);
    try {
      setPause((await requestRestart()).pause);
    } catch (e) {
      setPauseError(messageFrom(e));
    } finally {
      setPauseBusy(false);
    }
  };

  const isWeb = Platform.OS === 'web';

  const saveWeight = async () => {
    const kg = parseDecimal(text);
    if (kg == null || kg < 25 || kg > 300) return setError(t('prof.err.logWeight'));
    setBusy(true);
    setError(null);
    try {
      await logWeight(kg, toDayKey(getZonedParts(new Date(), format.timeZone)));
      setSheet(false);
      setText('');
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setBusy(false);
    }
  };

  const progress = profile ? goalProgress(profile.goal, profile.startWeightKg, profile.weightKg, profile.targetWeightKg) : 0;
  const bmiValue = profile ? bmi(profile.weightKg, profile.heightCm) : null;
  const band = bmiValue != null ? bmiCategory(bmiValue) : null;
  const insights = useMemo(() => (profile ? insightsFor(profile, weightHistory, format.locale, t) : null), [profile, weightHistory, format.locale, t]);

  // Calculate total change since start
  const totalChangeKg = profile ? parseFloat((profile.weightKg - profile.startWeightKg).toFixed(1)) : 0;
  const changeLabel =
    totalChangeKg === 0
      ? '0 kg'
      : totalChangeKg < 0
        ? `−${Math.abs(totalChangeKg)} kg`
        : `+${totalChangeKg} kg`;

  // Quick adjust weight in modal
  const adjustWeight = (delta: number) => {
    const current = parseDecimal(text) ?? (profile ? profile.weightKg : 70);
    const updated = Math.max(25, Math.min(300, parseFloat((current + delta).toFixed(1))));
    setText(String(updated));
  };

  const openSheet = () => {
    if (!profile) return;
    setError(null);
    setText(String(profile.weightKg));
    setSheet(true);
  };

  const roleLabel = t(role === 'admin' ? 'prof.me.admin' : role === 'dietitian' ? 'prof.me.dietitian' : 'prof.me.l5Athlete');
  const name = user?.name ?? t('prof.me.athlete');

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + (isWeb ? WEB_TOP_BAR : 8),
          width: '100%',
          maxWidth: 840,
          alignSelf: 'center',
          paddingBottom: insets.bottom + (isWeb ? 0 : BottomTabInset) + 24,
        }}>
        <View className="flex-row items-center justify-between px-5 pt-3" style={{ marginBottom: 16 }}>
          <DisplayText accessibilityRole="header" className="shrink text-[32px] leading-10 tracking-tight text-white" numberOfLines={1} adjustsFontSizeToFit>
            {t('profile.title')}
          </DisplayText>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('settings.title')}
            className="items-center justify-center rounded-full border border-white/10 bg-card active:opacity-70"
            style={{ width: 46, height: 46 }}>
            <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} tintColor="white" size={19} />
          </Pressable>
        </View>

        {/* Who this is: picture, name, role and goal, then the numbers that matter at a glance. */}
        <View>
          <View className="items-center" style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 22 }}>
            <View style={{ padding: 3, borderRadius: 52, borderWidth: 2, borderColor: BRAND }}>
              <Avatar name={name} image={user?.image} size={92} />
            </View>
            <DisplayText {...COMPACT_TEXT} className="text-center text-white" style={{ fontSize: 26, lineHeight: 32, marginTop: 12 }} numberOfLines={1} adjustsFontSizeToFit>
              {name}
            </DisplayText>
            <Text {...COMPACT_TEXT} className="text-center text-muted" style={{ fontSize: 13, marginTop: 2 }} numberOfLines={1}>
              {user?.email}
            </Text>
            <View className="flex-row flex-wrap justify-center" style={{ gap: 8, marginTop: 12 }}>
              <View className="justify-center rounded-full bg-brand" style={{ height: 26, paddingHorizontal: 12 }}>
                <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 12 }}>
                  {roleLabel}
                </Text>
              </View>
              {profile ? (
                <View className="justify-center rounded-full" style={{ height: 26, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                  <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 12 }}>
                    {t(GOAL_KEY[profile.goal])}
                  </Text>
                </View>
              ) : null}
            </View>
            {profile ? (
              <Pressable
                onPress={() => router.push('/edit-profile')}
                accessibilityRole="button"
                accessibilityLabel={t('prof.me.edit')}
                className="flex-row items-center justify-center rounded-full border border-white/15 active:opacity-70"
                style={{ gap: 8, minHeight: 44, paddingHorizontal: 22, marginTop: 16, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor="white" size={13} />
                <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 14 }}>
                  {t('profile.editProfile')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {profile ? (
            <View className="flex-row" style={{ paddingVertical: 18, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
              <Figure label={t('prof.me.weight')} value={fmtKg(profile.weightKg)} />
              <Figure label={t('prof.form.height')} value={`${parseFloat(profile.heightCm.toFixed(1))} cm`} divider />
              <Figure label="BMI" value={bmiValue != null ? String(bmiValue) : '–'} divider />
              <Figure label={t('prof.me.age')} value={`${profile.age}`} divider />
            </View>
          ) : null}
        </View>

        {profile ? (
          <>
            {/* Weight goal: the ring fills as the target gets closer. */}
            <Card icon={{ ios: 'scalemass', android: 'monitor_weight', web: 'monitor_weight' }} title={t('profile.weightGoal')} status={`${Math.round(progress * 100)}%`}>
              <View className="items-center" style={{ marginTop: 4 }}>
                <WeightRing weightKg={profile.weightKg} progress={progress} />
                <Text {...COMPACT_TEXT} className="font-bold text-brand" style={{ fontSize: 15, marginTop: 12 }}>
                  {goalRemaining(profile.goal, profile.weightKg, profile.targetWeightKg, t)}
                </Text>
              </View>
              <View className="flex-row" style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
                <Figure label={t('prof.me.start')} value={fmtKg(profile.startWeightKg)} />
                <Figure label={t('prof.me.change')} value={changeLabel} divider />
                <Figure label={t('prof.form.target')} value={fmtKg(profile.targetWeightKg)} divider />
              </View>
              <Pressable
                onPress={openSheet}
                accessibilityRole="button"
                accessibilityLabel={t('prof.me.logToday')}
                className="flex-row items-center justify-center rounded-full bg-brand active:opacity-80"
                style={{ gap: 8, minHeight: 52, marginTop: 16 }}>
                <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={INK} size={14} />
                <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 16 }}>
                  {t('profile.logWeight')}
                </Text>
              </Pressable>
            </Card>

            {/* This week: the agreed actions at a glance, and the way into the full result card. */}
            <Card icon={{ ios: 'checklist', android: 'checklist', web: 'checklist' }} title={t('profile.thisWeek')} status={weekCard && weekCard.agreed.total ? t('prof.week.status', { done: weekCard.agreed.completed, total: weekCard.agreed.total }) : null}>
              <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
                {weekCard && weekCard.agreed.total
                  ? t(weekCard.daysLeft > 0 ? (weekCard.daysLeft === 1 ? 'prof.week.doneDayLeft' : 'prof.week.doneDaysLeft') : 'prof.week.done', {
                      done: weekCard.agreed.completed,
                      total: weekCard.agreed.total,
                      days: weekCard.daysLeft,
                    })
                  : t('prof.week.empty')}
              </Text>
              <View className="flex-row" style={{ gap: 10, marginTop: 14 }}>
                <Pressable
                  onPress={() => router.push('/week' as never)}
                  accessibilityRole="button"
                  className="flex-1 flex-row items-center justify-center rounded-full bg-brand px-3 py-1.5 active:opacity-80"
                  style={{ gap: 8, minHeight: 48 }}>
                  <Text {...COMPACT_TEXT} className="shrink text-center font-black text-ink" style={{ fontSize: 15 }}>
                    {t('profile.seeWeek')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/check-in' as never)}
                  accessibilityRole="button"
                  className="flex-1 items-center justify-center rounded-full border border-white/15 px-3 py-1.5 active:opacity-70"
                  style={{ minHeight: 48, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <Text {...COMPACT_TEXT} className="text-center font-bold text-white" style={{ fontSize: 15 }}>
                    {t('profile.dailyCheckin')}
                  </Text>
                </Pressable>
              </View>
            </Card>

            {/* The membership, in plain words: what it is, until when, what it includes, and how to pause or stop. */}
            {role === 'member' && membership && (membership.current || membership.next || membership.ended) ? (() => {
              const m = membership.current ?? membership.next ?? membership.ended!;
              const running = !!membership.current;
              return (
                <Card
                  icon={{ ios: 'ticket', android: 'confirmation_number', web: 'confirmation_number' }}
                  title={t('profile.membership')}
                  status={
                    running
                      ? m.daysLeft <= 14
                        ? t(m.daysLeft === 1 ? 'prof.mem.dayLeft' : 'prof.mem.daysLeft', { n: m.daysLeft })
                        : t('prof.mem.active')
                      : t(membership.next ? 'prof.mem.soon' : 'prof.mem.ended')
                  }
                  statusColor={running && m.daysLeft > 14 ? BRAND : '#ffc857'}>
                  <Text {...COMPACT_TEXT} className="font-black text-white" style={{ fontSize: 20 }}>
                    {m.planName}
                  </Text>
                  <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, marginTop: 4 }}>
                    {running
                      ? membership.next
                        ? t('prof.mem.runsUntilNext', { date: m.endsOn, next: membership.next.startsOn })
                        : t('prof.mem.runsUntil', { date: m.endsOn })
                      : membership.next
                        ? t('prof.mem.startsOn', { date: m.startsOn })
                        : t('prof.mem.endedOn', { date: m.endsOn })}
                  </Text>
                  {m.pausedDays > 0 ? (
                    <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 6 }}>
                      {t(m.pausedDays === 1 ? 'prof.mem.extendedDay' : 'prof.mem.extendedDays', { n: m.pausedDays })}
                    </Text>
                  ) : null}
                  {membership.terms?.inclusions ? <Note label={t('prof.mem.included')} value={membership.terms.inclusions} /> : null}
                  {membership.terms?.pauseTerms ? <Note label={t('prof.mem.unwell')} value={membership.terms.pauseTerms} /> : null}
                  {membership.terms?.refundTerms ? <Note label={t('prof.mem.refunds')} value={membership.terms.refundTerms} /> : null}
                  {running && m.daysLeft <= 14 ? (
                    <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, lineHeight: 19, marginTop: 12 }}>
                      {t('prof.mem.review')}
                    </Text>
                  ) : null}
                  {running ? (
                    m.cancelRequestedAt ? (
                      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 12 }}>
                        {t('prof.mem.cancelAsked')}
                      </Text>
                    ) : (
                      <Pressable
                        onPress={() => setCancelAsk(true)}
                        accessibilityRole="button"
                        className="items-center justify-center rounded-full border border-white/15 active:opacity-70"
                        style={{ minHeight: 44, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 14 }}>
                          {t('prof.mem.wantCancel')}
                        </Text>
                      </Pressable>
                    )
                  ) : null}
                  {cancelError ? (
                    <Text accessibilityRole="alert" {...COMPACT_TEXT} className="mt-2 text-accent" style={{ fontSize: 13 }}>
                      {cancelError}
                    </Text>
                  ) : null}
                </Card>
              );
            })() : null}

            {/* Together: the group, milestones, calls and live sessions, and family. All optional. */}
            <Card icon={{ ios: 'person.3', android: 'groups', web: 'groups' }} title={t('profile.together')}>
              {([
                { label: t('profile.community'), hint: t('prof.together.community'), path: '/community', icon: { ios: 'person.2.wave.2', android: 'diversity_3', web: 'diversity_3' } },
                { label: t('profile.milestones'), hint: t('prof.together.milestones'), path: '/milestones', icon: { ios: 'rosette', android: 'military_tech', web: 'military_tech' } },
                { label: t('profile.calls'), hint: t('prof.together.calls'), path: '/calls', icon: { ios: 'phone.arrow.up.right', android: 'call', web: 'call' } },
                { label: t('profile.family'), hint: t('prof.together.family'), path: '/family', icon: { ios: 'house', android: 'home', web: 'home' } },
              ] as const).map((row, i) => (
                <Pressable
                  key={row.path}
                  onPress={() => router.push(row.path as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.label}. ${row.hint}`}
                  className="flex-row items-center active:opacity-70"
                  style={{ gap: 12, minHeight: 60, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: HAIRLINE }}>
                  <SymbolView name={row.icon} tintColor={BRAND} size={20} />
                  <View className="flex-1">
                    <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 15 }}>
                      {row.label}
                    </Text>
                    <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 1 }}>
                      {row.hint}
                    </Text>
                  </View>
                  <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={MUTED} size={14} />
                </Pressable>
              ))}
            </Card>

            {insights ? (
              <Card icon={{ ios: 'lightbulb', android: 'lightbulb', web: 'lightbulb' }} title={t('prof.forYou')}>
                <Insight first icon={{ ios: 'flag.checkered', android: 'flag', web: 'flag' }} title={insights.pace.title} text={insights.pace.text} />
                <Insight icon={{ ios: 'heart', android: 'favorite', web: 'favorite' }} title={insights.range.title} text={insights.range.text} />
                <Insight icon={{ ios: 'flame', android: 'local_fire_department', web: 'local_fire_department' }} title={insights.energy.title} text={insights.energy.text} />
                <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 11, lineHeight: 16, marginTop: 4 }}>
                  {t('prof.estimates')}
                </Text>
              </Card>
            ) : null}

            <Card
              icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'show_chart', web: 'show_chart' }}
              title={t('prof.trend.title')}
              status={weightHistory.length > 1 ? t('prof.trend.count', { n: Math.min(12, weightHistory.length) }) : null}>
              <WeightTrend history={weightHistory} targetKg={profile.targetWeightKg} locale={format.locale} />
            </Card>

            {bmiValue != null && band ? (
              <Card icon={{ ios: 'heart', android: 'favorite', web: 'favorite' }} title="BMI" status={t(band.key)} statusColor={band.tone === 'ok' ? BRAND : '#fb923c'}>
                <DisplayText {...COMPACT_TEXT} className="text-white" style={{ fontSize: 36, lineHeight: 42, marginBottom: 8 }}>
                  {bmiValue}
                </DisplayText>
                <BmiScale value={bmiValue} />
              </Card>
            ) : null}

            {/* Waist and health readings. Optional. */}
            <Card icon={{ ios: 'ruler', android: 'straighten', web: 'straighten' }} title={t('profile.waistReadings')}>
              <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
                {t('prof.waist.intro')}
              </Text>
              <View className="flex-row" style={{ gap: 10, marginTop: 14 }}>
                <Pressable
                  onPress={() => router.push({ pathname: '/measures', params: { kind: 'waist_cm' } } as never)}
                  accessibilityRole="button"
                  className="flex-1 items-center justify-center rounded-full bg-brand px-3 py-1.5 active:opacity-80"
                  style={{ minHeight: 48 }}>
                  <Text {...COMPACT_TEXT} className="text-center font-black text-ink" style={{ fontSize: 15 }}>
                    {t('prof.waist.log')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push('/measures' as never)}
                  accessibilityRole="button"
                  className="flex-1 items-center justify-center rounded-full border border-white/15 px-3 py-1.5 active:opacity-70"
                  style={{ minHeight: 48, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <Text {...COMPACT_TEXT} className="text-center font-bold text-white" style={{ fontSize: 15 }}>
                    {t('prof.waist.all')}
                  </Text>
                </Pressable>
              </View>
            </Card>

            <Card icon={{ ios: 'person', android: 'person', web: 'person' }} title={t('profile.about')}>
              <Row first icon={{ ios: 'birthday.cake', android: 'cake', web: 'cake' }} label={t('prof.me.age')} value={t('prof.about.years', { n: profile.age })} />
              <Row icon={{ ios: 'ruler', android: 'straighten', web: 'straighten' }} label={t('prof.form.height')} value={`${parseFloat(profile.heightCm.toFixed(1))} cm`} />
              <Row icon={{ ios: 'person', android: 'wc', web: 'wc' }} label={t('prof.form.sex')} value={t(SEX_KEY[profile.sex])} />
              <Row icon={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }} label={t('tabs.diet')} value={t(DIET_KEY[profile.dietType])} />
              <Row icon={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }} label={t('tabs.activity')} value={t(ACTIVITY_KEY[profile.activityLevel].title)} />
              <Row
                icon={{ ios: 'person.2', android: 'group', web: 'group' }}
                label={t('prof.about.sharing')}
                value={t(profile.shareWithDietitian ? 'prof.about.on' : 'prof.about.off')}
                tone={profile.shareWithDietitian ? BRAND : undefined}
              />
              <Note label={t('prof.about.allergies')} value={profile.allergies} />
              <Note label={t('prof.about.medicalNotes')} value={profile.medicalNotes} />
            </Card>

            {/* The health check: what the member told us about medicines, pregnancy, injury and a doctor's advice. */}
            <Card
              icon={{ ios: 'cross.case', android: 'medical_services', web: 'medical_services' }}
              title={t('profile.healthCheck')}
              status={profile.reviewReasons.length > 0 ? t('prof.health.willReview') : profile.screeningReviewedAt ? t('prof.health.reviewed') : null}
              statusColor={profile.reviewReasons.length > 0 ? '#ffc857' : BRAND}>
              <Row first icon={{ ios: 'pills', android: 'medication', web: 'medication' }} label={t('prof.health.medicines')} value={answer(profile.takesMedication, t)} />
              {profile.sex === 'female' ? (
                <Row
                  icon={{ ios: 'heart.circle', android: 'pregnant_woman', web: 'pregnant_woman' }}
                  label={t('prof.health.pregnancy')}
                  value={t(
                    profile.pregnancyStatus == null
                      ? 'prof.health.notAnswered'
                      : profile.pregnancyStatus === 'no'
                        ? 'common.no'
                        : profile.pregnancyStatus === 'pregnant'
                          ? 'screening.pregnant'
                          : 'screening.breastfeeding'
                  )}
                />
              ) : null}
              <Row icon={{ ios: 'bandage', android: 'healing', web: 'healing' }} label={t('prof.health.injury')} value={answer(profile.hasInjury, t)} />
              {profile.hasInjury && profile.injuryNotes ? <Note label={t('prof.reason.injury')} value={profile.injuryNotes} /> : null}
              <Row icon={{ ios: 'stethoscope', android: 'stethoscope', web: 'stethoscope' }} label={t('prof.health.restrictions')} value={answer(profile.hasRestriction, t)} />
              {profile.hasRestriction && profile.restrictionNotes ? <Note label={t('prof.health.advice')} value={profile.restrictionNotes} /> : null}
              <Pressable
                onPress={() => router.push({ pathname: '/edit-profile', params: { step: 'screening' } } as never)}
                accessibilityRole="button"
                accessibilityLabel={t('prof.health.updateLabel')}
                className="flex-row items-center justify-center rounded-full border border-white/15 active:opacity-70"
                style={{ gap: 8, minHeight: 44, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor="white" size={13} />
                <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 14 }}>
                  {t('prof.health.update')}
                </Text>
              </Pressable>
            </Card>

            {/* Pause the plan during illness, injury or a doctor's restriction. Only the dietitian restarts it. */}
            {role === 'member' ? (
              <Card
                icon={{ ios: 'pause.circle', android: 'pause_circle', web: 'pause_circle' }}
                title={t('profile.pausePlan')}
                status={pause ? t(pause.status === 'restart_requested' ? 'prof.pause.waiting' : 'prof.pause.paused') : null}
                statusColor="#ffc857">
                {pause ? (
                  <>
                    <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
                      {t(pause.status === 'restart_requested' ? 'prof.pause.waitingText' : 'prof.pause.readyText', { reason: t(PAUSE_REASON_KEY[pause.reason]) })}
                    </Text>
                    {pause.status === 'paused' ? (
                      <Pressable
                        onPress={doRestart}
                        disabled={pauseBusy}
                        accessibilityRole="button"
                        className="flex-row items-center justify-center rounded-full bg-brand active:opacity-80"
                        style={{ gap: 8, minHeight: 52, marginTop: 14 }}>
                        {pauseBusy ? (
                          <ActivityIndicator color={INK} size="small" />
                        ) : (
                          <Text {...COMPACT_TEXT} className="px-4 py-1 text-center font-black text-ink" style={{ fontSize: 16 }}>
                            {t('prof.pause.ready')}
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                    {pauseError ? (
                      <Text accessibilityRole="alert" {...COMPACT_TEXT} className="mt-2 text-accent" style={{ fontSize: 13 }}>
                        {pauseError}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
                      {t('prof.pause.intro')}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setPauseError(null);
                        setPauseOpen(true);
                      }}
                      accessibilityRole="button"
                      className="flex-row items-center justify-center rounded-full border border-white/15 active:opacity-70"
                      style={{ gap: 8, minHeight: 48, marginTop: 14, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                      <SymbolView name={{ ios: 'pause.fill', android: 'pause', web: 'pause' }} tintColor="white" size={13} />
                      <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 15 }}>
                        {t('profile.pausePlan')}
                      </Text>
                    </Pressable>
                  </>
                )}
              </Card>
            ) : null}
            {/* Day 30, 60 and 90 summaries, as PDFs. */}
            {role === 'member' && summaries.length ? (
              <Card icon={{ ios: 'doc.text', android: 'description', web: 'description' }} title={t('profile.reports')}>
                <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
                  {t('prof.reports.intro')}
                </Text>
                {summaries.map((s) => (
                  <Pressable
                    key={s.days}
                    onPress={() => void openSummary(s.days)}
                    disabled={!s.ready || openingSummary != null}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !s.ready }}
                    className="flex-row items-center"
                    style={{ gap: 12, minHeight: 54, borderTopWidth: 1, borderTopColor: HAIRLINE, marginTop: 4, opacity: s.ready ? 1 : 0.55 }}>
                    <SymbolView name={{ ios: 'arrow.down.doc', android: 'download', web: 'download' }} tintColor={s.ready ? BRAND : MUTED} size={18} />
                    <Text {...COMPACT_TEXT} className="flex-1 font-bold text-white" style={{ fontSize: 15 }}>
                      {t('prof.reports.day', { n: s.days })}
                    </Text>
                    {openingSummary === s.days ? <ActivityIndicator color={BRAND} size="small" /> : (
                      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13 }}>
                        {s.ready ? t('prof.reports.open') : s.readyOn ? t('prof.reports.readyOn', { date: s.readyOn }) : t('prof.reports.afterStart')}
                      </Text>
                    )}
                  </Pressable>
                ))}
                {summaryError ? (
                  <Text accessibilityRole="alert" {...COMPACT_TEXT} className="mt-2 text-accent" style={{ fontSize: 13 }}>
                    {summaryError}
                  </Text>
                ) : null}
              </Card>
            ) : null}

          </>
        ) : (
          <Card icon={{ ios: 'figure.strengthtraining.traditional', android: 'fitness_center', web: 'fitness_center' }} title={t('prof.form.title')}>
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
              {t('prof.empty.intro')}
            </Text>
            <Pressable
              onPress={() => router.push('/complete-profile' as never)}
              accessibilityRole="button"
              className="flex-row items-center justify-center rounded-full bg-brand active:opacity-80"
              style={{ gap: 8, minHeight: 52, marginTop: 16 }}>
              <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 16 }}>
                {t('prof.complete.button')}
              </Text>
              <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor={INK} size={13} />
            </Pressable>
          </Card>
        )}

        {/* Always here, with or without a profile: one tap to the emergency number. */}
        <Card icon={{ ios: 'cross.case.fill', android: 'emergency', web: 'emergency' }} title={t('emergency.title')}>
          <EmergencyCard number={emergency.number} label={emergency.label} />
        </Card>
      </ScrollView>

      <ConfirmSheet
        visible={cancelAsk}
        title={t('prof.mem.askTitle')}
        message={t('prof.mem.askBody')}
        confirmLabel={t('prof.mem.send')}
        busy={cancelBusy}
        onConfirm={() => void sendCancel()}
        onCancel={() => setCancelAsk(false)}
      />
      <PauseSheet key={String(pauseOpen)} visible={pauseOpen} busy={pauseBusy} error={pauseError} onSubmit={doPause} onClose={() => setPauseOpen(false)} />

      {/* Log weight: nudge the number with − and +, or tap it to type. */}
      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <View accessibilityViewIsModal className="w-full rounded-3xl border border-white/10 bg-card" style={{ maxWidth: 420, padding: 20 }}>
            <View className="flex-row items-center justify-between">
              <DisplayText {...COMPACT_TEXT} accessibilityRole="header" className="flex-1 text-white" style={{ fontSize: language === 'en' ? 22 : 20, lineHeight: 28 }}>
                {t('profile.logWeight')}
              </DisplayText>
              <Pressable
                onPress={() => setSheet(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
                className="items-center justify-center rounded-full active:opacity-60"
                style={{ width: 34, height: 34, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor="white" size={12} />
              </Pressable>
            </View>

            <View className="flex-row items-center justify-between" style={{ marginTop: 22 }}>
              <Pressable
                onPress={() => adjustWeight(-0.1)}
                accessibilityRole="button"
                accessibilityLabel={t('prof.log.less')}
                className="items-center justify-center rounded-full bg-card-2 active:opacity-70"
                style={{ width: 56, height: 56 }}>
                <SymbolView name={{ ios: 'minus', android: 'remove', web: 'remove' }} tintColor="white" size={18} />
              </Pressable>
              <View className="flex-1 flex-row items-baseline justify-center" style={{ gap: 6 }}>
                <TextInput
                  value={text}
                  onChangeText={(value) => {
                    setText(value);
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor="#6f8577"
                  selectionColor={BRAND}
                  cursorColor={BRAND}
                  maxLength={5}
                  accessibilityLabel={t('prof.log.field')}
                  maxFontSizeMultiplier={1.3}
                  className="text-center font-black text-white"
                  style={{ fontSize: 44, minWidth: 110, paddingVertical: 4 }}
                />
                <Text {...COMPACT_TEXT} className="font-bold text-muted" style={{ fontSize: 16 }}>
                  kg
                </Text>
              </View>
              <Pressable
                onPress={() => adjustWeight(0.1)}
                accessibilityRole="button"
                accessibilityLabel={t('prof.log.more')}
                className="items-center justify-center rounded-full bg-card-2 active:opacity-70"
                style={{ width: 56, height: 56 }}>
                <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor="white" size={18} />
              </Pressable>
            </View>

            <View className="flex-row justify-center" style={{ gap: 8, marginTop: 14 }}>
              {[-1, -0.5, 0.5, 1].map((delta) => (
                <Pressable
                  key={delta}
                  onPress={() => adjustWeight(delta)}
                  accessibilityRole="button"
                  accessibilityLabel={t(delta > 0 ? 'prof.log.add' : 'prof.log.takeOff', { n: Math.abs(delta) })}
                  className="items-center justify-center rounded-full bg-card-2 active:opacity-70"
                  style={{ minHeight: 40, paddingHorizontal: 14 }}>
                  <Text {...COMPACT_TEXT} className="font-bold text-brand" style={{ fontSize: 14 }}>
                    {delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}
                  </Text>
                </Pressable>
              ))}
            </View>

            {error ? (
              <Text accessibilityRole="alert" {...COMPACT_TEXT} className="text-center text-accent" style={{ fontSize: 14, marginTop: 12 }}>
                {error}
              </Text>
            ) : null}

            <Pressable
              onPress={saveWeight}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ busy }}
              className="items-center justify-center rounded-full bg-brand active:opacity-80"
              style={{ minHeight: 52, marginTop: 20 }}>
              {busy ? (
                <ActivityIndicator color={INK} size="small" />
              ) : (
                <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 16 }}>
                  {t('common.save')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
