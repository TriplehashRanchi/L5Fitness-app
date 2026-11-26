import Constants from 'expo-constants';
import { DisplayText } from '@/components/display-text';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { type IconName } from '@/constants/icons';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { useSettings } from '@/hooks/use-settings';
import { useNotifications } from '@/providers/notifications-provider';
import { AuthError, deleteAccount } from '@/lib/auth-api';
import { messageFrom } from '@/lib/http';
import { getReminders, saveReminders, type Reminders } from '@/lib/progress-api';
import { CONSENT_KEY, CONSENT_ORDER, consentIsOn, exportMyData, getConsents, setConsent, type ConsentPurpose, type Consents } from '@/lib/privacy-api';
import { stepsProvider } from '@/lib/steps/provider';
import type { StepsStatus } from '@/lib/steps/types';
import { formatWater } from '@/lib/water';
import { LanguagePicker } from '@/components/language-picker';
import { useAuth } from '@/providers/auth-provider';
import { useLanguage, useT } from '@/providers/language-provider';
import type { Key } from '@/lib/i18n';

const BRAND = '#3ddc68';
const MUTED = '#8fa396';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const RED = '#ff5a4f';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

// Optional links. Set them in .env to show the rows: they are required by the app stores.
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

/** Google and Apple are brand names, the same in every language. */
const PROVIDER_LABEL = { password: null, google: 'Google', apple: 'Apple' } as const; // i18n-ignore

/** A group of settings: a small heading, then its rows straight on the page, with a thin line above the group. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  // Letter spacing pulls the joined letters of Indian scripts apart.
  const { language } = useLanguage();
  return (
    <View className="px-5" style={{ paddingTop: 22, paddingBottom: 10, borderTopWidth: 1, borderTopColor: HAIRLINE, marginTop: 12 }}>
      <Text {...COMPACT_TEXT} accessibilityRole="header" className="font-bold uppercase text-muted" style={{ fontSize: 12, letterSpacing: language === 'en' ? 1.4 : 0, marginBottom: 6 }}>
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
  const { language, t } = useLanguage();
  const button = (name: 'minus' | 'plus', onPress: () => void, disabled: boolean) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t(name === 'minus' ? 'acc.decrease' : 'acc.increase', { label })}
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
          <View className="mt-0.5 flex-row items-center gap-1.5 pr-1">
            <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} tintColor={MUTED} size={10} />
            <Text {...COMPACT_TEXT} className="shrink text-xs text-muted">
              {t('acc.setByDietitian')}
            </Text>
          </View>
        </View>
        <Text {...COMPACT_TEXT} numberOfLines={1} accessibilityLabel={t('acc.lockedValue', { label, value: display })} className="text-base font-black text-brand">
          {display}
        </Text>
      </View>
    );
  }
  return (
    <View className={`py-4 ${last ? '' : 'border-b border-white/5'}`}>
      <View className="flex-row items-center gap-3">
        <SymbolView name={icon} tintColor={MUTED} size={18} />
        <Text {...COMPACT_TEXT} className="flex-1 text-base font-semibold text-white" numberOfLines={language === 'en' ? 1 : 2}>
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
                accessibilityLabel={t('acc.setTo', { label, value: p.label })}
                className={`flex-1 items-center justify-center rounded-full border ${isSelected ? 'border-brand bg-brand' : 'border-white/10'} active:opacity-70`}
                style={{ minHeight: 32 }}>
                <Text {...COMPACT_TEXT} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} className={`text-xs font-bold ${isSelected ? 'text-ink' : 'text-muted'}`}>
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
  // Indian text is longer and taller: it may take more lines, with more room between them.
  const english = useLanguage().language === 'en';
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
        <Text {...COMPACT_TEXT} className="text-base font-semibold" style={{ color }} numberOfLines={english ? 1 : 2}>
          {title}
        </Text>
        {detail ? (
          <Text {...COMPACT_TEXT} className={`mt-0.5 text-xs text-muted ${english ? 'leading-4' : 'leading-5'}`} numberOfLines={english ? 2 : undefined}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text {...COMPACT_TEXT} className="text-right text-sm font-medium text-muted" numberOfLines={english ? 1 : 2} style={{ maxWidth: '45%' }}>
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

const STEPS_KEY: Record<StepsStatus | 'loading', Key> = {
  loading: 'acc.stepsChecking',
  ready: 'acc.stepsConnected',
  'needs-permission': 'acc.stepsNotConnected',
  'needs-setup': 'acc.stepsNeedsSetup',
  unavailable: 'acc.notAvailable',
};

export default function SettingsScreen() {
  const t = useT();
  const { language } = useLanguage();
  const { format } = useDeviceClock();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const { settings, prescribed, error, saving, change } = useSettings();
  const push = useNotifications();

  const [confirm, setConfirm] = useState<'logout' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // What the member agreed to, purpose by purpose, and a copy of their data.
  const [consents, setConsents] = useState<Consents | null>(null);
  const [consentBusy, setConsentBusy] = useState<ConsentPurpose | null>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    let live = true;
    getConsents()
      .then((c) => live && setConsents(c))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const changeConsent = async (purpose: ConsentPurpose, on: boolean) => {
    setConsentBusy(purpose);
    setNotice(null);
    try {
      setConsents(await setConsent(purpose, on));
    } catch (e) {
      setNotice(messageFrom(e));
    } finally {
      setConsentBusy(null);
    }
  };
  const downloadMyData = async () => {
    setExporting(true);
    setNotice(null);
    try {
      const data = await exportMyData();
      await Share.share({ title: t('acc.myData'), message: JSON.stringify(data, null, 2) });
    } catch (e) {
      setNotice(messageFrom(e));
    } finally {
      setExporting(false);
    }
  };

  // Quiet hours and snooze: pushes are held back (they still wait in the inbox). The phone's own clock is used.
  const [reminders, setReminders] = useState<Reminders | null>(null);
  useEffect(() => {
    let live = true;
    getReminders()
      .then((r) => live && setReminders(r))
      .catch(() => {});
    // Tell the server this phone's offset from UTC so "10 pm" means 10 pm here.
    saveReminders({ utcOffsetMin: -new Date().getTimezoneOffset() }).catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const changeReminders = async (change: Parameters<typeof saveReminders>[0]) => {
    setNotice(null);
    try {
      setReminders(await saveReminders(change));
    } catch (e) {
      setNotice(messageFrom(e));
    }
  };
  const quiet = reminders && reminders.quietStart != null && reminders.quietEnd != null;
  const snoozing = !!reminders?.snoozeUntil && new Date(reminders.snoozeUntil) > new Date();
  /** 1320 -> "10:00 pm" */
  const clock = (minutes: number) => {
    const d = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
    return d.toLocaleTimeString(format.locale, { hour: 'numeric', minute: '2-digit' });
  };
  const moveMinutes = (which: 'quietStart' | 'quietEnd', delta: number) => {
    if (!reminders || reminders.quietStart == null || reminders.quietEnd == null) return;
    const next = (reminders[which]! + delta + 1440) % 1440;
    const start = which === 'quietStart' ? next : reminders.quietStart;
    const end = which === 'quietEnd' ? next : reminders.quietEnd;
    if (start === end) return;
    void changeReminders({ quietStart: start, quietEnd: end });
  };

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
      setNotice(t('acc.logOutFailed'));
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

  const open = (url: string) => Linking.openURL(url).catch(() => setNotice(t('acc.linkFailed')));

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
            accessibilityLabel={t('common.back')}
            className="h-11 w-11 items-center justify-center rounded-full border border-white/10 active:opacity-70">
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
          </Pressable>
          <DisplayText className="flex-1 text-[30px] font-bold tracking-tight text-white">{t('settings.title')}</DisplayText>
          {saving ? (
            <View className="flex-row items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1">
              <ActivityIndicator color={BRAND} size="small" />
              <Text {...COMPACT_TEXT} className="text-xs font-bold text-brand">
                {t('acc.saving')}
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
          accessibilityLabel={t('acc.editYourProfile', { name: user?.name ?? t('acc.yourAccount') })}
          className="mx-5 mt-4 flex-row items-center gap-4 active:opacity-70"
          style={{ paddingVertical: 10 }}>
          <Avatar name={user?.name ?? t('activity.very_active')} image={user?.image} size={60} />
          <View className="flex-1">
            <Text {...COMPACT_TEXT} className="text-lg font-black text-white" numberOfLines={1}>
              {user?.name}
            </Text>
            <Text {...COMPACT_TEXT} className="mt-0.5 text-sm text-muted" numberOfLines={1}>
              {user?.email}
            </Text>
            <Text {...COMPACT_TEXT} className="mt-0.5 text-xs text-muted" numberOfLines={language === 'en' ? 1 : 2}>
              {user ? t('acc.signedInWith', { provider: PROVIDER_LABEL[user.provider] ?? t('acc.signInPassword') }) : t('acc.signedInEmail')}
            </Text>
          </View>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor={MUTED} size={14} />
        </Pressable>

        <Section title={t('lang.title')}>
          <Text {...COMPACT_TEXT} className={`mb-3 text-xs text-muted ${language === 'en' ? 'leading-4' : 'leading-5'}`}>
            {t('lang.detail')}
          </Text>
          <LanguagePicker />
        </Section>

        <Section title={t('acc.dailyGoals')}>
          {settings ? (
            <>
              <Stepper
                icon={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }}
                label={t('acc.steps')}
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
                label={t('acc.water')}
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
                label={t('acc.workouts')}
                locked={prescribed.weeklyWorkouts != null}
                value={settings.weeklyGoal}
                display={t(settings.weeklyGoal === 1 ? 'acc.daysOne' : 'acc.daysMany', { n: settings.weeklyGoal })}
                presets={[3, 4, 5, 6].map((n) => ({ label: t('acc.daysMany', { n }), value: n }))}
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
              {t('acc.goalsFailed')}
            </Text>
          ) : (
            <View className="items-center py-8">
              <ActivityIndicator color={BRAND} />
            </View>
          )}
        </Section>

        <Section title={t('acc.notifications')}>
          <Row
            icon={{ ios: 'tray', android: 'inbox', web: 'inbox' }}
            title={t('acc.inbox')}
            value={push.unread > 0 ? t('acc.unread', { n: push.unread }) : t('acc.allCaughtUp')}
            onPress={() => push.openInbox()}
          />
          {push.status === 'on' ? (
            <Row
              icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
              title={t('acc.reminders')}
              detail={t('acc.remindersDetail')}
              toggle={{
                on: push.alertsOn,
                onChange: (on) => void push.setAlerts(on).catch(() => setNotice(t('acc.changeFailed'))),
              }}
              last
            />
          ) : (
            <Row
              icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
              title={t('acc.reminders')}
              detail={
                push.status === 'denied'
                  ? t('acc.pushDenied')
                  : push.status === 'unavailable'
                    ? t('acc.pushUnavailable')
                    : push.status === 'error'
                      ? t('acc.pushError')
                      : t('acc.checking')
              }
              value={push.status === 'denied' ? t('acc.openSettings') : push.status === 'error' ? t('common.tryAgain') : undefined}
              onPress={
                push.status === 'denied'
                  ? () => Linking.openSettings().catch(() => setNotice(t('acc.settingsFailed')))
                  : push.status === 'error'
                    ? () => void push.retry()
                    : undefined
              }
              last
            />
          )}
        </Section>

        <Section title={t('settings.quietHours')}>
          <Row
            icon={{ ios: 'moon', android: 'bedtime', web: 'bedtime' }}
            title={t('settings.quietHours')}
            detail={t('acc.quietDetail')}
            toggle={{ on: !!quiet, onChange: (on) => void changeReminders(on ? { quietStart: 1320, quietEnd: 420 } : { quietStart: null, quietEnd: null }), disabled: !reminders }}
            last={!quiet}
          />
          {quiet && reminders ? (
            <>
              <Stepper
                icon={{ ios: 'moon.stars', android: 'nightlight', web: 'nightlight' }}
                label={t('acc.from')}
                value={reminders.quietStart!}
                display={clock(reminders.quietStart!)}
                onMinus={() => moveMinutes('quietStart', -30)}
                onPlus={() => moveMinutes('quietStart', 30)}
                minusDisabled={false}
                plusDisabled={false}
              />
              <Stepper
                icon={{ ios: 'sun.max', android: 'wb_sunny', web: 'wb_sunny' }}
                label={t('acc.until')}
                value={reminders.quietEnd!}
                display={clock(reminders.quietEnd!)}
                onMinus={() => moveMinutes('quietEnd', -30)}
                onPlus={() => moveMinutes('quietEnd', 30)}
                minusDisabled={false}
                plusDisabled={false}
                last
              />
            </>
          ) : null}
          <Row
            icon={{ ios: 'bell.slash', android: 'notifications_paused', web: 'notifications_paused' }}
            title={snoozing ? t('acc.snoozed') : t('acc.snooze')}
            detail={snoozing ? t('acc.snoozedUntil', { time: new Date(reminders!.snoozeUntil!).toLocaleTimeString(format.locale, { hour: 'numeric', minute: '2-digit' }) }) : t('acc.snoozeDetail')}
            onPress={() => void changeReminders({ snoozeHours: snoozing ? null : 8 })}
            last
          />
        </Section>

        <Section title={t('settings.health')}>
          <Row
            icon={{ ios: 'heart', android: 'favorite', web: 'favorite' }}
            title={t('acc.stepCounting')}
            // Apple Health and Health Connect are names; anything else is "your health app".
            detail={/^(Apple Health|Health Connect)$/.test(stepsProvider.sourceName) ? t('acc.readsSteps', { source: stepsProvider.sourceName }) : t('acc.readsStepsApp')}
            value={t(STEPS_KEY[stepsStatus])}
            onPress={stepsStatus === 'unavailable' || stepsStatus === 'loading' ? undefined : () => router.push('/steps')}
          />
          <Row
            icon={{ ios: 'lock', android: 'lock', web: 'lock' }}
            title={t('acc.mealPhotos')}
            detail={t('acc.mealPhotosDetail')}
            last
          />
        </Section>

        <Section title={t('settings.privacy')}>
          {consents
            ? CONSENT_ORDER.map((purpose) => (
                <Row
                  key={purpose}
                  icon={{ ios: 'checkmark.shield', android: 'verified_user', web: 'verified_user' }}
                  title={t(CONSENT_KEY[purpose].title)}
                  detail={t(CONSENT_KEY[purpose].detail)}
                  toggle={{ on: consentIsOn(purpose, consents.consents[purpose]), onChange: (on) => void changeConsent(purpose, on), disabled: consentBusy !== null }}
                />
              ))
            : null}
          <Row
            icon={{ ios: 'square.and.arrow.down', android: 'download', web: 'download' }}
            title={exporting ? t('acc.preparing') : t('acc.download')}
            detail={t('acc.downloadDetail')}
            onPress={exporting ? undefined : () => void downloadMyData()}
            last
          />
        </Section>

        <Section title={t('settings.about')}>
          {PRIVACY_URL ? <Row icon={{ ios: 'hand.raised', android: 'policy', web: 'policy' }} title={t('acc.privacyPolicy')} onPress={() => open(PRIVACY_URL)} /> : null}
          {TERMS_URL ? <Row icon={{ ios: 'doc.text', android: 'description', web: 'description' }} title={t('acc.terms')} onPress={() => open(TERMS_URL)} /> : null}
          {SUPPORT_EMAIL ? (
            <Row icon={{ ios: 'envelope', android: 'mail', web: 'mail' }} title={t('acc.support')} value={SUPPORT_EMAIL} onPress={() => open(`mailto:${SUPPORT_EMAIL}`)} />
          ) : null}
          <Row icon={{ ios: 'info.circle', android: 'info', web: 'info' }} title={t('acc.version')} value={version} last />
        </Section>

        <Section title={t('settings.account')}>
          <Pressable
            onPress={() => setConfirm('logout')}
            accessibilityRole="button"
            accessibilityLabel={t('settings.logout')}
            className="mt-2 flex-row items-center justify-center rounded-full border active:opacity-70"
            style={{ gap: 10, minHeight: 54, paddingHorizontal: 16, paddingVertical: 8, borderColor: 'rgba(255,90,79,0.45)', backgroundColor: 'rgba(255,90,79,0.12)' }}>
            <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} tintColor={RED} size={18} />
            <Text {...COMPACT_TEXT} className="shrink text-center text-base font-black" style={{ color: RED }}>
              {t('settings.logout')}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setConfirm('delete')}
            accessibilityRole="button"
            accessibilityLabel={t('acc.deleteA11y')}
            className="mt-3 flex-row items-center justify-center rounded-full active:opacity-70"
            style={{ gap: 10, minHeight: 54, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: RED }}>
            <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} tintColor="#ffffff" size={17} />
            <Text {...COMPACT_TEXT} className="shrink text-center text-base font-black text-white">
              {t('settings.deleteAccount')}
            </Text>
          </Pressable>
          <Text {...COMPACT_TEXT} className={`mt-2.5 text-center text-xs text-muted ${language === 'en' ? 'leading-4' : 'leading-5'}`}>
            {t('acc.deleteNote')}
          </Text>
        </Section>
      </ScrollView>

      {/* Confirmation Sheets */}
      <ConfirmSheet
        visible={confirm === 'logout'}
        title={t('acc.logOutTitle')}
        message={t('acc.logOutBody')}
        confirmLabel={t('acc.logOutConfirm')}
        busy={busy}
        onConfirm={logOut}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        visible={confirm === 'delete'}
        title={t('acc.deleteTitle')}
        message={t('acc.deleteBody')}
        confirmLabel={t('acc.deleteConfirm')}
        destructive
        busy={busy}
        onConfirm={removeAccount}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}
