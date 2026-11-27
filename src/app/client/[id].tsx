import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClientTargetsEditor } from '@/components/client-targets-editor';
import { ClientTrainingEditor } from '@/components/client-training-editor';
import { DisplayText } from '@/components/display-text';
import { GreenBackground } from '@/components/green-background';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { PauseSheet } from '@/components/pause-sheet';
import { WeekStrip } from '@/components/week-strip';
import { WeightChart } from '@/components/weight-chart';
import { useDeviceClock } from '@/hooks/use-device-clock';
import {
  ACTIVITY_KEY,
  bmi,
  bmiCategory,
  DIET_KEY,
  fmtKg,
  GOAL_KEY,
  goalProgress,
  goalRemaining,
  SEX_KEY,
} from '@/lib/body';
import type { Key } from '@/lib/i18n';
import { useLanguage } from '@/providers/language-provider';
import { addDays, dayLabel, formatTime, getWeekDays, getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import {
  addPlanItem,
  copyPlanDay,
  getClient,
  pauseClient,
  PAUSE_REASON_KEY,
  resumeClient,
  reviewScreening,
  type PauseReason,
  getClientPlan,
  removePlanItem,
  SLOT_KEY,
  SLOT_ORDER,
  type ClientDetail,
  type DietItem,
  type MealSlot,
  type PlanDay,
} from '@/lib/wellness-api';

const BRAND = '#3ddc68';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** Why a health check needs a look, by the words the server sends (L5Fitness-api: profile.controller.js). */
const REASON_KEY: Record<string, Key> = {
  Pregnant: 'screening.pregnant', // i18n-ignore
  Breastfeeding: 'screening.breastfeeding', // i18n-ignore
  Injury: 'care.reasonInjury', // i18n-ignore
  'Clinician restriction': 'care.reasonRestriction', // i18n-ignore
  'Takes medication': 'care.reasonMedication', // i18n-ignore
};

function Fact({ label, value }: { label: string; value: string }) {
  const { language } = useLanguage();
  return (
    <View className="min-w-[46%] flex-1 rounded-2xl bg-card-2 p-3">
      <Text {...COMPACT_TEXT} className={`text-[11px] uppercase text-muted ${language === 'en' ? 'tracking-wider' : ''}`}>{label}</Text>
      <Text {...COMPACT_TEXT} className="mt-0.5 text-sm font-bold text-white">{value}</Text>
    </View>
  );
}

/** A dietitian's view of one client: their answers and progress, and the plan editor. */
export default function ClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { now, format, firstWeekday } = useDeviceClock();
  const { t, language } = useLanguage();

  const todayParts = getZonedParts(now, format.timeZone);
  const todayKey = toDayKey(todayParts);
  const week = getWeekDays(todayParts, firstWeekday);
  const weekStart = toDayKey(week[0]);

  const [detail, setDetail] = useState<ClientDetail | null>(null);
  // Clinical safety: the review of health answers, and pausing or restarting the plan.
  const [pauseOpen, setPauseOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanDay | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const day = selected ?? todayKey;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [slot, setSlot] = useState<MealSlot>('breakfast');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [calories, setCalories] = useState('');
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<DietItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    getClient(id)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(messageFrom(e)));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load the plan for the chosen day. (A later answer never overwrites a newer one.)
  useEffect(() => {
    let cancelled = false;
    getClientPlan(id, day, weekStart)
      .then((p) => !cancelled && setPlan(p))
      .catch((e) => !cancelled && setError(messageFrom(e)));
    return () => {
      cancelled = true;
    };
  }, [id, day, weekStart]);

  /** Reload after an add, delete or copy. */
  const loadPlan = useCallback(async () => {
    try {
      setPlan(await getClientPlan(id, day, weekStart));
    } catch (e) {
      setError(messageFrom(e));
    }
  }, [id, day, weekStart]);

  const save = async () => {
    const itemTitle = title.trim();
    if (!itemTitle) return setNotice(t('care.clientTitleNeeded'));
    const kcal = calories.trim() ? Number(calories) : undefined;
    if (kcal !== undefined && (!Number.isInteger(kcal) || kcal < 0 || kcal > 3000)) return setNotice(t('care.clientCaloriesRange'));
    setBusy(true);
    setNotice(null);
    try {
      await addPlanItem(id, { day, mealSlot: slot, title: itemTitle, details: details.trim() || undefined, calories: kcal });
      setTitle('');
      setDetails('');
      setCalories('');
      setAdding(false);
      await loadPlan();
    } catch (e) {
      setNotice(messageFrom(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await removePlanItem(toDelete.id);
      setToDelete(null);
      await loadPlan();
    } catch (e) {
      setNotice(messageFrom(e));
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const copyYesterday = async () => {
    const from = toDayKey(addDays({ year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)), day: Number(day.slice(8)) }, -1));
    setBusy(true);
    setNotice(null);
    try {
      const res = await copyPlanDay(id, from, day);
      setNotice(t(res.copied === 1 ? 'care.clientCopiedOne' : 'care.clientCopiedMany', { n: res.copied, day: dayLabel(from, todayKey, format.locale) }));
      await loadPlan();
    } catch (e) {
      setNotice(messageFrom(e));
    } finally {
      setBusy(false);
    }
  };

  /** Runs a safety action, then refreshes the client's details. */
  const safety = async (run: () => Promise<unknown>) => {
    setSafetyBusy(true);
    setSafetyError(null);
    try {
      await run();
      setDetail(await getClient(id));
      setPauseOpen(false);
      setResumeOpen(false);
    } catch (e) {
      setSafetyError(messageFrom(e));
    } finally {
      setSafetyBusy(false);
    }
  };

  const p = detail?.profile;
  const progress = p ? goalProgress(p.goal, p.startWeightKg, p.weightKg, p.targetWeightKg) : 0;
  const band = p ? bmiCategory(bmi(p.weightKg, p.heightCm)) : null;
  const items = plan?.items ?? [];
  const adherence = detail?.adherence;
  const name = detail?.client.name || detail?.client.email || t('care.chatClient');

  return (
    <View className="flex-1 bg-ink">
      <GreenBackground />
      <StatusBar style="light" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: 840, alignSelf: 'center' }}>
          <View className="flex-row items-center gap-3 px-5">
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')} className="h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-70">
              <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
            </Pressable>
            <DisplayText className="flex-1 text-2xl font-bold text-white" numberOfLines={1}>{name}</DisplayText>
            {detail ? (
              <Pressable
                onPress={() => router.push({ pathname: '/chat/[id]', params: { id, name, image: detail.client.image ?? '' } })}
                accessibilityRole="button"
                accessibilityLabel={t('care.clientChatWith', { name })}
                className="h-11 flex-row items-center gap-2 rounded-full bg-brand px-4 active:opacity-80">
                <SymbolView name={{ ios: 'bubble.left.fill', android: 'chat', web: 'chat' }} tintColor="#050a07" size={15} />
                <Text maxFontSizeMultiplier={1.3} className="text-sm font-black text-ink">{t('care.clientChat')}</Text>
              </Pressable>
            ) : null}
          </View>

          {error ? (
            <View accessibilityRole="alert" className="mx-5 mt-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
              <Text className="text-sm text-white">{error}</Text>
            </View>
          ) : null}
          {!detail && !error ? <View className="items-center py-16"><ActivityIndicator color={BRAND} /></View> : null}

          {detail && p ? (
            <>
              {/* Who they are */}
              <View className="mx-5 mt-5 rounded-3xl border border-white/5 bg-card p-5">
                <View className="flex-row items-center gap-4">
                  <Avatar name={name} image={detail.client.image} size={60} />
                  <View className="flex-1">
                    <Text {...COMPACT_TEXT} numberOfLines={1} className="text-base font-bold text-white">{detail.client.email}</Text>
                    <Text {...COMPACT_TEXT} className="text-sm text-brand">{t(GOAL_KEY[p.goal])} · {goalRemaining(p.goal, p.weightKg, p.targetWeightKg, t)}</Text>
                  </View>
                </View>
                <View className="mt-4 flex-row items-end justify-between">
                  <View><Text {...COMPACT_TEXT} className="text-[11px] text-muted">{t('care.weekStartWeight')}</Text><Text {...COMPACT_TEXT} className="text-base font-bold text-white">{fmtKg(p.startWeightKg)}</Text></View>
                  <View className="items-center"><Text {...COMPACT_TEXT} className="text-[11px] text-muted">{t('care.clientNow')}</Text><DisplayText {...COMPACT_TEXT} className="text-2xl font-bold text-brand">{fmtKg(p.weightKg)}</DisplayText></View>
                  <View className="items-end"><Text {...COMPACT_TEXT} className="text-[11px] text-muted">{t('care.clientTarget')}</Text><Text {...COMPACT_TEXT} className="text-base font-bold text-white">{fmtKg(p.targetWeightKg)}</Text></View>
                </View>
                <View className="mt-3 overflow-hidden rounded-full bg-card-2" style={{ height: 8 }}>
                  <View className="rounded-full bg-brand" style={{ height: 8, width: `${Math.round(progress * 100)}%` }} />
                </View>
                <View className="mt-4 flex-row flex-wrap gap-2">
                  <Fact label={t('care.clientAgeSex')} value={`${p.age} · ${t(SEX_KEY[p.sex])}`} />
                  <Fact label={t('care.clientHeight')} value={`${parseFloat(p.heightCm.toFixed(1))} cm`} />
                  <Fact label={t('care.clientBmi')} value={`${bmi(p.weightKg, p.heightCm)} · ${band ? t(band.key) : ''}`} />
                  <Fact label={t('care.clientFood')} value={t(DIET_KEY[p.dietType])} />
                  <Fact label={t('tabs.activity')} value={t(ACTIVITY_KEY[p.activityLevel].title)} />
                  <Fact label={t('care.clientPlan7')} value={adherence && adherence.planned ? t('care.clientDoneOf', { done: adherence.done, total: adherence.planned }) : t('care.clientNoPlan')} />
                </View>
                <View className="mt-3 gap-2">
                  <View className="rounded-2xl bg-card-2 p-3">
                    <Text {...COMPACT_TEXT} className={`text-[11px] uppercase text-muted ${language === 'en' ? 'tracking-wider' : ''}`}>{t('care.clientAllergies')}</Text>
                    <Text {...COMPACT_TEXT} className="mt-0.5 text-sm text-white">{p.allergies || t('care.clientNoneAdded')}</Text>
                  </View>
                  <View className="rounded-2xl bg-card-2 p-3">
                    <Text {...COMPACT_TEXT} className={`text-[11px] uppercase text-muted ${language === 'en' ? 'tracking-wider' : ''}`}>{t('care.clientMedicalNotes')}</Text>
                    <Text {...COMPACT_TEXT} className="mt-0.5 text-sm text-white">{p.medicalNotes || t('care.clientNoneAdded')}</Text>
                  </View>
                </View>
              </View>

              {/* Safety first: health answers to review, and the plan's pause. */}
              {p.reviewReasons.length > 0 || detail.pause || p.takesMedication || p.hasInjury || p.hasRestriction || p.pregnancyStatus === 'pregnant' || p.pregnancyStatus === 'breastfeeding' ? (
                <View className="mx-5 mt-5 rounded-3xl border p-5" style={{ borderColor: 'rgba(255,200,87,0.35)', backgroundColor: 'rgba(255,200,87,0.07)' }}>
                  {detail.pause ? (
                    <View className="mb-4">
                      <Text {...COMPACT_TEXT} className="text-base font-bold text-white">
                        {detail.pause.status === 'restart_requested' ? t('care.clientReadyRestart') : t('care.clientPlanPaused')} · {t(PAUSE_REASON_KEY[detail.pause.reason])}
                      </Text>
                      {detail.pause.note ? <Text {...COMPACT_TEXT} className="mt-1 text-sm text-muted">{detail.pause.note}</Text> : null}
                      <Text {...COMPACT_TEXT} className="mt-1 text-sm text-muted">
                        {detail.pause.status === 'restart_requested'
                          ? t('care.clientFeelReady')
                          : t('care.clientRemindersOff')}
                      </Text>
                      <Pressable
                        onPress={() => setResumeOpen(true)}
                        accessibilityRole="button"
                        className="mt-3 items-center justify-center self-start rounded-full bg-brand active:opacity-80"
                        style={{ minHeight: 42, paddingHorizontal: 20 }}>
                        <Text {...COMPACT_TEXT} className="text-sm font-black text-ink">{t('care.clientRestartPlan')}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  <Text {...COMPACT_TEXT} className={`text-[11px] uppercase text-muted ${language === 'en' ? 'tracking-wider' : ''}`}>{t('profile.healthCheck')}</Text>
                  <View className="mt-2 gap-1">
                    {p.takesMedication ? <Text {...COMPACT_TEXT} className="text-sm text-white">• {t('care.clientMedicines')}</Text> : null}
                    {p.pregnancyStatus === 'pregnant' ? <Text {...COMPACT_TEXT} className="text-sm text-white">• {t('screening.pregnant')}</Text> : null}
                    {p.pregnancyStatus === 'breastfeeding' ? <Text {...COMPACT_TEXT} className="text-sm text-white">• {t('screening.breastfeeding')}</Text> : null}
                    {p.hasInjury ? <Text {...COMPACT_TEXT} className="text-sm text-white">• {t('care.clientInjury')}{p.injuryNotes ? `: ${p.injuryNotes}` : ''}</Text> : null}
                    {p.hasRestriction ? <Text {...COMPACT_TEXT} className="text-sm text-white">• {t('care.clientRestriction')}{p.restrictionNotes ? `: ${p.restrictionNotes}` : ''}</Text> : null}
                  </View>
                  {p.reviewReasons.length > 0 ? (
                    <>
                      <Text {...COMPACT_TEXT} className="mt-3 text-sm text-muted">
                        {t('care.clientLookAt', { reasons: p.reviewReasons.map((r) => (REASON_KEY[r] ? t(REASON_KEY[r]) : r)).join(', ') })}
                      </Text>
                      <Pressable
                        onPress={() => safety(() => reviewScreening(id))}
                        disabled={safetyBusy}
                        accessibilityRole="button"
                        className="mt-3 items-center justify-center self-start rounded-full border border-white/15 active:opacity-70"
                        style={{ minHeight: 42, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        <Text {...COMPACT_TEXT} className="text-sm font-bold text-white">{t('care.clientMarkReviewed')}</Text>
                      </Pressable>
                    </>
                  ) : p.screeningReviewedAt ? (
                    <Text {...COMPACT_TEXT} className="mt-3 text-sm text-brand">{t('care.clientReviewed')}</Text>
                  ) : null}
                  {safetyError ? <Text accessibilityRole="alert" {...COMPACT_TEXT} className="mt-3 text-sm text-accent">{safetyError}</Text> : null}
                </View>
              ) : null}
              {!detail.pause ? (
                <Pressable
                  onPress={() => { setSafetyError(null); setPauseOpen(true); }}
                  accessibilityRole="button"
                  className="mx-5 mt-3 flex-row items-center justify-center self-start rounded-full border border-white/15 active:opacity-70"
                  style={{ gap: 8, minHeight: 40, paddingHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <SymbolView name={{ ios: 'pause.fill', android: 'pause', web: 'pause' }} tintColor="white" size={12} />
                  <Text {...COMPACT_TEXT} className="text-sm font-bold text-white">{t('care.clientPausePlan')}</Text>
                </Pressable>
              ) : null}

              <View className="mx-5 mt-5 rounded-3xl border border-white/5 bg-card p-5">
                <Text className="mb-4 text-base font-bold text-white">{t('care.clientWeightProgress')}</Text>
                <WeightChart history={detail.weightHistory} targetKg={p?.targetWeightKg} locale={format.locale} />
              </View>

              <View className="mx-5 mt-5 rounded-3xl border border-white/5 bg-card p-5">
                <Text className="mb-3 text-base font-bold text-white">{t('care.clientRecentWorkouts')}</Text>
                {detail.recentWorkouts.length === 0 ? (
                  <Text {...COMPACT_TEXT} className="text-sm text-muted">{t('care.clientNoWorkouts')}</Text>
                ) : (
                  <View className="gap-3">
                    {detail.recentWorkouts.map((d) => (
                      <View key={d.day}>
                        <Text {...COMPACT_TEXT} className="text-xs font-bold text-brand">{dayLabel(d.day, todayKey, format.locale)} · {t('care.minShort', { n: d.totalMinutes })}</Text>
                        {d.workouts.map((w) => (
                          <Text key={w.id} {...COMPACT_TEXT} className="mt-0.5 text-sm text-white">
                            {w.title} · {t('care.minShort', { n: w.durationMin })} · {formatTime(new Date(w.startedAt), format)}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <ClientTargetsEditor memberId={id} />

              {/* Plan editor */}
              <View className="mt-7 px-5">
                <Text className="text-xl font-bold text-white">{t('care.clientDietPlan')}</Text>
                <View className="mt-3">
                  <WeekStrip days={week} summary={plan?.week ?? []} selected={day} todayKey={todayKey} locale={format.locale} onSelect={setSelected} />
                </View>
              </View>

              {notice ? (
                <View accessibilityRole="alert" className="mx-5 mt-4 rounded-2xl border border-brand/30 bg-card px-4 py-3">
                  <Text className="text-sm text-white">{notice}</Text>
                </View>
              ) : null}

              <View className="mt-4 gap-4 px-5">
                {items.length === 0 && plan ? (
                  <Text {...COMPACT_TEXT} className="text-sm text-muted">{t('care.clientNothingPlanned', { day: language === 'en' ? dayLabel(day, todayKey, format.locale).toLowerCase() : dayLabel(day, todayKey, format.locale) })}</Text>
                ) : null}
                {SLOT_ORDER.map((s) => {
                  const slotItems = items.filter((i) => i.mealSlot === s);
                  if (!slotItems.length) return null;
                  return (
                    <View key={s}>
                      <Text {...COMPACT_TEXT} className={`mb-2 px-1 text-xs font-bold uppercase text-muted ${language === 'en' ? 'tracking-[1px]' : ''}`}>{t(SLOT_KEY[s])}</Text>
                      <View className="gap-2">
                        {slotItems.map((item) => (
                          <View key={item.id} className="flex-row items-center gap-3 rounded-2xl bg-card p-4">
                            <View className={`h-6 w-6 items-center justify-center rounded-full ${item.done ? 'bg-brand' : 'border-2 border-white/25'}`} accessibilityLabel={item.done ? t('care.clientCompleted') : t('care.clientNotCompleted')}>
                              {item.done ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor="#050a07" size={12} /> : null}
                            </View>
                            <View className="flex-1">
                              <Text {...COMPACT_TEXT} className="text-base font-bold text-white">{item.title}</Text>
                              {item.details ? <Text {...COMPACT_TEXT} className="text-sm text-muted">{item.details}</Text> : null}
                              {item.calories != null ? <Text {...COMPACT_TEXT} className="text-xs text-brand">{item.calories} kcal</Text> : null}
                            </View>
                            <Pressable onPress={() => setToDelete(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('care.clientDeleteItem', { title: item.title })} className="h-10 w-10 items-center justify-center rounded-full active:bg-card-2">
                              <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} tintColor="#8fa396" size={18} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}

                {adding ? (
                  <View className="gap-4 rounded-3xl border border-white/5 bg-card p-5">
                    <Text className="text-base font-bold text-white">{t('care.clientAddTo', { day: dayLabel(day, todayKey, format.locale) })}</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {SLOT_ORDER.map((s) => (
                        <Pressable key={s} onPress={() => setSlot(s)} accessibilityRole="button" accessibilityState={{ selected: slot === s }} className={`rounded-full px-4 py-2 ${slot === s ? 'bg-brand' : 'bg-card-2'}`}>
                          <Text {...COMPACT_TEXT} className={`text-xs font-bold ${slot === s ? 'text-ink' : 'text-muted'}`}>{t(SLOT_KEY[s])}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {[
                      { label: t('care.clientWhatToEat'), value: title, set: setTitle, ph: t('care.clientExampleFood'), max: 100, multiline: false, kb: 'default' as const },
                      { label: t('care.clientDetails'), value: details, set: setDetails, ph: t('care.clientExampleDetails'), max: 300, multiline: true, kb: 'default' as const },
                      { label: t('care.clientCalories'), value: calories, set: (typed: string) => setCalories(typed.replace(/\D/g, '')), ph: t('care.clientExampleCalories'), max: 4, multiline: false, kb: 'number-pad' as const },
                    ].map((f) => (
                      <View key={f.label}>
                        <Text {...COMPACT_TEXT} className="mb-1.5 text-sm font-semibold text-white">{f.label}</Text>
                        <TextInput
                          value={f.value}
                          onChangeText={f.set}
                          placeholder={f.ph}
                          placeholderTextColor="#6f8577"
                          selectionColor={BRAND}
                          cursorColor={BRAND}
                          maxLength={f.max}
                          multiline={f.multiline}
                          keyboardType={f.kb}
                          accessibilityLabel={f.label}
                          style={{ minHeight: f.multiline ? 72 : 48, textAlignVertical: f.multiline ? 'top' : 'center', paddingVertical: f.multiline ? 10 : 0 }}
                          className="rounded-2xl border border-white/10 bg-card-2 px-4 text-base text-white"
                        />
                      </View>
                    ))}
                    <View className="flex-row gap-3">
                      <Pressable onPress={() => { setAdding(false); setNotice(null); }} disabled={busy} accessibilityRole="button" className="flex-1 items-center rounded-full border border-white/15 py-3 active:opacity-70">
                        <Text className="text-center font-bold text-white">{t('common.cancel')}</Text>
                      </Pressable>
                      <Pressable onPress={save} disabled={busy} accessibilityRole="button" className="flex-1 items-center rounded-full bg-brand py-3 active:opacity-80">
                        {busy ? <ActivityIndicator color="#050a07" /> : <Text className="text-center font-bold text-ink">{t('care.clientAddToPlan')}</Text>}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row gap-3">
                    <Pressable onPress={() => { setAdding(true); setNotice(null); }} accessibilityRole="button" className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-brand py-3.5 active:opacity-80">
                      <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor="#050a07" size={16} />
                      <Text {...COMPACT_TEXT} className="shrink text-center font-bold text-ink">{t('care.clientAddItem')}</Text>
                    </Pressable>
                    <Pressable onPress={copyYesterday} disabled={busy} accessibilityRole="button" className="flex-1 items-center justify-center rounded-full border border-white/15 bg-card py-3.5 active:opacity-70">
                      <Text {...COMPACT_TEXT} className="px-2 text-center font-bold text-white">{t('care.clientCopyPrevious')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              <ClientTrainingEditor key={`${id}:${day}`} memberId={id} day={day} />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmSheet
        visible={toDelete !== null}
        title={t('care.clientRemoveQ')}
        message={toDelete ? t('care.clientRemoveMsg', { title: toDelete.title }) : ''}
        confirmLabel={t('meal.remove')}
        destructive
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
      <PauseSheet
        key={String(pauseOpen)}
        visible={pauseOpen}
        title={t('care.clientPauseTitle')}
        message={t('care.clientPauseMsg')}
        busy={safetyBusy}
        error={safetyError}
        onSubmit={(reason: PauseReason, note: string) => safety(() => pauseClient(id, reason, note))}
        onClose={() => setPauseOpen(false)}
      />
      <ConfirmSheet
        visible={resumeOpen}
        title={t('care.clientRestartQ')}
        message={t('care.clientRestartMsg')}
        confirmLabel={t('care.clientRestartPlan')}
        busy={safetyBusy}
        onConfirm={() => safety(() => resumeClient(id))}
        onCancel={() => setResumeOpen(false)}
      />
    </View>
  );
}
