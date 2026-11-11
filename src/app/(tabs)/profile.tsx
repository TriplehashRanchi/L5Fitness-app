import { PageHeading } from '@/components/page-heading';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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

const BRAND = '#c6f432';
const WEB_TOP_BAR = 72;
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[46%] flex-1 rounded-2xl bg-card p-4">
      <Text {...COMPACT_TEXT} className="text-[11px] uppercase tracking-wider text-muted">{label}</Text>
      <Text {...COMPACT_TEXT} className="mt-1 text-base font-bold text-white">{value}</Text>
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
  const [detailsOpen, setDetailsOpen] = useState(false);
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

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + (isWeb ? WEB_TOP_BAR : 20),
          width: '100%', maxWidth: 840, alignSelf: 'center',
          paddingBottom: insets.bottom + (isWeb ? 0 : BottomTabInset) + 24,
        }}>
        {/* Header */}
        <PageHeading title="Your profile" subtitle="Your progress, in one place." action={
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            className="h-11 w-11 items-center justify-center rounded-full bg-card active:opacity-70">
            <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} tintColor="white" size={18} />
          </Pressable>
        } />

        <View className="mx-5 mt-4 flex-row items-center gap-4 rounded-3xl border border-white/5 bg-card p-5">
          <Avatar name={user?.name ?? 'Athlete'} image={user?.image} size={72} />
          <View className="flex-1">
            <Text className="text-xl font-bold text-white" numberOfLines={1}>{user?.name}</Text>
            <Text {...COMPACT_TEXT} className="text-sm text-muted" numberOfLines={1}>{user?.email}</Text>
            {role !== 'member' ? (
              <View className="mt-2 self-start rounded-full bg-brand px-3 py-1">
                <Text {...COMPACT_TEXT} className="text-[11px] font-bold uppercase text-ink">{role === 'admin' ? 'Admin' : 'Dietitian'}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {profile ? (
          <>
            {/* Goal progress */}
            <View className="mx-5 mt-5 rounded-3xl border border-white/5 bg-card p-5">
              <View className="flex-row items-baseline justify-between">
                <Text className="text-base font-bold text-white">{GOAL_LABEL[profile.goal]}</Text>
                <Text {...COMPACT_TEXT} className="text-xs font-semibold text-brand">
                  {goalRemaining(profile.goal, profile.weightKg, profile.targetWeightKg)}
                </Text>
              </View>
              <View className="mt-4 flex-row items-end justify-between">
                <View>
                  <Text {...COMPACT_TEXT} className="text-[11px] text-muted">Start</Text>
                  <Text {...COMPACT_TEXT} className="text-lg font-bold text-white">{fmtKg(profile.startWeightKg)}</Text>
                </View>
                <View className="items-center">
                  <Text {...COMPACT_TEXT} className="text-[11px] text-muted">Now</Text>
                  <Text {...COMPACT_TEXT} style={{ fontSize: 30, lineHeight: 34 }} className="font-bold text-brand">{fmtKg(profile.weightKg)}</Text>
                </View>
                <View className="items-end">
                  <Text {...COMPACT_TEXT} className="text-[11px] text-muted">Target</Text>
                  <Text {...COMPACT_TEXT} className="text-lg font-bold text-white">{fmtKg(profile.targetWeightKg)}</Text>
                </View>
              </View>
              <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} className="mt-4 overflow-hidden rounded-full bg-card-2" style={{ height: 6 }}>
                <View className="rounded-full bg-brand" style={{ height: 6, width: `${Math.round(progress * 100)}%` }} />
              </View>
              <Pressable
                onPress={() => { setError(null); setText(String(profile.weightKg)); setSheet(true); }}
                accessibilityRole="button"
                className="mt-4 items-center rounded-full bg-brand py-3 active:opacity-80">
                <Text {...COMPACT_TEXT} className="font-bold text-ink">Log today&apos;s weight</Text>
              </Pressable>
            </View>

            {/* Weight history */}
            <View className="mx-5 mt-5 rounded-3xl border border-white/5 bg-card p-5">
              <Text className="mb-4 text-base font-bold text-white">Weight progress</Text>
              <WeightBars history={weightHistory} />
            </View>

            {/* BMI */}
            {bmiValue != null && band ? (
              <View className="mx-5 mt-5 flex-row items-center gap-4 rounded-3xl border border-white/5 bg-card p-5">
                <View className="flex-1">
                  <Text {...COMPACT_TEXT} className="text-[11px] uppercase tracking-wider text-muted">Body mass index</Text>
                  <Text {...COMPACT_TEXT} className="mt-1 text-xs text-muted">A general guide only. Your dietitian looks at the full picture.</Text>
                </View>
                <View className="items-end">
                  <Text {...COMPACT_TEXT} className="text-3xl font-bold text-white">{bmiValue}</Text>
                  <Text {...COMPACT_TEXT} className={`text-xs font-bold ${band.tone === 'ok' ? 'text-brand' : 'text-accent'}`}>{band.label}</Text>
                </View>
              </View>
            ) : null}

            <Pressable onPress={() => setDetailsOpen((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} className="mx-5 mt-5 flex-row items-center justify-between rounded-2xl border border-white/5 bg-card p-5">
              <Text className="text-base font-semibold text-white">Personal details</Text>
              <SymbolView name={detailsOpen ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} tintColor="#9ba2ac" size={16} />
            </Pressable>
            {detailsOpen ? <>
            {/* Details */}
            <View className="mt-5 flex-row flex-wrap gap-3 px-5">
              <Fact label="Age" value={`${profile.age} years`} />
              <Fact label="Sex" value={SEX_LABEL[profile.sex]} />
              <Fact label="Height" value={`${parseFloat(profile.heightCm.toFixed(1))} cm`} />
              <Fact label="Food" value={DIET_LABEL[profile.dietType]} />
              <Fact label="Activity" value={ACTIVITY_LABEL[profile.activityLevel].title} />
              <Fact label="Dietitian" value={profile.shareWithDietitian ? 'Sharing on' : 'Sharing off'} />
            </View>

            <View className="mx-5 mt-3 gap-3">
              <View className="rounded-2xl bg-card p-4">
                <Text {...COMPACT_TEXT} className="text-[11px] uppercase tracking-wider text-muted">Allergies</Text>
                <Text {...COMPACT_TEXT} className="mt-1 text-sm text-white">{profile.allergies || 'None added'}</Text>
              </View>
              <View className="rounded-2xl bg-card p-4">
                <Text {...COMPACT_TEXT} className="text-[11px] uppercase tracking-wider text-muted">Medical notes</Text>
                <Text {...COMPACT_TEXT} className="mt-1 text-sm text-white">{profile.medicalNotes || 'None added'}</Text>
              </View>
            </View>

            </> : null}

            <View className="mt-5 px-5">
              <Pressable
                onPress={() => router.push('/edit-profile')}
                accessibilityRole="button"
                className="items-center rounded-full border border-white/15 bg-card py-4 active:opacity-70">
                <Text {...COMPACT_TEXT} className="text-base font-bold text-white">Edit details</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View className="mx-5 mt-5 gap-4 rounded-3xl border border-white/10 bg-card p-5">
            <Text className="text-xl font-bold text-white">Make it personal</Text>
            <Text {...COMPACT_TEXT} className="text-sm leading-6 text-muted">Add your body details and food preferences when you’re ready to track weight and work with your dietitian.</Text>
            <Pressable onPress={() => router.push('/edit-profile')} accessibilityRole="button" className="items-center rounded-full bg-brand py-4 active:opacity-80">
              <Text {...COMPACT_TEXT} className="font-bold text-ink">Complete fitness profile</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Log weight */}
      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <View className="flex-1 items-center justify-center bg-black/70 px-6">
          <View accessibilityViewIsModal className="w-full max-w-[420px] rounded-3xl border border-white/5 bg-card p-6">
            <Text className="text-lg font-bold text-white">Log your weight</Text>
            <Text className="mt-1 text-sm text-muted">Weigh yourself in the morning, before eating, for the best comparison.</Text>
            <View className="mt-4 flex-row items-center rounded-2xl border border-white/10 bg-card-2 px-4">
              <TextInput
                value={text}
                onChangeText={(t) => { setText(t); setError(null); }}
                keyboardType="decimal-pad"
                placeholder="e.g. 80.5"
                placeholderTextColor="#7c8592"
                selectionColor={BRAND}
                cursorColor={BRAND}
                autoFocus
                accessibilityLabel="Weight in kilograms"
                style={{ height: 52 }}
                className="flex-1 text-lg text-white"
              />
              <Text className="ml-2 text-sm text-muted">kg</Text>
            </View>
            {error ? <Text className="mt-2 text-sm text-accent">{error}</Text> : null}
            <View className="mt-5 flex-row gap-3">
              <Pressable onPress={() => setSheet(false)} disabled={busy} accessibilityRole="button" className="flex-1 items-center rounded-full border border-white/15 py-3 active:opacity-70">
                <Text className="font-bold text-white">Cancel</Text>
              </Pressable>
              <Pressable onPress={saveWeight} disabled={busy} accessibilityRole="button" className="flex-1 items-center rounded-full bg-brand py-3 active:opacity-80">
                {busy ? <ActivityIndicator color="#0b0b0d" /> : <Text className="font-bold text-ink">Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
