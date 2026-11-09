import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeviceClock } from '@/hooks/use-device-clock';
import {
  ACTIVITY_LABEL,
  ageOn,
  DIET_LABEL,
  fmtKg,
  GOAL_LABEL,
  parseDecimal,
  SEX_LABEL,
  toBirthDate,
  type Activity,
  type DietType,
  type Goal,
  type Sex,
} from '@/lib/body';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import type { BodyProfile } from '@/lib/wellness-api';
import { useProfile } from '@/providers/profile-provider';

const BRAND = '#c6f432';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

const GOAL_CARDS: { goal: Goal; emoji: string; hint: string }[] = [
  { goal: 'lose', emoji: '🔥', hint: 'Burn fat and get lighter' },
  { goal: 'maintain', emoji: '⚖️', hint: 'Stay where I am and get fitter' },
  { goal: 'gain', emoji: '💪', hint: 'Build muscle and weight' },
];

type Form = {
  goal: Goal | null;
  sex: Sex | null;
  day: string;
  month: string;
  year: string;
  height: string;
  weight: string;
  target: string;
  activity: Activity | null;
  diet: DietType | null;
  allergies: string;
  medical: string;
  share: boolean;
};

const STEPS = ['Your goal', 'About you', 'Your weight', 'Lifestyle', 'Health & privacy'] as const;

function initialForm(p: BodyProfile | null): Form {
  if (!p) {
    return { goal: null, sex: null, day: '', month: '', year: '', height: '', weight: '', target: '', activity: null, diet: null, allergies: '', medical: '', share: false };
  }
  const [year, month, day] = p.birthDate.split('-');
  return {
    goal: p.goal,
    sex: p.sex,
    day: String(Number(day)),
    month: String(Number(month)),
    year,
    height: String(p.heightCm),
    weight: String(p.weightKg),
    target: String(p.targetWeightKg),
    activity: p.activityLevel,
    diet: p.dietType,
    allergies: p.allergies ?? '',
    medical: p.medicalNotes ?? '',
    share: p.shareWithDietitian,
  };
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  suffix,
  multiline,
  maxLength,
  flex,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  suffix?: string;
  multiline?: boolean;
  maxLength?: number;
  flex?: boolean;
}) {
  return (
    <View className={flex ? 'flex-1' : ''}>
      <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">
        {label}
      </Text>
      <View className="flex-row items-center rounded-2xl border border-white/10 bg-card px-4">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#7c8592"
          selectionColor={BRAND}
          cursorColor={BRAND}
          keyboardType={keyboardType}
          multiline={multiline}
          maxLength={maxLength}
          maxFontSizeMultiplier={1.4}
          accessibilityLabel={label}
          style={{ minHeight: multiline ? 84 : 52, textAlignVertical: multiline ? 'top' : 'center', paddingVertical: multiline ? 12 : 0 }}
          className="flex-1 text-base text-white"
        />
        {suffix ? (
          <Text {...COMPACT_TEXT} className="ml-2 text-sm text-muted">
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={`rounded-full px-5 py-2.5 ${selected ? 'bg-brand' : 'bg-card'}`}>
      <Text {...COMPACT_TEXT} className={`text-sm font-semibold ${selected ? 'text-ink' : 'text-muted'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

function Title({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <View className="mb-5">
      <Text {...COMPACT_TEXT} className="text-3xl font-bold leading-9 text-white">
        {children}
      </Text>
      {hint ? (
        <Text {...COMPACT_TEXT} className="mt-2 text-sm leading-5 text-muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The questions a dietitian needs. `setup` asks them one screen at a time right after the first
 * login; `edit` shows them all on one page for changing later.
 */
export function ProfileForm({ mode, onDone }: { mode: 'setup' | 'edit'; onDone?: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { format } = useDeviceClock();
  const { profile, save } = useProfile();

  const [form, setForm] = useState<Form>(() => initialForm(profile));
  const [step, setStep] = useState(0);
  const [openSection, setOpenSection] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  };
  const todayKey = () => toDayKey(getZonedParts(new Date(), format.timeZone));

  /** Returns a sentence for the first problem in a section, or null when it is fine. */
  const problemIn = (section: number): string | null => {
    if (section === 0 && !form.goal) return 'Choose what you want to achieve.';
    if (section === 1) {
      if (!form.sex) return 'Choose your sex.';
      const birth = toBirthDate(form.day, form.month, form.year);
      if (!birth) return 'Enter your date of birth as day, month and a 4-digit year.';
      const age = ageOn(birth, todayKey());
      if (age < 12 || age > 100) return 'Age must be between 12 and 100.';
      const height = parseDecimal(form.height);
      if (height == null || height < 100 || height > 250) return 'Enter your height in cm (100 to 250).';
    }
    if (section === 2) {
      const weight = parseDecimal(form.weight);
      const target = parseDecimal(form.target);
      if (weight == null || weight < 25 || weight > 300) return 'Enter your current weight in kg (25 to 300).';
      if (target == null || target < 25 || target > 300) return 'Enter your target weight in kg (25 to 300).';
      if (form.goal === 'lose' && target >= weight) return 'To lose weight, your target must be lower than your current weight.';
      if (form.goal === 'gain' && target <= weight) return 'To gain weight, your target must be higher than your current weight.';
      if (form.goal === 'maintain' && Math.abs(target - weight) > 5) return 'To stay at your weight, keep your target within 5 kg of it.';
    }
    if (section === 3) {
      if (!form.activity) return 'Choose how active you are.';
      if (!form.diet) return 'Choose your food preference.';
    }
    return null;
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length; i += 1) {
      const problem = problemIn(i);
      if (problem) {
        setError(problem);
        if (mode === 'setup') setStep(i);
        else setOpenSection(i);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await save({
        goal: form.goal!,
        sex: form.sex!,
        birthDate: toBirthDate(form.day, form.month, form.year)!,
        heightCm: parseDecimal(form.height)!,
        weightKg: parseDecimal(form.weight)!,
        targetWeightKg: parseDecimal(form.target)!,
        activityLevel: form.activity!,
        dietType: form.diet!,
        allergies: form.allergies.trim() || null,
        medicalNotes: form.medical.trim() || null,
        shareWithDietitian: form.share,
        day: todayKey(),
      });
      // Setup: the app switches to the main screens by itself. Edit: go back.
      onDone?.();
    } catch (e) {
      setError(messageFrom(e));
      setBusy(false);
    }
  };

  const next = () => {
    const problem = problemIn(step);
    if (problem) return setError(problem);
    setError(null);
    setStep((s) => s + 1);
  };

  const weight = parseDecimal(form.weight);
  const target = parseDecimal(form.target);
  const delta = weight != null && target != null ? Math.abs(weight - target) : null;

  const sections: ReactNode[] = [
    // 0 goal
    <View key="goal">
      <Title hint="This helps your dietitian plan the right meals for you.">What do you want to achieve?</Title>
      <View className="gap-3">
        {GOAL_CARDS.map((c) => {
          const selected = form.goal === c.goal;
          return (
            <Pressable
              key={c.goal}
              onPress={() => set('goal', c.goal)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`flex-row items-center gap-4 rounded-3xl border-2 p-5 ${selected ? 'border-brand bg-card' : 'border-transparent bg-card'}`}>
              <Text style={{ fontSize: 30 }}>{c.emoji}</Text>
              <View className="flex-1">
                <Text {...COMPACT_TEXT} className="text-lg font-bold text-white">
                  {GOAL_LABEL[c.goal]}
                </Text>
                <Text {...COMPACT_TEXT} className="text-sm text-muted">
                  {c.hint}
                </Text>
              </View>
              {selected ? <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} tintColor={BRAND} size={24} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>,
    // 1 about you
    <View key="about" className="gap-5">
      <Title hint="Your dietitian uses this to work out how much you need to eat.">Tell us about you</Title>
      <View>
        <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">Sex</Text>
        <View className="flex-row flex-wrap gap-2">
          {(Object.keys(SEX_LABEL) as Sex[]).map((s) => (
            <Chip key={s} label={SEX_LABEL[s]} selected={form.sex === s} onPress={() => set('sex', s)} />
          ))}
        </View>
      </View>
      <View>
        <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">Date of birth</Text>
        <View className="flex-row gap-3">
          <Field flex label="Day" value={form.day} onChangeText={(t) => set('day', t.replace(/\D/g, '').slice(0, 2))} placeholder="DD" keyboardType="number-pad" />
          <Field flex label="Month" value={form.month} onChangeText={(t) => set('month', t.replace(/\D/g, '').slice(0, 2))} placeholder="MM" keyboardType="number-pad" />
          <Field flex label="Year" value={form.year} onChangeText={(t) => set('year', t.replace(/\D/g, '').slice(0, 4))} placeholder="YYYY" keyboardType="number-pad" />
        </View>
      </View>
      <Field label="Height" value={form.height} onChangeText={(t) => set('height', t)} placeholder="e.g. 172" keyboardType="decimal-pad" suffix="cm" />
    </View>,
    // 2 weight
    <View key="weight" className="gap-5">
      <Title hint="Be honest: this is just between you and your dietitian.">Your weight</Title>
      <Field label="Current weight" value={form.weight} onChangeText={(t) => set('weight', t)} placeholder="e.g. 82.5" keyboardType="decimal-pad" suffix="kg" />
      <Field label="Target weight" value={form.target} onChangeText={(t) => set('target', t)} placeholder="e.g. 75" keyboardType="decimal-pad" suffix="kg" />
      {delta != null && delta > 0 && form.goal && form.goal !== 'maintain' ? (
        <View className="rounded-2xl bg-card p-4">
          <Text {...COMPACT_TEXT} className="text-sm text-white">
            You want to {form.goal === 'lose' ? 'lose' : 'gain'} <Text className="font-bold text-brand">{fmtKg(delta)}</Text>.
          </Text>
        </View>
      ) : null}
    </View>,
    // 3 lifestyle
    <View key="life" className="gap-5">
      <Title hint="So the plan fits your day and your food.">Your lifestyle</Title>
      <View className="gap-2">
        <Text {...COMPACT_TEXT} className="text-sm font-semibold text-white">How active are you?</Text>
        {(Object.keys(ACTIVITY_LABEL) as Activity[]).map((a) => {
          const selected = form.activity === a;
          return (
            <Pressable
              key={a}
              onPress={() => set('activity', a)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className={`flex-row items-center gap-3 rounded-2xl border-2 px-4 py-3 ${selected ? 'border-brand bg-card' : 'border-transparent bg-card'}`}>
              <View className="flex-1">
                <Text {...COMPACT_TEXT} className="text-base font-bold text-white">{ACTIVITY_LABEL[a].title}</Text>
                <Text {...COMPACT_TEXT} className="text-xs text-muted">{ACTIVITY_LABEL[a].hint}</Text>
              </View>
              {selected ? <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} tintColor={BRAND} size={22} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View>
        <Text {...COMPACT_TEXT} className="mb-2 text-sm font-semibold text-white">What do you eat?</Text>
        <View className="flex-row flex-wrap gap-2">
          {(Object.keys(DIET_LABEL) as DietType[]).map((d) => (
            <Chip key={d} label={DIET_LABEL[d]} selected={form.diet === d} onPress={() => set('diet', d)} />
          ))}
        </View>
      </View>
    </View>,
    // 4 health + consent
    <View key="health" className="gap-5">
      <Title hint="Optional, but it helps your dietitian keep your plan safe.">Health and privacy</Title>
      <Field label="Food allergies or foods to avoid" value={form.allergies} onChangeText={(t) => set('allergies', t)} placeholder="e.g. peanuts, lactose" multiline maxLength={300} />
      <Field label="Medical conditions or medicines" value={form.medical} onChangeText={(t) => set('medical', t)} placeholder="e.g. diabetes, thyroid, BP" multiline maxLength={500} />
      <View className="flex-row items-center gap-4 rounded-3xl border border-white/5 bg-card p-5">
        <View className="flex-1">
          <Text {...COMPACT_TEXT} className="text-base font-bold text-white">Share with my dietitian</Text>
          <Text {...COMPACT_TEXT} className="mt-1 text-xs leading-4 text-muted">
            Your dietitian can see these answers, your weight and your workouts, and post a diet plan for you. You can switch this off any time in your profile.
          </Text>
        </View>
        <Switch
          value={form.share}
          onValueChange={(v) => set('share', v)}
          trackColor={{ false: '#3a3a42', true: BRAND }}
          thumbColor="#ffffff"
          accessibilityLabel="Share with my dietitian"
        />
      </View>
    </View>,
  ];

  const lastStep = step === STEPS.length - 1;

  return (
    <View className="flex-1 bg-ink">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: mode === 'setup' ? 16 : insets.top + 16, paddingBottom: 24, paddingHorizontal: 20, flexGrow: 1, width: '100%', maxWidth: 840, alignSelf: 'center' }}>
          {mode === 'setup' ? (
            <View className="mb-6">
              <View className="flex-row items-center justify-between">
                <Text {...COMPACT_TEXT} className="text-xs font-bold uppercase tracking-[1px] text-brand">
                  Step {step + 1} of {STEPS.length}
                </Text>
                <Text {...COMPACT_TEXT} className="text-xs text-muted">{STEPS[step]}</Text>
              </View>
              <View className="mt-3 flex-row gap-1.5">
                {STEPS.map((name, i) => (
                  <View key={name} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-brand' : 'bg-card-2'}`} />
                ))}
              </View>
            </View>
          ) : (
            <View className="mb-4 flex-row items-center gap-3">
              <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" className="h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-70">
                <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
              </Pressable>
              <Text className="text-[28px] font-bold tracking-tight text-white">Your fitness profile</Text>
            </View>
          )}

          {mode === 'setup' ? sections[step] : <>
            <Text className="mb-6 text-sm leading-6 text-muted">Open a section to update your details. These help personalize your progress and diet plan.</Text>
            <View className="gap-3">
              {sections.map((section, i) => (
                <View key={STEPS[i]} className="overflow-hidden rounded-3xl border border-white/5 bg-card">
                  <Pressable onPress={() => setOpenSection((current) => current === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: openSection === i }} className="flex-row items-center justify-between gap-3 p-5">
                    <View className="flex-row items-center gap-3">
                      <View className={`h-8 w-8 items-center justify-center rounded-full ${openSection === i ? 'bg-brand/10' : 'bg-card-2'}`}>
                        <Text className={`text-xs font-semibold ${openSection === i ? 'text-brand' : 'text-muted'}`}>{i + 1}</Text>
                      </View>
                      <Text className="text-base font-semibold text-white">{STEPS[i]}</Text>
                    </View>
                    <SymbolView name={openSection === i ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} tintColor="#9ba2ac" size={16} />
                  </Pressable>
                  {openSection === i ? <View className="border-t border-white/5 p-5">{section}</View> : null}
                </View>
              ))}
            </View>
          </>}

          {error ? (
            <View accessibilityRole="alert" className="mt-5 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
              <Text className="text-sm text-white">{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View className="w-full max-w-[840px] self-center flex-row gap-3 border-t border-white/5 bg-ink px-5" style={{ paddingBottom: insets.bottom + 16, paddingTop: 8 }}>
          {mode === 'setup' && step > 0 ? (
            <Pressable
              onPress={() => { setError(null); setStep((s) => s - 1); }}
              disabled={busy}
              accessibilityRole="button"
              className="items-center rounded-full border border-white/15 bg-card px-7 py-4 active:opacity-70">
              <Text {...COMPACT_TEXT} className="text-base font-bold text-white">Back</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={mode === 'setup' && !lastStep ? next : submit}
            disabled={busy}
            accessibilityRole="button"
            className="flex-1 items-center rounded-full bg-brand py-4 active:opacity-80">
            {busy ? (
              <ActivityIndicator color="#0b0b0d" />
            ) : (
              <Text {...COMPACT_TEXT} className="text-base font-bold text-ink">
                {mode === 'setup' ? (lastStep ? 'Save profile' : 'Continue') : 'Save changes'}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
