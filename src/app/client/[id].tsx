import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { WeekStrip } from '@/components/week-strip';
import { WeightBars } from '@/components/weight-bars';
import { useDeviceClock } from '@/hooks/use-device-clock';
import {
  ACTIVITY_LABEL,
  bmi,
  bmiCategory,
  DIET_LABEL,
  fmtKg,
  GOAL_LABEL,
  goalProgress,
  goalRemaining,
  SEX_LABEL,
} from '@/lib/body';
import { addDays, dayLabel, formatTime, getWeekDays, getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import {
  addPlanItem,
  copyPlanDay,
  getClient,
  getClientPlan,
  removePlanItem,
  SLOT_LABEL,
  SLOT_ORDER,
  type ClientDetail,
  type DietItem,
  type MealSlot,
  type PlanDay,
} from '@/lib/wellness-api';

const BRAND = '#c6f432';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[46%] flex-1 rounded-2xl bg-card-2 p-3">
      <Text {...COMPACT_TEXT} className="text-[11px] uppercase tracking-wider text-muted">{label}</Text>
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

  const todayParts = getZonedParts(now, format.timeZone);
  const todayKey = toDayKey(todayParts);
  const week = getWeekDays(todayParts, firstWeekday);
  const weekStart = toDayKey(week[0]);

  const [detail, setDetail] = useState<ClientDetail | null>(null);
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
    const t = title.trim();
    if (!t) return setNotice('Give the item a title, for example "Oats with fruit".');
    const kcal = calories.trim() ? Number(calories) : undefined;
    if (kcal !== undefined && (!Number.isInteger(kcal) || kcal < 0 || kcal > 3000)) return setNotice('Calories must be a whole number from 0 to 3000.');
    setBusy(true);
    setNotice(null);
    try {
      await addPlanItem(id, { day, mealSlot: slot, title: t, details: details.trim() || undefined, calories: kcal });
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
      setNotice(`Copied ${res.copied} item${res.copied === 1 ? '' : 's'} from ${dayLabel(from, todayKey, format.locale)}.`);
      await loadPlan();
    } catch (e) {
      setNotice(messageFrom(e));
    } finally {
      setBusy(false);
    }
  };

  const p = detail?.profile;
  const progress = p ? goalProgress(p.goal, p.startWeightKg, p.weightKg, p.targetWeightKg) : 0;
  const band = p ? bmiCategory(bmi(p.weightKg, p.heightCm)) : null;
  const items = plan?.items ?? [];
  const adherence = detail?.adherence;
  const name = detail?.client.name || detail?.client.email || 'Client';

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: 840, alignSelf: 'center' }}>
          <View className="flex-row items-center gap-3 px-5">
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" className="h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-70">
              <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
            </Pressable>
            <Text className="flex-1 text-2xl font-bold text-white" numberOfLines={1}>{name}</Text>
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
                    <Text {...COMPACT_TEXT} className="text-sm text-brand">{GOAL_LABEL[p.goal]} · {goalRemaining(p.goal, p.weightKg, p.targetWeightKg)}</Text>
                  </View>
                </View>
                <View className="mt-4 flex-row items-end justify-between">
                  <View><Text {...COMPACT_TEXT} className="text-[11px] text-muted">Start</Text><Text {...COMPACT_TEXT} className="text-base font-bold text-white">{fmtKg(p.startWeightKg)}</Text></View>
                  <View className="items-center"><Text {...COMPACT_TEXT} className="text-[11px] text-muted">Now</Text><Text {...COMPACT_TEXT} className="text-2xl font-bold text-brand">{fmtKg(p.weightKg)}</Text></View>
                  <View className="items-end"><Text {...COMPACT_TEXT} className="text-[11px] text-muted">Target</Text><Text {...COMPACT_TEXT} className="text-base font-bold text-white">{fmtKg(p.targetWeightKg)}</Text></View>
                </View>
                <View className="mt-3 overflow-hidden rounded-full bg-card-2" style={{ height: 8 }}>
                  <View className="rounded-full bg-brand" style={{ height: 8, width: `${Math.round(progress * 100)}%` }} />
                </View>
                <View className="mt-4 flex-row flex-wrap gap-2">
                  <Fact label="Age / sex" value={`${p.age} · ${SEX_LABEL[p.sex]}`} />
                  <Fact label="Height" value={`${parseFloat(p.heightCm.toFixed(1))} cm`} />
                  <Fact label="BMI" value={`${bmi(p.weightKg, p.heightCm)} · ${band?.label}`} />
                  <Fact label="Food" value={DIET_LABEL[p.dietType]} />
                  <Fact label="Activity" value={ACTIVITY_LABEL[p.activityLevel].title} />
                  <Fact label="Plan, last 7 days" value={adherence && adherence.planned ? `${adherence.done} of ${adherence.planned} done` : 'No plan yet'} />
                </View>
                <View className="mt-3 gap-2">
                  <View className="rounded-2xl bg-card-2 p-3">
                    <Text {...COMPACT_TEXT} className="text-[11px] uppercase tracking-wider text-muted">Allergies</Text>
                    <Text {...COMPACT_TEXT} className="mt-0.5 text-sm text-white">{p.allergies || 'None added'}</Text>
                  </View>
                  <View className="rounded-2xl bg-card-2 p-3">
                    <Text {...COMPACT_TEXT} className="text-[11px] uppercase tracking-wider text-muted">Medical notes</Text>
                    <Text {...COMPACT_TEXT} className="mt-0.5 text-sm text-white">{p.medicalNotes || 'None added'}</Text>
                  </View>
                </View>
              </View>

              <View className="mx-5 mt-5 rounded-3xl border border-white/5 bg-card p-5">
                <Text className="mb-4 text-base font-bold text-white">Weight progress</Text>
                <WeightBars history={detail.weightHistory} />
              </View>

              <View className="mx-5 mt-5 rounded-3xl border border-white/5 bg-card p-5">
                <Text className="mb-3 text-base font-bold text-white">Recent workouts</Text>
                {detail.recentWorkouts.length === 0 ? (
                  <Text {...COMPACT_TEXT} className="text-sm text-muted">No workouts logged yet.</Text>
                ) : (
                  <View className="gap-3">
                    {detail.recentWorkouts.map((d) => (
                      <View key={d.day}>
                        <Text {...COMPACT_TEXT} className="text-xs font-bold text-brand">{dayLabel(d.day, todayKey, format.locale)} · {d.totalMinutes} min</Text>
                        {d.workouts.map((w) => (
                          <Text key={w.id} {...COMPACT_TEXT} className="mt-0.5 text-sm text-white">
                            {w.title} · {w.durationMin} min · {formatTime(new Date(w.startedAt), format)}
                          </Text>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Plan editor */}
              <View className="mt-7 px-5">
                <Text className="text-xl font-bold text-white">Diet plan</Text>
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
                  <Text {...COMPACT_TEXT} className="text-sm text-muted">Nothing planned for {dayLabel(day, todayKey, format.locale).toLowerCase()} yet.</Text>
                ) : null}
                {SLOT_ORDER.map((s) => {
                  const slotItems = items.filter((i) => i.mealSlot === s);
                  if (!slotItems.length) return null;
                  return (
                    <View key={s}>
                      <Text {...COMPACT_TEXT} className="mb-2 px-1 text-xs font-bold uppercase tracking-[1px] text-muted">{SLOT_LABEL[s]}</Text>
                      <View className="gap-2">
                        {slotItems.map((item) => (
                          <View key={item.id} className="flex-row items-center gap-3 rounded-2xl bg-card p-4">
                            <View className={`h-6 w-6 items-center justify-center rounded-full ${item.done ? 'bg-brand' : 'border-2 border-white/25'}`} accessibilityLabel={item.done ? 'Completed by the member' : 'Not completed yet'}>
                              {item.done ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor="#0b0b0d" size={12} /> : null}
                            </View>
                            <View className="flex-1">
                              <Text {...COMPACT_TEXT} className="text-base font-bold text-white">{item.title}</Text>
                              {item.details ? <Text {...COMPACT_TEXT} className="text-sm text-muted">{item.details}</Text> : null}
                              {item.calories != null ? <Text {...COMPACT_TEXT} className="text-xs text-brand">{item.calories} kcal</Text> : null}
                            </View>
                            <Pressable onPress={() => setToDelete(item)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`} className="h-10 w-10 items-center justify-center rounded-full active:bg-card-2">
                              <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} tintColor="#8b8b94" size={18} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}

                {adding ? (
                  <View className="gap-4 rounded-3xl border border-white/5 bg-card p-5">
                    <Text className="text-base font-bold text-white">Add to {dayLabel(day, todayKey, format.locale)}</Text>
                    <View className="flex-row flex-wrap gap-2">
                      {SLOT_ORDER.map((s) => (
                        <Pressable key={s} onPress={() => setSlot(s)} accessibilityRole="button" accessibilityState={{ selected: slot === s }} className={`rounded-full px-4 py-2 ${slot === s ? 'bg-brand' : 'bg-card-2'}`}>
                          <Text {...COMPACT_TEXT} className={`text-xs font-bold ${slot === s ? 'text-ink' : 'text-muted'}`}>{SLOT_LABEL[s]}</Text>
                        </Pressable>
                      ))}
                    </View>
                    {[
                      { label: 'What to eat', value: title, set: setTitle, ph: 'e.g. Oats with fruit', max: 100, multiline: false, kb: 'default' as const },
                      { label: 'Details (optional)', value: details, set: setDetails, ph: 'Quantity, how to cook, notes', max: 300, multiline: true, kb: 'default' as const },
                      { label: 'Calories (optional)', value: calories, set: (t: string) => setCalories(t.replace(/\D/g, '')), ph: 'e.g. 320', max: 4, multiline: false, kb: 'number-pad' as const },
                    ].map((f) => (
                      <View key={f.label}>
                        <Text {...COMPACT_TEXT} className="mb-1.5 text-sm font-semibold text-white">{f.label}</Text>
                        <TextInput
                          value={f.value}
                          onChangeText={f.set}
                          placeholder={f.ph}
                          placeholderTextColor="#7c8592"
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
                        <Text className="font-bold text-white">Cancel</Text>
                      </Pressable>
                      <Pressable onPress={save} disabled={busy} accessibilityRole="button" className="flex-1 items-center rounded-full bg-brand py-3 active:opacity-80">
                        {busy ? <ActivityIndicator color="#0b0b0d" /> : <Text className="font-bold text-ink">Add to plan</Text>}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View className="flex-row gap-3">
                    <Pressable onPress={() => { setAdding(true); setNotice(null); }} accessibilityRole="button" className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-brand py-3.5 active:opacity-80">
                      <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor="#0b0b0d" size={16} />
                      <Text {...COMPACT_TEXT} className="font-bold text-ink">Add item</Text>
                    </Pressable>
                    <Pressable onPress={copyYesterday} disabled={busy} accessibilityRole="button" className="flex-1 items-center justify-center rounded-full border border-white/15 bg-card py-3.5 active:opacity-70">
                      <Text {...COMPACT_TEXT} className="font-bold text-white">Copy previous day</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmSheet
        visible={toDelete !== null}
        title="Remove this item?"
        message={toDelete ? `"${toDelete.title}" will be removed from the plan.` : ''}
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={remove}
        onCancel={() => setToDelete(null)}
      />
    </View>
  );
}
