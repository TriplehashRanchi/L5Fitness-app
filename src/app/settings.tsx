import Constants from 'expo-constants';
import { DisplayText } from '@/components/display-text';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { type IconName } from '@/constants/icons';
import { useSettings } from '@/hooks/use-settings';
import { useNotifications } from '@/providers/notifications-provider';
import { AuthError, deleteAccount } from '@/lib/auth-api';
import { messageFrom } from '@/lib/http';
import { stepsProvider } from '@/lib/steps/provider';
import type { StepsStatus } from '@/lib/steps/types';
import { formatWater } from '@/lib/water';
import { useAuth } from '@/providers/auth-provider';

const BRAND = '#3ddc68';
const MUTED = '#8fa396';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const RED = '#ff5a4f';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

// Optional links. Set them in .env to show the rows: they are required by the app stores.
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

const PROVIDER_LABEL = { password: 'Email and password', google: 'Google', apple: 'Apple' } as const;

/** A group of settings: a small heading, then its rows straight on the page, with a thin line above the group. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="px-5" style={{ paddingTop: 22, paddingBottom: 10, borderTopWidth: 1, borderTopColor: HAIRLINE, marginTop: 12 }}>
      <Text {...COMPACT_TEXT} accessibilityRole="header" className="font-bold uppercase text-muted" style={{ fontSize: 12, letterSpacing: 1.4, marginBottom: 6 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Stepper({
  icon,
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
  icon: IconName;
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
      hitSlop={6}
      className={`h-9 w-9 items-center justify-center rounded-full active:opacity-70 ${disabled ? 'opacity-30' : ''}`}
      style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
      <SymbolView
        name={name === 'minus' ? { ios: 'minus', android: 'remove', web: 'remove' } : { ios: 'plus', android: 'add', web: 'add' }}
        tintColor="white"
        size={14}
      />
    </Pressable>
  );
  if (locked) {
    return (
      <View className={`flex-row items-center gap-3 py-4 ${last ? '' : 'border-b border-white/5'}`}>
        <SymbolView name={icon} tintColor={MUTED} size={18} />
        <View className="flex-1">
          <Text {...COMPACT_TEXT} className="text-base font-semibold text-white">
            {label}
          </Text>
          <View className="mt-0.5 flex-row items-center gap-1.5">
            <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} tintColor={MUTED} size={10} />
            <Text {...COMPACT_TEXT} className="text-xs text-muted">
              Set by your dietitian
            </Text>
          </View>
        </View>
        <Text {...COMPACT_TEXT} numberOfLines={1} accessibilityLabel={`${label}: ${display}, set by your dietitian`} className="text-base font-black text-brand">
          {display}
        </Text>
      </View>
    );
  }
  return (
    <View className={`py-4 ${last ? '' : 'border-b border-white/5'}`}>
      <View className="flex-row items-center gap-3">
        <SymbolView name={icon} tintColor={MUTED} size={18} />
        <Text {...COMPACT_TEXT} className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
          {label}
        </Text>
        {/* minus, the value and plus in one pill; the value never wraps */}
        <View className="flex-row items-center rounded-full border border-white/10" style={{ padding: 3, backgroundColor: 'rgba(255,255,255,0.04)' }}>
          {button('minus', onMinus, minusDisabled)}
          <Text
            {...COMPACT_TEXT}
            accessibilityLabel={`${label}: ${display}`}
            data-value={value}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            className="text-center text-[15px] font-black text-brand"
            style={{ width: 70 }}>
            {display}
          </Text>
          {button('plus', onPlus, plusDisabled)}
        </View>
      </View>

      {/* Quick preset chips */}
      {presets && onSelectPreset ? (
        <View className="mt-3 flex-row items-center gap-2" style={{ paddingLeft: 30 }}>
          {presets.map((p) => {
            const isSelected = value === p.value;
            return (
              <Pressable
                key={p.label}
                onPress={() => onSelectPreset(p.value)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Set ${label} to ${p.label}`}
                className={`flex-1 items-center justify-center rounded-full border ${isSelected ? 'border-brand bg-brand' : 'border-white/10'} active:opacity-70`}
                style={{ minHeight: 32 }}>
                <Text {...COMPACT_TEXT} numberOfLines={1} className={`text-xs font-bold ${isSelected ? 'text-ink' : 'text-muted'}`}>
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

/**
 * One setting as a row: icon, name, an optional line of explanation under it, and at the right its value,
 * a switch, or an arrow when it leads somewhere.
 */
function Row({
  icon,
  title,
  detail,
  value,
  onPress,
  toggle,
  tone,
  last,
}: {
  icon: IconName;
  title: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
  /** a switch at the right instead of an arrow */
  toggle?: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean };
  /** 'danger' for something that cannot be undone */
  tone?: 'danger';
  last?: boolean;
}) {
  const color = tone === 'danger' ? '#ff6b35' : '#ffffff';
  return (
    <Pressable
      onPress={toggle ? () => toggle.onChange(!toggle.on) : onPress}
      disabled={toggle ? toggle.disabled : !onPress}
      accessibilityRole={toggle ? 'switch' : onPress ? 'button' : 'text'}
      accessibilityState={toggle ? { checked: toggle.on, disabled: toggle.disabled } : undefined}
      accessibilityLabel={`${title}${value ? `, ${value}` : ''}${detail ? `. ${detail}` : ''}`}
      className={`flex-row items-center gap-3 active:opacity-70 ${last ? '' : 'border-b border-white/5'}`}
      style={{ minHeight: 56, paddingVertical: 10 }}>
      <SymbolView name={icon} tintColor={tone === 'danger' ? color : MUTED} size={18} />
      <View className="flex-1">
        <Text {...COMPACT_TEXT} className="text-base font-semibold" style={{ color }} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text {...COMPACT_TEXT} className="mt-0.5 text-xs leading-4 text-muted" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text {...COMPACT_TEXT} className="text-sm font-medium text-muted" numberOfLines={1} style={{ maxWidth: '45%' }}>
          {value}
        </Text>
      ) : null}
      {toggle ? (
        <Switch
          value={toggle.on}
          onValueChange={toggle.onChange}
          disabled={toggle.disabled}
          trackColor={{ false: 'rgba(255,255,255,0.15)', true: BRAND }}
          thumbColor="#ffffff"
          ios_backgroundColor="rgba(255,255,255,0.15)"
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      ) : onPress && tone !== 'danger' ? (
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={MUTED} size={14} />
      ) : null}
    </Pressable>
  );
}

const STEPS_LABEL: Record<StepsStatus | 'loading', string> = {
  loading: 'Checking',
  ready: 'Connected',
  'needs-permission': 'Not connected',
  'needs-setup': 'Needs setup',
  unavailable: 'Not available',
};

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const { settings, prescribed, error, saving, change } = useSettings();
  const push = useNotifications();

  const [confirm, setConfirm] = useState<'logout' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Whether the phone's health app is connected for step counting: asked once when the page opens.
  const [stepsStatus, setStepsStatus] = useState<StepsStatus | 'loading'>('loading');
  useEffect(() => {
    let live = true;
    stepsProvider
      .getStatus()
      .then((st) => live && setStepsStatus(st))
      .catch(() => live && setStepsStatus('unavailable'));
    return () => {
      live = false;
    };
  }, []);

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
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
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
            className="h-11 w-11 items-center justify-center rounded-full border border-white/10 active:opacity-70">
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

        {/* Whose settings these are. Opens the profile editor. */}
        <Pressable
          onPress={() => router.push('/edit-profile')}
          accessibilityRole="button"
          accessibilityLabel={`${user?.name ?? 'Your account'}. Edit your profile`}
          className="mx-5 mt-4 flex-row items-center gap-4 active:opacity-70"
          style={{ paddingVertical: 10 }}>
          <Avatar name={user?.name ?? 'Athlete'} image={user?.image} size={60} />
          <View className="flex-1">
            <Text {...COMPACT_TEXT} className="text-lg font-black text-white" numberOfLines={1}>
              {user?.name}
            </Text>
            <Text {...COMPACT_TEXT} className="mt-0.5 text-sm text-muted" numberOfLines={1}>
              {user?.email}
            </Text>
            <Text {...COMPACT_TEXT} className="mt-0.5 text-xs text-muted" numberOfLines={1}>
              Signed in with {user ? PROVIDER_LABEL[user.provider] : 'email'}
            </Text>
          </View>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={MUTED} size={14} />
        </Pressable>

        <Section title="Daily goals">
          {settings ? (
            <>
              <Stepper
                icon={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }}
                label="Steps"
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
                icon={{ ios: 'drop', android: 'water_drop', web: 'water_drop' }}
                label="Water"
                locked={prescribed.waterMl != null}
                value={settings.waterGoalMl}
                display={formatWater(settings.waterGoalMl)}
                presets={[
                  { label: '2.5 L', value: 2500 },
                  { label: '3 L', value: 3000 },
                  { label: '3.5 L', value: 3500 },
                  { label: '4 L', value: 4000 },
                ]}
                onMinus={() => change({ waterGoalMl: clamp(settings.waterGoalMl - 250, 500, 10000) })}
                onPlus={() => change({ waterGoalMl: clamp(settings.waterGoalMl + 250, 500, 10000) })}
                onSelectPreset={(val) => change({ waterGoalMl: val })}
                minusDisabled={settings.waterGoalMl <= 500}
                plusDisabled={settings.waterGoalMl >= 10000}
              />
              <Stepper
                icon={{ ios: 'dumbbell', android: 'fitness_center', web: 'fitness_center' }}
                label="Workouts"
                locked={prescribed.weeklyWorkouts != null}
                value={settings.weeklyGoal}
                display={`${settings.weeklyGoal} ${settings.weeklyGoal === 1 ? 'day' : 'days'}`}
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
            <Text {...COMPACT_TEXT} className="py-5 text-sm text-muted">
              Goals could not be loaded.
            </Text>
          ) : (
            <View className="items-center py-8">
              <ActivityIndicator color={BRAND} />
            </View>
          )}
        </Section>

        <Section title="Notifications">
          <Row
            icon={{ ios: 'tray', android: 'inbox', web: 'inbox' }}
            title="Inbox"
            value={push.unread > 0 ? `${push.unread} new` : 'All caught up'}
            onPress={() => push.openInbox()}
          />
          {push.status === 'on' ? (
            <Row
              icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
              title="Reminders"
              detail="Workout and plan reminders from your coach."
              toggle={{
                on: push.alertsOn,
                onChange: (on) => void push.setAlerts(on).catch(() => setNotice('Could not change that. Please try again.')),
              }}
              last
            />
          ) : (
            <Row
              icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
              title="Reminders"
              detail={
                push.status === 'denied'
                  ? 'Notifications are turned off for L5 Fitness in your phone settings.'
                  : push.status === 'unavailable'
                    ? 'Not available in this version of the app.'
                    : push.status === 'error'
                      ? 'Something went wrong setting up notifications.'
                      : 'Checking…'
              }
              value={push.status === 'denied' ? 'Open settings' : push.status === 'error' ? 'Try again' : undefined}
              onPress={
                push.status === 'denied'
                  ? () => Linking.openSettings().catch(() => setNotice('Could not open settings.'))
                  : push.status === 'error'
                    ? () => void push.retry()
                    : undefined
              }
              last
            />
          )}
        </Section>

        <Section title="Health and data">
          <Row
            icon={{ ios: 'heart', android: 'favorite', web: 'favorite' }}
            title="Step counting"
            detail={`Reads your steps from ${stepsProvider.sourceName}.`}
            value={STEPS_LABEL[stepsStatus]}
            onPress={stepsStatus === 'unavailable' || stepsStatus === 'loading' ? undefined : () => router.push('/steps')}
          />
          <Row
            icon={{ ios: 'lock', android: 'lock', web: 'lock' }}
            title="Meal photos"
            detail="Stored privately. Only you and your dietitian can see them."
            last
          />
        </Section>

        <Section title="About">
          {PRIVACY_URL ? <Row icon={{ ios: 'hand.raised', android: 'policy', web: 'policy' }} title="Privacy policy" onPress={() => open(PRIVACY_URL)} /> : null}
          {TERMS_URL ? <Row icon={{ ios: 'doc.text', android: 'description', web: 'description' }} title="Terms of service" onPress={() => open(TERMS_URL)} /> : null}
          {SUPPORT_EMAIL ? (
            <Row icon={{ ios: 'envelope', android: 'mail', web: 'mail' }} title="Contact support" value={SUPPORT_EMAIL} onPress={() => open(`mailto:${SUPPORT_EMAIL}`)} />
          ) : null}
          <Row icon={{ ios: 'info.circle', android: 'info', web: 'info' }} title="Version" value={version} last />
        </Section>

        <Section title="Account">
          <Pressable
            onPress={() => setConfirm('logout')}
            accessibilityRole="button"
            accessibilityLabel="Log out"
            className="mt-2 flex-row items-center justify-center rounded-full border active:opacity-70"
            style={{ gap: 10, minHeight: 54, borderColor: 'rgba(255,90,79,0.45)', backgroundColor: 'rgba(255,90,79,0.12)' }}>
            <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} tintColor={RED} size={18} />
            <Text {...COMPACT_TEXT} className="text-base font-black" style={{ color: RED }}>
              Log out
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setConfirm('delete')}
            accessibilityRole="button"
            accessibilityLabel="Delete account. Permanently erases your account and everything in it."
            className="mt-3 flex-row items-center justify-center rounded-full active:opacity-70"
            style={{ gap: 10, minHeight: 54, backgroundColor: RED }}>
            <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} tintColor="#ffffff" size={17} />
            <Text {...COMPACT_TEXT} className="text-base font-black text-white">
              Delete account
            </Text>
          </Pressable>
          <Text {...COMPACT_TEXT} className="mt-2.5 text-center text-xs leading-4 text-muted">
            Deleting permanently erases your account, workouts, meals and photos. This cannot be undone.
          </Text>
        </Section>
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
