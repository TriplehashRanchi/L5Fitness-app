import { PageHeading } from '@/components/page-heading';
import { DisplayText } from '@/components/display-text';
import { GreenBackground } from '@/components/green-background';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { WeightBars } from '@/components/weight-bars';
import { BottomTabInset } from '@/constants/theme';
import { useDeviceClock } from '@/hooks/use-device-clock';
import {
  ACTIVITY_LABEL,
  bmi,
  bmiCategory,
  DIET_LABEL,
  fmtKg,
  goalProgress,
  goalRemaining,
  GOAL_LABEL,
  parseDecimal,
  SEX_LABEL,
} from '@/lib/body';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/providers/profile-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const WEB_TOP_BAR = 72;
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[46%] flex-1 rounded-2xl border border-white/5 bg-card p-4">
      <Text {...COMPACT_TEXT} className="text-[11px] font-bold uppercase tracking-wider text-muted">
        {label}
      </Text>
      <Text {...COMPACT_TEXT} className="mt-1 text-base font-bold text-white">
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { format } = useDeviceClock();
  const { session } = useAuth();
  const { profile, role, weightHistory, logWeight } = useProfile();
  const user = session?.user;

  const [sheet, setSheet] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWeb = Platform.OS === 'web';

  const saveWeight = async () => {
    const kg = parseDecimal(text);
    if (kg == null || kg < 25 || kg > 300) return setError('Enter your weight in kg (25 to 300).');
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

  // Calculate total change since start
  const totalChangeKg = profile ? parseFloat((profile.weightKg - profile.startWeightKg).toFixed(1)) : 0;
  const changeLabel =
    totalChangeKg === 0
      ? 'No change yet'
      : totalChangeKg < 0
        ? `${Math.abs(totalChangeKg)} kg lost`
        : `+${totalChangeKg} kg gained`;

  // Quick adjust weight in modal
  const adjustWeight = (delta: number) => {
    const current = parseDecimal(text) ?? (profile ? profile.weightKg : 70);
    const updated = Math.max(25, Math.min(300, parseFloat((current + delta).toFixed(1))));
    setText(String(updated));
  };

  return (
    <View className="flex-1 bg-ink">
      <GreenBackground />
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + (isWeb ? WEB_TOP_BAR : 20),
          width: '100%',
          maxWidth: 840,
          alignSelf: 'center',
          paddingBottom: insets.bottom + (isWeb ? 0 : BottomTabInset) + 24,
        }}>
        {/* Header with Settings shortcut */}
        <PageHeading
          title="Your profile"
          subtitle="Your progress, at a glance."
          action={
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              className="h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-card active:opacity-70">
              <SymbolView
                name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
                tintColor="white"
                size={18}
              />
            </Pressable>
          }
        />

        {/* Athlete ID / Gym Pass Header Card */}
        <View className="mx-5 mt-4 overflow-hidden rounded-3xl border border-white/10 bg-card p-5">
          <View className="flex-row items-center gap-4">
            <View className="rounded-2xl border-2 border-brand/50 p-0.5">
              <Avatar name={user?.name ?? 'Athlete'} image={user?.image} size={70} />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-black text-white" numberOfLines={1}>
                {user?.name}
              </Text>
              <Text {...COMPACT_TEXT} className="text-xs text-muted" numberOfLines={1}>
                {user?.email}
              </Text>

              <View className="mt-2.5 flex-row flex-wrap items-center gap-2">
                <View className="self-start rounded-full bg-brand px-3 py-1">
                  <Text {...COMPACT_TEXT} className="text-[10px] font-black uppercase tracking-wider text-ink">
                    {role === 'admin' ? 'Admin' : role === 'dietitian' ? 'Dietitian' : 'L5 Athlete'}
                  </Text>
                </View>
                {profile ? (
                  <View className="rounded-full bg-card-2 border border-white/5 px-2.5 py-1">
                    <Text {...COMPACT_TEXT} className="text-[10px] font-bold text-muted">
                      {GOAL_LABEL[profile.goal]}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        {profile ? (
          <>
            {/* Body Transformation Hub: Start vs Now vs Target */}
            <View className="mx-5 mt-5 rounded-3xl border border-white/5 bg-card p-5">
              <View className="flex-row items-center justify-between border-b border-white/5 pb-3">
                <View className="flex-row items-center gap-2">
                  <SymbolView name={{ ios: 'scalemass.fill', android: 'scale', web: 'scale' }} tintColor={BRAND} size={16} />
                  <Text className="text-sm font-semibold tracking-wide text-white">
                    Weight Goal
                  </Text>
                </View>
                <View className="rounded-full bg-brand/15 px-3 py-1">
                  <Text {...COMPACT_TEXT} className="text-xs font-semibold text-brand">
                    {changeLabel}
                  </Text>
                </View>
              </View>

              {/* 3 Columns: Start, Now, Target */}
              <View className="mt-4 flex-row items-end justify-between">
                <View>
                  <Text {...COMPACT_TEXT} className="text-[11px] font-semibold text-muted">
                    Start
                  </Text>
                  <Text {...COMPACT_TEXT} className="mt-1 text-base font-bold text-white">
                    {fmtKg(profile.startWeightKg)}
                  </Text>
                </View>

                <View className="items-center">
                  <Text {...COMPACT_TEXT} className="text-[11px] font-semibold text-brand">
                    Current
                  </Text>
                  <DisplayText
                    {...COMPACT_TEXT}
                    style={{ fontSize: 32, lineHeight: 36 }}
                    className="font-black text-brand">
                    {fmtKg(profile.weightKg)}
                  </DisplayText>
                </View>

                <View className="items-end">
                  <Text {...COMPACT_TEXT} className="text-[11px] font-semibold text-muted">
                    Target
                  </Text>
                  <Text {...COMPACT_TEXT} className="mt-1 text-base font-bold text-white">
                    {fmtKg(profile.targetWeightKg)}
                  </Text>
                </View>
              </View>

              {/* Progress Track */}
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
                className="mt-5 overflow-hidden rounded-full bg-card-2"
                style={{ height: 8 }}>
                <View
                  className="rounded-full bg-brand"
                  style={{ height: 8, width: `${Math.max(5, Math.min(100, Math.round(progress * 100)))}%` }}
                />
              </View>

              <View className="mt-2 flex-row items-center justify-between">
                <Text {...COMPACT_TEXT} className="text-xs font-semibold text-muted">
                  {Math.round(progress * 100)}% of goal reached
                </Text>
                <Text {...COMPACT_TEXT} className="text-xs font-semibold text-brand">
                  {goalRemaining(profile.goal, profile.weightKg, profile.targetWeightKg)}
                </Text>
              </View>

              {/* Primary Action Button */}
              <Pressable
                onPress={() => {
                  setError(null);
                  setText(String(profile.weightKg));
                  setSheet(true);
                }}
                accessibilityRole="button"
                className="mt-5 flex-row items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 active:opacity-80">
                <SymbolView
                  name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }}
                  tintColor={INK}
                  size={16}
                />
                <Text {...COMPACT_TEXT} className="text-sm font-black text-ink">
                  Log Today&apos;s Weight
                </Text>
              </Pressable>
            </View>

            {/* Weight History Chart */}
            <View className="mx-5 mt-5 rounded-3xl border border-white/5 bg-card p-5">
              <View className="mb-4 flex-row items-center justify-between">
                <View>
                  <Text className="text-base font-bold text-white">Weight History</Text>
                  <Text {...COMPACT_TEXT} className="text-xs text-muted">
                    Recent weigh-ins progression
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setError(null);
                    setText(String(profile.weightKg));
                    setSheet(true);
                  }}
                  className="rounded-full bg-card-2 px-3 py-1.5 active:opacity-70">
                  <Text {...COMPACT_TEXT} className="text-xs font-bold text-brand">
                    + Log
                  </Text>
                </Pressable>
              </View>
              <WeightBars history={weightHistory} />
            </View>

            {/* Body Mass Index (BMI) & Athletic Assessment */}
            {bmiValue != null && band ? (
              <View className="mx-5 mt-5 rounded-3xl border border-white/5 bg-card p-5">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-4">
                    <Text {...COMPACT_TEXT} className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      Body Mass Index (BMI)
                    </Text>
                    <Text {...COMPACT_TEXT} className="mt-1 text-xs leading-5 text-muted">
                      A general metric. Athletic individuals often have higher density due to muscle mass.
                    </Text>
                  </View>
                  <View className="items-end">
                    <DisplayText {...COMPACT_TEXT} className="text-3xl font-black text-white">
                      {bmiValue}
                    </DisplayText>
                    <View
                      className={`mt-1 rounded-full px-2.5 py-0.5 ${
                        band.tone === 'ok' ? 'bg-brand/15' : 'bg-accent/15'
                      }`}>
                      <Text
                        {...COMPACT_TEXT}
                        className={`text-xs font-bold ${band.tone === 'ok' ? 'text-brand' : 'text-accent'}`}>
                        {band.label}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Personal Details & Fitness Vitals */}
            <Pressable
              onPress={() => setDetailsOpen((value) => !value)}
              accessibilityRole="button"
              accessibilityState={{ expanded: detailsOpen }}
              className="mx-5 mt-5 flex-row items-center justify-between rounded-2xl border border-white/5 bg-card p-5 active:opacity-80">
              <View className="flex-row items-center gap-2.5">
                <SymbolView
                  name={{ ios: 'person.text.rectangle.fill', android: 'badge', web: 'badge' }}
                  tintColor={BRAND}
                  size={18}
                />
                <Text className="text-base font-bold text-white">Fitness & Body Vitals</Text>
              </View>
              <SymbolView
                name={
                  detailsOpen
                    ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
                    : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
                }
                tintColor="#8fa396"
                size={16}
              />
            </Pressable>

            {detailsOpen ? (
              <>
                <View className="mt-4 flex-row flex-wrap gap-3 px-5">
                  <Fact label="Age" value={`${profile.age} years`} />
                  <Fact label="Biological Sex" value={SEX_LABEL[profile.sex]} />
                  <Fact label="Height" value={`${parseFloat(profile.heightCm.toFixed(1))} cm`} />
                  <Fact label="Diet Type" value={DIET_LABEL[profile.dietType]} />
                  <Fact label="Activity Tier" value={ACTIVITY_LABEL[profile.activityLevel].title} />
                  <Fact label="Dietitian Sync" value={profile.shareWithDietitian ? 'Active' : 'Off'} />
                </View>

                <View className="mx-5 mt-3 gap-3">
                  <View className="rounded-2xl border border-white/5 bg-card p-4">
                    <Text {...COMPACT_TEXT} className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      Food Allergies & Intolerances
                    </Text>
                    <Text {...COMPACT_TEXT} className="mt-1 text-sm font-semibold text-white">
                      {profile.allergies || 'None recorded'}
                    </Text>
                  </View>
                  <View className="rounded-2xl border border-white/5 bg-card p-4">
                    <Text {...COMPACT_TEXT} className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      Medical & Injury Notes
                    </Text>
                    <Text {...COMPACT_TEXT} className="mt-1 text-sm font-semibold text-white">
                      {profile.medicalNotes || 'None recorded'}
                    </Text>
                  </View>
                </View>
              </>
            ) : null}

            {/* Edit details CTA */}
            <View className="mt-5 px-5">
              <Pressable
                onPress={() => router.push('/edit-profile')}
                accessibilityRole="button"
                className="items-center rounded-2xl border border-white/10 bg-card py-4 active:opacity-70">
                <Text {...COMPACT_TEXT} className="text-sm font-bold text-white">
                  Edit Fitness Profile & Goals
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          /* Profile incomplete prompt */
          <View className="mx-5 mt-5 gap-4 rounded-3xl border border-brand/30 bg-card p-6">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand/10">
              <SymbolView
                name={{ ios: 'figure.strengthtraining.traditional', android: 'fitness_center', web: 'fitness_center' }}
                tintColor={BRAND}
                size={24}
              />
            </View>
            <Text className="text-xl font-black text-white">Complete Your Fitness Profile</Text>
            <Text {...COMPACT_TEXT} className="text-sm leading-6 text-muted">
              Add your target weight, training activity level, and dietary preferences to unlock accurate calorie calculations and weight tracking.
            </Text>
            <Pressable
              onPress={() => router.push('/edit-profile')}
              accessibilityRole="button"
              className="items-center rounded-2xl bg-brand py-4 active:opacity-80">
              <Text {...COMPACT_TEXT} className="text-sm font-black text-ink">
                Set Up Fitness Profile
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Enhanced Log Weight Modal */}
      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <View className="flex-1 items-center justify-center bg-black/75 px-6">
          <View accessibilityViewIsModal className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-card p-6">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-black text-white">Log Today&apos;s Weight</Text>
              <Pressable onPress={() => setSheet(false)} hitSlop={8} className="p-1">
                <SymbolView
                  name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }}
                  tintColor="#8fa396"
                  size={20}
                />
              </Pressable>
            </View>

            <Text className="mt-1 text-xs text-muted">
              Weigh yourself in the morning before breakfast for the most consistent reading.
            </Text>

            {/* Quick Adjust Buttons */}
            <View className="mt-4 flex-row items-center justify-center gap-2">
              {[-1.0, -0.5, +0.5, +1.0].map((delta) => (
                <Pressable
                  key={delta}
                  onPress={() => adjustWeight(delta)}
                  className="rounded-xl border border-white/10 bg-card-2 px-3 py-1.5 active:opacity-70">
                  <Text {...COMPACT_TEXT} className="text-xs font-bold text-brand">
                    {delta > 0 ? `+${delta}` : delta} kg
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Input field */}
            <View className="mt-4 flex-row items-center rounded-2xl border border-white/15 bg-card-2 px-4">
              <TextInput
                value={text}
                onChangeText={(t) => {
                  setText(t);
                  setError(null);
                }}
                keyboardType="decimal-pad"
                placeholder="e.g. 75.5"
                placeholderTextColor="#6f8577"
                selectionColor={BRAND}
                cursorColor={BRAND}
                autoFocus
                accessibilityLabel="Weight in kilograms"
                style={{ height: 56 }}
                className="flex-1 text-2xl font-bold text-white"
              />
              <Text className="ml-2 text-base font-bold text-brand">kg</Text>
            </View>

            {error ? <Text className="mt-2 text-sm text-accent">{error}</Text> : null}

            {/* Actions */}
            <View className="mt-6 flex-row gap-3">
              <Pressable
                onPress={() => setSheet(false)}
                disabled={busy}
                accessibilityRole="button"
                className="flex-1 items-center rounded-2xl border border-white/15 py-3.5 active:opacity-70">
                <Text className="font-bold text-white">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={saveWeight}
                disabled={busy}
                accessibilityRole="button"
                className="flex-1 items-center rounded-2xl bg-brand py-3.5 active:opacity-80">
                {busy ? (
                  <ActivityIndicator color={INK} size="small" />
                ) : (
                  <Text className="font-black text-ink">Save Entry</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
