import Constants from 'expo-constants';
import { DisplayText } from '@/components/display-text';
import { GreenBackground } from '@/components/green-background';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { type IconName } from '@/constants/icons';
import { useSettings } from '@/hooks/use-settings';
import { useNotifications } from '@/providers/notifications-provider';
import { AuthError, deleteAccount } from '@/lib/auth-api';
import { messageFrom } from '@/lib/http';
import { formatWater } from '@/lib/water';
import { useAuth } from '@/providers/auth-provider';

const BRAND = '#3ddc68';
const MUTED = '#8fa396';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

// Optional links. Set them in .env to show the rows: they are required by the app stores.
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

const PROVIDER_LABEL = { password: 'Email and password', google: 'Google', apple: 'Apple' } as const;

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <View className="mt-7 px-5">
      <View className="mb-2.5 flex-row items-center gap-2 px-1">
        {icon ? <SymbolView name={icon} tintColor={BRAND} size={15} /> : null}
        <Text {...COMPACT_TEXT} className="text-xs font-black uppercase tracking-[1px] text-muted">
          {title}
        </Text>
      </View>
      <View className="overflow-hidden rounded-3xl border border-white/5 bg-card">{children}</View>
    </View>
  );
}

function Stepper({
  label,
  value,
  display,
  presets,
  onMinus,
  onPlus,
  onSelectPreset,
  minusDisabled,
  plusDisabled,
  last,
  locked,
}: {
  label: string;
  /** true when the dietitian has set this goal: shown read-only */
  locked?: boolean;
  value: number;
  display: string;
  presets?: { label: string; value: number }[];
  onMinus: () => void;
  onPlus: () => void;
  onSelectPreset?: (val: number) => void;
  minusDisabled: boolean;
  plusDisabled: boolean;
  last?: boolean;
}) {
  const button = (name: 'minus' | 'plus', onPress: () => void, disabled: boolean) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${name === 'minus' ? 'Decrease' : 'Increase'} ${label}`}
      className={`h-10 w-10 items-center justify-center rounded-2xl bg-card-2 active:opacity-70 ${disabled ? 'opacity-30' : ''}`}>
      <SymbolView
        name={name === 'minus' ? { ios: 'minus', android: 'remove', web: 'remove' } : { ios: 'plus', android: 'add', web: 'add' }}
        tintColor="white"
        size={16}
      />
    </Pressable>
  );
  if (locked) {
    return (
      <View className={`px-5 py-4 ${last ? '' : 'border-b border-white/5'}`}>
        <View className="flex-row items-center gap-3">
          <Text {...COMPACT_TEXT} className="flex-1 text-base font-bold text-white">
            {label}
          </Text>
          <Text {...COMPACT_TEXT} accessibilityLabel={`${label}: ${display}, set by your dietitian`} className="text-base font-black text-brand">
            {display}
          </Text>
        </View>
        <Text {...COMPACT_TEXT} className="mt-1 text-xs text-muted">
          Set by your dietitian
        </Text>
      </View>
    );
  }
  return (
    <View className={`px-5 py-4 ${last ? '' : 'border-b border-white/5'}`}>
      <View className="flex-row items-center gap-3">
        <Text {...COMPACT_TEXT} className="flex-1 text-base font-bold text-white">
          {label}
        </Text>
        {button('minus', onMinus, minusDisabled)}
        <Text
          {...COMPACT_TEXT}
          accessibilityLabel={`${label}: ${display}`}
          data-value={value}
          className="min-w-[84px] text-center text-base font-black text-brand">
          {display}
        </Text>
        {button('plus', onPlus, plusDisabled)}
      </View>

      {/* Quick preset chips */}
      {presets && onSelectPreset ? (
        <View className="mt-2.5 flex-row items-center gap-1.5">
          {presets.map((p) => {
            const isSelected = value === p.value;
            return (
              <Pressable
                key={p.label}
                onPress={() => onSelectPreset(p.value)}
                className={`rounded-lg px-2.5 py-1 ${
                  isSelected ? 'bg-brand/20 border border-brand/40' : 'bg-card-2'
                } active:opacity-70`}>
                <Text
                  {...COMPACT_TEXT}
                  className={`text-[11px] font-bold ${isSelected ? 'text-brand' : 'text-muted'}`}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function Row({
  title,
  value,
  onPress,
  last,
}: {
  title: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'link' : 'text'}
      className={`flex-row items-center gap-3 px-5 py-4 active:opacity-70 ${last ? '' : 'border-b border-white/5'}`}>
      <Text {...COMPACT_TEXT} className="flex-1 text-base font-semibold text-white">
        {title}
      </Text>
      {value ? (
        <Text {...COMPACT_TEXT} className="text-sm font-medium text-muted">
          {value}
        </Text>
      ) : null}
      {onPress ? (
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={MUTED} size={14} />
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const { settings, prescribed, error, saving, change } = useSettings();
  const push = useNotifications();

  const [confirm, setConfirm] = useState<'logout' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const user = session?.user;
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

  const logOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } catch {
      setBusy(false);
      setConfirm(null);
      setNotice('Could not log out. Please try again.');
    }
  };

  const removeAccount = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await deleteAccount();
    } catch (e) {
      setBusy(false);
      setConfirm(null);
      setNotice(e instanceof AuthError ? e.message : messageFrom(e));
    }
  };

  const open = (url: string) => Linking.openURL(url).catch(() => setNotice('Could not open that link.'));

  return (
    <View className="flex-1 bg-ink">
      <GreenBackground />
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 40,
          width: '100%',
          maxWidth: 840,
          alignSelf: 'center',
        }}
        showsVerticalScrollIndicator={false}>
        {/* Navigation & Header */}
        <View className="flex-row items-center gap-3 px-5 pb-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-card active:opacity-70">
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
          </Pressable>
          <DisplayText className="flex-1 text-[30px] font-bold tracking-tight text-white">Settings</DisplayText>
          {saving ? (
            <View className="flex-row items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1">
              <ActivityIndicator color={BRAND} size="small" />
              <Text {...COMPACT_TEXT} className="text-xs font-bold text-brand">
                Saving
              </Text>
            </View>
          ) : null}
        </View>

        {notice || error ? (
          <View accessibilityRole="alert" className="mx-5 mt-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm font-semibold text-white">{notice ?? error}</Text>
          </View>
        ) : null}

        <Text className="mt-2 px-5 text-sm leading-5 text-muted">
          Manage your daily workout habits, targets, and security.
        </Text>

        {/* Athlete Profile Banner */}
        <View className="mx-5 mt-5 flex-row items-center gap-4 rounded-3xl border border-white/10 bg-card p-5">
          <Avatar name={user?.name ?? 'Athlete'} image={user?.image} size={64} />
          <View className="flex-1">
            <Text className="text-lg font-black text-white" numberOfLines={1}>
              {user?.name}
            </Text>
            <Text {...COMPACT_TEXT} className="mt-0.5 text-xs text-muted" numberOfLines={1}>
              {user?.email}
            </Text>
            <View className="mt-2 flex-row items-center gap-2">
              <View className="rounded-full bg-brand/15 px-2.5 py-0.5">
                <Text {...COMPACT_TEXT} className="text-[10px] font-bold text-brand uppercase">
                  Active Member
                </Text>
              </View>
              <Text {...COMPACT_TEXT} className="text-[11px] text-muted">
                via {user ? PROVIDER_LABEL[user.provider] : 'Email'}
              </Text>
            </View>
          </View>
        </View>

        {/* Daily Targets */}
        <Section
          title="Daily Targets"
          icon={{ ios: 'target', android: 'track_changes', web: 'track_changes' }}>
          {settings ? (
            <>
              <Stepper
                label="Daily Steps Goal"
                locked={prescribed.steps != null}
                value={settings.stepGoal}
                display={settings.stepGoal.toLocaleString()}
                presets={[
                  { label: '6,000', value: 6000 },
                  { label: '8,000', value: 8000 },
                  { label: '10,000', value: 10000 },
                  { label: '12,000', value: 12000 },
                ]}
                onMinus={() => change({ stepGoal: clamp(settings.stepGoal - 500, 1000, 100000) })}
                onPlus={() => change({ stepGoal: clamp(settings.stepGoal + 500, 1000, 100000) })}
                onSelectPreset={(val) => change({ stepGoal: val })}
                minusDisabled={settings.stepGoal <= 1000}
                plusDisabled={settings.stepGoal >= 100000}
              />
              <Stepper
                label="Daily Water Target"
                locked={prescribed.waterMl != null}
                value={settings.waterGoalMl}
                display={formatWater(settings.waterGoalMl)}
                presets={[
                  { label: '2.5 L', value: 2500 },
                  { label: '3.0 L', value: 3000 },
                  { label: '3.5 L', value: 3500 },
                  { label: '4.0 L', value: 4000 },
                ]}
                onMinus={() => change({ waterGoalMl: clamp(settings.waterGoalMl - 250, 500, 10000) })}
                onPlus={() => change({ waterGoalMl: clamp(settings.waterGoalMl + 250, 500, 10000) })}
                onSelectPreset={(val) => change({ waterGoalMl: val })}
                minusDisabled={settings.waterGoalMl <= 500}
                plusDisabled={settings.waterGoalMl >= 10000}
              />
              <Stepper
                label="Weekly Workout Target"
                locked={prescribed.weeklyWorkouts != null}
                value={settings.weeklyGoal}
                display={`${settings.weeklyGoal} days`}
                presets={[
                  { label: '3 days', value: 3 },
                  { label: '4 days', value: 4 },
                  { label: '5 days', value: 5 },
                  { label: '6 days', value: 6 },
                ]}
                onMinus={() => change({ weeklyGoal: clamp(settings.weeklyGoal - 1, 1, 7) })}
                onPlus={() => change({ weeklyGoal: clamp(settings.weeklyGoal + 1, 1, 7) })}
                onSelectPreset={(val) => change({ weeklyGoal: val })}
                minusDisabled={settings.weeklyGoal <= 1}
                plusDisabled={settings.weeklyGoal >= 7}
                last
              />
            </>
          ) : error ? (
            <Text className="px-5 py-5 text-sm text-muted">Goals could not be loaded.</Text>
          ) : (
            <View className="items-center py-8">
              <ActivityIndicator color={BRAND} />
            </View>
          )}
        </Section>

        {/* Notifications */}
        <Section
          title="Notifications"
          icon={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}>
          <Row
            title="Notification Inbox"
            value={push.unread > 0 ? `${push.unread} new` : 'All caught up'}
            onPress={() => push.openInbox()}
          />
          <Row
            title="Workout Reminders"
            value={
              push.status === 'denied'
                ? 'Blocked (tap to allow)'
                : push.status === 'unavailable'
                  ? 'Not available in this build'
                  : push.status === 'error'
                    ? 'Setup error (tap to retry)'
                    : push.alertsOn
                      ? 'Enabled'
                      : 'Disabled'
            }
            onPress={
              push.status === 'denied'
                ? () => Linking.openSettings().catch(() => setNotice('Could not open settings.'))
                : push.status === 'error'
                  ? () => void push.retry()
                  : push.status === 'on'
                    ? () => push.setAlerts(!push.alertsOn).catch(() => setNotice('Could not change that. Please try again.'))
                    : undefined
            }
            last
          />
        </Section>

        {/* Health & Storage */}
        <Section
          title="Data & Sync"
          icon={{ ios: 'heart.text.square.fill', android: 'health_and_safety', web: 'health_and_safety' }}>
          <Row title="Apple Health / Health Connect" value="Direct device sync" />
          <Row title="Meal photos" value="Stored privately in your account" />
          <Row title="Active workout state" value="Saved to device" last />
        </Section>

        {/* About */}
        <Section
          title="About"
          icon={{ ios: 'info.circle.fill', android: 'info', web: 'info' }}>
          {PRIVACY_URL ? <Row title="Privacy Policy" onPress={() => open(PRIVACY_URL)} /> : null}
          {TERMS_URL ? <Row title="Terms of Service" onPress={() => open(TERMS_URL)} /> : null}
          {SUPPORT_EMAIL ? (
            <Row
              title="Contact Support & Coaches"
              value={SUPPORT_EMAIL}
              onPress={() => open(`mailto:${SUPPORT_EMAIL}`)}
            />
          ) : null}
          <Row title="App Version" value={`${version} (Production)`} last />
        </Section>

        {/* Account Actions */}
        <View className="mt-8 gap-3 px-5">
          <Pressable
            onPress={() => setConfirm('logout')}
            accessibilityRole="button"
            className="items-center rounded-2xl border border-white/15 bg-card py-4 active:opacity-70">
            <Text {...COMPACT_TEXT} className="text-base font-bold text-white">
              Log Out
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setConfirm('delete')}
            accessibilityRole="button"
            className="items-center rounded-2xl py-3 active:opacity-70">
            <Text {...COMPACT_TEXT} className="text-sm font-semibold text-accent">
              Delete Account
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Confirmation Sheets */}
      <ConfirmSheet
        visible={confirm === 'logout'}
        title="Log out of L5 Fitness?"
        message="You will need to sign back in to view your workout logs, active routines, and personalized diet plan."
        confirmLabel="Log Out"
        busy={busy}
        onConfirm={logOut}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        visible={confirm === 'delete'}
        title="Permanently Delete Account?"
        message="This permanently erases all your workout history, meal photos, hydration logs, and body transformation stats. This action cannot be undone."
        confirmLabel="Delete Everything"
        destructive
        busy={busy}
        onConfirm={removeAccount}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}
