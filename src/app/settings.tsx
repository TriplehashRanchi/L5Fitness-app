import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { useSettings } from '@/hooks/use-settings';
import { AuthError, deleteAccount } from '@/lib/auth-api';
import { messageFrom } from '@/lib/http';
import { formatWater } from '@/lib/water';
import { useAuth } from '@/providers/auth-provider';

const BRAND = '#c6f432';
const MUTED = '#9ba2ac';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

// Optional links. Set them in .env to show the rows: they are required by the app stores.
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

const PROVIDER_LABEL = { password: 'Email and password', google: 'Google', apple: 'Apple' } as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-7 px-5">
      <Text {...COMPACT_TEXT} className="mb-2 px-1 text-xs font-bold uppercase tracking-[1px] text-muted">
        {title}
      </Text>
      <View className="overflow-hidden rounded-3xl border border-white/5 bg-card">{children}</View>
    </View>
  );
}

function Stepper({
  label,
  value,
  display,
  onMinus,
  onPlus,
  minusDisabled,
  plusDisabled,
  last,
}: {
  label: string;
  value: number;
  display: string;
  onMinus: () => void;
  onPlus: () => void;
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
      className={`h-10 w-10 items-center justify-center rounded-full bg-card-2 active:opacity-70 ${disabled ? 'opacity-30' : ''}`}>
      <SymbolView
        name={name === 'minus' ? { ios: 'minus', android: 'remove', web: 'remove' } : { ios: 'plus', android: 'add', web: 'add' }}
        tintColor="white"
        size={16}
      />
    </Pressable>
  );
  return (
    <View className={`flex-row items-center gap-3 px-5 py-4 ${last ? '' : 'border-b border-white/5'}`}>
      <Text {...COMPACT_TEXT} className="flex-1 text-base font-semibold text-white">
        {label}
      </Text>
      {button('minus', onMinus, minusDisabled)}
      <Text
        {...COMPACT_TEXT}
        accessibilityLabel={`${label}: ${display}`}
        data-value={value}
        className="min-w-[84px] text-center text-base font-bold text-brand">
        {display}
      </Text>
      {button('plus', onPlus, plusDisabled)}
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
      <Text {...COMPACT_TEXT} className="flex-1 text-base text-white">
        {title}
      </Text>
      {value ? (
        <Text {...COMPACT_TEXT} className="text-sm text-muted">
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
  const { settings, error, saving, change } = useSettings();

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
    // On success the app switches to the login screen by itself.
  };

  const removeAccount = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await deleteAccount();
      // Signing-in is gone, so the app returns to the start screen by itself.
    } catch (e) {
      setBusy(false);
      setConfirm(null);
      setNotice(e instanceof AuthError ? e.message : messageFrom(e));
    }
  };

  const open = (url: string) => Linking.openURL(url).catch(() => setNotice('Could not open that link.'));

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: 840, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-3 px-5 pb-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-70">
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
          </Pressable>
          <Text className="flex-1 text-[30px] font-bold tracking-tight text-white">Settings</Text>
          {saving ? <ActivityIndicator color={BRAND} size="small" /> : null}
        </View>

        {notice || error ? (
          <View accessibilityRole="alert" className="mx-5 mt-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm text-white">{notice ?? error}</Text>
          </View>
        ) : null}

        <Text className="mt-3 px-5 text-sm leading-5 text-muted">Small changes. Better daily habits.</Text>

        {/* Profile */}
        <View className="mx-5 mt-5 flex-row items-center gap-4 rounded-3xl border border-white/5 bg-card p-5">
          <Avatar name={user?.name ?? 'Athlete'} image={user?.image} size={68} />
          <View className="flex-1">
            <Text className="text-lg font-bold text-white" numberOfLines={1}>
              {user?.name}
            </Text>
            <Text {...COMPACT_TEXT} className="mt-0.5 text-sm text-muted" numberOfLines={1}>
              {user?.email}
            </Text>
            <Text {...COMPACT_TEXT} className="mt-1 text-xs text-muted">
              Signed in with {user ? PROVIDER_LABEL[user.provider] : ''}
            </Text>
          </View>
        </View>

        {/* Goals */}
        <Section title="Daily goals">
          {settings ? (
            <>
              <Stepper
                label="Steps"
                value={settings.stepGoal}
                display={settings.stepGoal.toLocaleString()}
                onMinus={() => change({ stepGoal: clamp(settings.stepGoal - 500, 1000, 100000) })}
                onPlus={() => change({ stepGoal: clamp(settings.stepGoal + 500, 1000, 100000) })}
                minusDisabled={settings.stepGoal <= 1000}
                plusDisabled={settings.stepGoal >= 100000}
              />
              <Stepper
                label="Water"
                value={settings.waterGoalMl}
                display={formatWater(settings.waterGoalMl)}
                onMinus={() => change({ waterGoalMl: clamp(settings.waterGoalMl - 250, 500, 10000) })}
                onPlus={() => change({ waterGoalMl: clamp(settings.waterGoalMl + 250, 500, 10000) })}
                minusDisabled={settings.waterGoalMl <= 500}
                plusDisabled={settings.waterGoalMl >= 10000}
              />
              <Stepper
                label="Weekly workouts"
                value={settings.weeklyGoal}
                display={String(settings.weeklyGoal)}
                onMinus={() => change({ weeklyGoal: clamp(settings.weeklyGoal - 1, 1, 7) })}
                onPlus={() => change({ weeklyGoal: clamp(settings.weeklyGoal + 1, 1, 7) })}
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

        {/* Data */}
        <Section title="Your data">
          <Row title="Steps" value="Read on this phone only" />
          <Row title="Meal photos" value="Stored privately in your account" last />
        </Section>

        {/* About: links appear only when they are set in .env */}
        <Section title="About">
          {PRIVACY_URL ? <Row title="Privacy policy" onPress={() => open(PRIVACY_URL)} /> : null}
          {TERMS_URL ? <Row title="Terms of use" onPress={() => open(TERMS_URL)} /> : null}
          {SUPPORT_EMAIL ? <Row title="Contact support" value={SUPPORT_EMAIL} onPress={() => open(`mailto:${SUPPORT_EMAIL}`)} /> : null}
          <Row title="Version" value={version} last />
        </Section>

        {/* Account */}
        <View className="mt-7 gap-3 px-5">
          <Pressable
            onPress={() => setConfirm('logout')}
            accessibilityRole="button"
            className="items-center rounded-full border border-white/15 bg-card py-4 active:opacity-70">
            <Text {...COMPACT_TEXT} className="text-base font-bold text-white">
              Log out
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setConfirm('delete')}
            accessibilityRole="button"
            className="items-center rounded-full py-4 active:opacity-70">
            <Text {...COMPACT_TEXT} className="text-base font-bold text-accent">
              Delete account
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={confirm === 'logout'}
        title="Log out?"
        message="You will need to log in again to see your workouts, meals and steps."
        confirmLabel="Log out"
        busy={busy}
        onConfirm={logOut}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        visible={confirm === 'delete'}
        title="Delete your account?"
        message="This permanently erases your workouts, meals, meal photos, water logs and goals, and removes your login. It cannot be undone."
        confirmLabel="Delete everything"
        destructive
        busy={busy}
        onConfirm={removeAccount}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}
