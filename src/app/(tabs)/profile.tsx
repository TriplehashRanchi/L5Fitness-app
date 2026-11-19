import { DisplayText } from '@/components/display-text';
import { BmiScale, WeightRing, WeightTrend } from '@/components/profile/weight-visuals';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
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
const MUTED = '#8fa396';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const WEB_TOP_BAR = 72;
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** A card with a coloured icon, a title and a short status on the right (same look as Today's plan). */
function Card({
  icon,
  color,
  title,
  status,
  statusColor,
  children,
}: {
  icon: SymbolViewProps['name'];
  color: string;
  title: string;
  status?: string | null;
  statusColor?: string;
  children: ReactNode;
}) {
  return (
    <View className="mx-5 mb-4 rounded-3xl border border-white/5 bg-card" style={{ padding: 16 }}>
      <View className="flex-row items-center" style={{ gap: 12, marginBottom: 12 }}>
        <View className="items-center justify-center" style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${color}26` }}>
          <SymbolView name={icon} tintColor={color} size={18} />
        </View>
        <Text {...COMPACT_TEXT} accessibilityRole="header" className="flex-1 font-bold text-white" style={{ fontSize: 17 }}>
          {title}
        </Text>
        {status ? (
          <Text {...COMPACT_TEXT} className="font-bold" style={{ fontSize: 13, color: statusColor ?? MUTED }}>
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
      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

/** A small fact with its icon, two to a row. */
function Tile({ icon, label, value, tone }: { icon: SymbolViewProps['name']; label: string; value: string; tone?: string }) {
  return (
    <View style={{ width: '50%', padding: 5 }}>
      <View accessible accessibilityLabel={`${label}: ${value}`} className="flex-row items-center rounded-2xl bg-card-2" style={{ gap: 10, padding: 12, minHeight: 62 }}>
        <SymbolView name={icon} tintColor={MUTED} size={18} />
        <View className="flex-1">
          <Text {...COMPACT_TEXT} className="font-bold" style={{ fontSize: 15, color: tone ?? '#ffffff' }} numberOfLines={1}>
            {value}
          </Text>
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, marginTop: 1 }} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** A line of free text the member wrote (allergies, medical notes). */
function Note({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <Text {...COMPACT_TEXT} className={value ? 'font-semibold text-white' : 'text-muted'} style={{ fontSize: 15, lineHeight: 21, marginTop: 2 }}>
        {value || 'None'}
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
  const roleLabel = role === 'admin' ? 'Admin' : role === 'dietitian' ? 'Dietitian' : 'L5 Athlete';

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
          <DisplayText accessibilityRole="header" className="text-[32px] leading-10 tracking-tight text-white" numberOfLines={1}>
            Profile
          </DisplayText>
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            className="items-center justify-center rounded-full border border-white/10 bg-card active:opacity-70"
            style={{ width: 46, height: 46 }}>
            <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} tintColor="white" size={19} />
          </Pressable>
        </View>

        {/* Who this is: picture, name, role and goal. */}
        <View className="mx-5 mb-4 overflow-hidden rounded-3xl border border-white/5" style={{ padding: 18 }}>
          <LinearGradient colors={['#153a23', '#0b1a11']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View className="flex-row items-center" style={{ gap: 16 }}>
            <View style={{ padding: 3, borderRadius: 44, borderWidth: 2, borderColor: BRAND }}>
              <Avatar name={user?.name ?? 'Athlete'} image={user?.image} size={76} />
            </View>
            <View className="flex-1">
              <DisplayText {...COMPACT_TEXT} className="text-white" style={{ fontSize: 24, lineHeight: 30 }} numberOfLines={1}>
                {user?.name ?? 'Athlete'}
              </DisplayText>
              <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                {user?.email}
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 10 }}>
                <View className="justify-center rounded-full bg-brand" style={{ height: 26, paddingHorizontal: 12 }}>
                  <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 12 }}>
                    {roleLabel}
                  </Text>
                </View>
                {profile ? (
                  <View className="justify-center rounded-full" style={{ height: 26, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.1)' }}>
                    <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 12 }}>
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
            {/* Weight goal: the ring fills as the target gets closer. */}
            <Card icon={{ ios: 'scalemass.fill', android: 'monitor_weight', web: 'monitor_weight' }} color={BRAND} title="Weight goal" status={`${Math.round(progress * 100)}%`}>
              <View className="items-center" style={{ marginTop: 4 }}>
                <WeightRing weightKg={profile.weightKg} progress={progress} />
                <Text {...COMPACT_TEXT} className="font-bold text-brand" style={{ fontSize: 15, marginTop: 12 }}>
                  {goalRemaining(profile.goal, profile.weightKg, profile.targetWeightKg)}
                </Text>
              </View>
              <View className="flex-row" style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
                <Figure label="Start" value={fmtKg(profile.startWeightKg)} />
                <Figure label="Change" value={changeLabel} divider />
                <Figure label="Target" value={fmtKg(profile.targetWeightKg)} divider />
              </View>
              <Pressable
                onPress={openSheet}
                accessibilityRole="button"
                accessibilityLabel="Log today's weight"
                className="flex-row items-center justify-center rounded-full bg-brand active:opacity-80"
                style={{ gap: 8, minHeight: 52, marginTop: 16 }}>
                <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={INK} size={14} />
                <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 16 }}>
                  Log weight
                </Text>
              </Pressable>
            </Card>

            <Card
              icon={{ ios: 'chart.line.uptrend.xyaxis', android: 'show_chart', web: 'show_chart' }}
              color="#38bdf8"
              title="Trend"
              status={weightHistory.length > 1 ? `${Math.min(12, weightHistory.length)} weigh-ins` : null}>
              <WeightTrend history={weightHistory} targetKg={profile.targetWeightKg} locale={format.locale} />
            </Card>

            {bmiValue != null && band ? (
              <Card icon={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' }} color="#fb923c" title="BMI" status={band.label} statusColor={band.tone === 'ok' ? BRAND : '#fb923c'}>
                <DisplayText {...COMPACT_TEXT} className="text-white" style={{ fontSize: 36, lineHeight: 42, marginBottom: 8 }}>
                  {bmiValue}
                </DisplayText>
                <BmiScale value={bmiValue} />
              </Card>
            ) : null}

            <Card icon={{ ios: 'person.fill', android: 'person', web: 'person' }} color="#fbbf24" title="About you">
              <View className="flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
                <Tile icon={{ ios: 'birthday.cake.fill', android: 'cake', web: 'cake' }} label="Age" value={`${profile.age} yrs`} />
                <Tile icon={{ ios: 'ruler.fill', android: 'straighten', web: 'straighten' }} label="Height" value={`${parseFloat(profile.heightCm.toFixed(1))} cm`} />
                <Tile icon={{ ios: 'person.fill', android: 'wc', web: 'wc' }} label="Sex" value={SEX_LABEL[profile.sex]} />
                <Tile icon={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }} label="Diet" value={DIET_LABEL[profile.dietType]} />
                <Tile icon={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }} label="Activity" value={ACTIVITY_LABEL[profile.activityLevel].title} />
                <Tile
                  icon={{ ios: 'person.2.fill', android: 'group', web: 'group' }}
                  label="Sharing"
                  value={profile.shareWithDietitian ? 'On' : 'Off'}
                  tone={profile.shareWithDietitian ? BRAND : undefined}
                />
              </View>
              <Note label="Allergies" value={profile.allergies} />
              <Note label="Medical notes" value={profile.medicalNotes} />
              <Pressable
                onPress={() => router.push('/edit-profile')}
                accessibilityRole="button"
                accessibilityLabel="Edit your profile"
                className="flex-row items-center justify-center rounded-full bg-card-2 active:opacity-70"
                style={{ gap: 8, minHeight: 48, marginTop: 14 }}>
                <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} tintColor="white" size={14} />
                <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 15 }}>
                  Edit profile
                </Text>
              </Pressable>
            </Card>
          </>
        ) : (
          <Card icon={{ ios: 'figure.strengthtraining.traditional', android: 'fitness_center', web: 'fitness_center' }} color={BRAND} title="Your fitness profile">
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
              A few quick questions, so your plan and progress fit you.
            </Text>
            <Pressable
              onPress={() => router.push('/complete-profile' as never)}
              accessibilityRole="button"
              className="flex-row items-center justify-center rounded-full bg-brand active:opacity-80"
              style={{ gap: 8, minHeight: 52, marginTop: 16 }}>
              <Text {...COMPACT_TEXT} className="font-black text-ink" style={{ fontSize: 16 }}>
                Complete profile
              </Text>
              <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor={INK} size={13} />
            </Pressable>
          </Card>
        )}
      </ScrollView>

      {/* Log weight: nudge the number with − and +, or tap it to type. */}
      <Modal visible={sheet} transparent animationType="fade" onRequestClose={() => setSheet(false)}>
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <View accessibilityViewIsModal className="w-full rounded-3xl border border-white/10 bg-card" style={{ maxWidth: 420, padding: 20 }}>
            <View className="flex-row items-center justify-between">
              <DisplayText {...COMPACT_TEXT} accessibilityRole="header" className="text-white" style={{ fontSize: 22, lineHeight: 28 }}>
                Log weight
              </DisplayText>
              <Pressable
                onPress={() => setSheet(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
                className="items-center justify-center rounded-full active:opacity-60"
                style={{ width: 34, height: 34, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} tintColor="white" size={12} />
              </Pressable>
            </View>

            <View className="flex-row items-center justify-between" style={{ marginTop: 22 }}>
              <Pressable
                onPress={() => adjustWeight(-0.1)}
                accessibilityRole="button"
                accessibilityLabel="0.1 kilograms less"
                className="items-center justify-center rounded-full bg-card-2 active:opacity-70"
                style={{ width: 56, height: 56 }}>
                <SymbolView name={{ ios: 'minus', android: 'remove', web: 'remove' }} tintColor="white" size={18} />
              </Pressable>
              <View className="flex-1 flex-row items-baseline justify-center" style={{ gap: 6 }}>
                <TextInput
                  value={text}
                  onChangeText={(t) => {
                    setText(t);
                    setError(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  placeholderTextColor="#6f8577"
                  selectionColor={BRAND}
                  cursorColor={BRAND}
                  maxLength={5}
                  accessibilityLabel="Weight in kilograms"
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
                accessibilityLabel="0.1 kilograms more"
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
                  accessibilityLabel={`${delta > 0 ? 'Add' : 'Take off'} ${Math.abs(delta)} kilograms`}
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
                  Save
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
