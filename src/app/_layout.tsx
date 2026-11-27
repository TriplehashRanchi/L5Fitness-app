import '@/global.css';

import { DarkTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { NotificationsPanel } from '@/components/notifications-panel';
import { SplashOverlay } from '@/components/splash-overlay';
import { checkPendingPhoto } from '@/lib/pending-photo';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { LanguageProvider, useT } from '@/providers/language-provider';
import { NotificationsProvider } from '@/providers/notifications-provider';
import { OutboxProvider } from '@/providers/outbox-provider';
import { ProfileProvider, useProfile } from '@/providers/profile-provider';

// Keep the native splash up until we know which screen to show (no flash of the wrong screen).
SplashScreen.preventAutoHideAsync();

const INK = '#050a07'; // = GREEN_BG
const BRAND = '#3ddc68';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: INK, card: INK },
};

/** Between login and the app: finding out whether this member has finished the setup questions. */
function ProfileGate() {
  const t = useT();
  const { status, error, reload } = useProfile();
  const { signOut } = useAuth();
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-ink px-8">
      {status === 'error' ? (
        <>
          <Text className="text-center text-base font-bold text-white">{t('acc.accountLoadFailed')}</Text>
          <Text className="text-center text-sm text-muted">{error}</Text>
          <Pressable onPress={reload} accessibilityRole="button" className="mt-2 rounded-full bg-brand px-8 py-3 active:opacity-80">
            <Text className="font-bold text-ink">{t('common.tryAgain')}</Text>
          </Pressable>
          <Pressable onPress={() => signOut()} hitSlop={10} accessibilityRole="button" className="py-2 active:opacity-60">
            <Text className="text-sm font-semibold text-muted">{t('settings.logout')}</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color={BRAND} size="large" />
      )}
    </View>
  );
}

/**
 * Android can close the app while its camera is open for a meal photo. When the app starts again and
 * such a photo is waiting, this opens Add meal again, where the photo is put in (see lib/pending-photo).
 */
function PendingPhoto() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    void checkPendingPhoto().then((found) => {
      if (found && pathname !== '/add-meal') router.push('/add-meal');
    });
    // Once, when the app has started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function RootNavigator() {
  const { isReady, hasOnboarded, session } = useAuth();
  const { status } = useProfile();

  if (!isReady) return null;

  const loggedIn = !!session;
  // Logged in, but we do not yet know whether setup is done (or could not find out).
  const waiting = loggedIn && (status === 'loading' || status === 'error');

  return (
    <ThemeProvider value={theme}>
      {waiting ? (
        <ProfileGate />
      ) : (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: INK } }}>
          {/* Every screen file in src/app must be listed in one of these groups. A file left out is open to
              everyone, so someone who is logged out can get stuck on it (scripts/check-routes.mjs checks this). */}
          {/* Logged out: intro → login. */}
          <Stack.Protected guard={!loggedIn && !hasOnboarded}>
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} /> {/* i18n-ignore: a route name */}
          </Stack.Protected>
          <Stack.Protected guard={!loggedIn && hasOnboarded}>
            <Stack.Screen name="login" options={{ animation: 'fade' }} /> {/* i18n-ignore: a route name */}
          </Stack.Protected>
          {/* Logged in, first time: the setup questions. */}
          <Stack.Protected guard={loggedIn && status === 'needed'}>
            <Stack.Screen name="setup" options={{ animation: 'fade' }} /> {/* i18n-ignore: a route name */}
          </Stack.Protected>
          {/* Logged in and set up: the app. */}
          <Stack.Protected guard={loggedIn && status === 'ready'}>
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="today-plan" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="steps" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="explore" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="complete-profile" options={{ animation: 'slide_from_bottom' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="client/[id]" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="chat/[id]" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="chat/admin" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="ai" options={{ animation: 'slide_from_bottom' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="add-meal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="week" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="report/[days]" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="calls" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="check-in" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="community" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="family" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="measures" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
            <Stack.Screen name="milestones" options={{ animation: 'slide_from_right' }} /> {/* i18n-ignore: a route name */}
          </Stack.Protected>
        </Stack>
      )}
      {loggedIn && status === 'ready' ? <NotificationsPanel /> : null}
      {loggedIn && status === 'ready' ? <PendingPhoto /> : null}
      <SplashOverlay />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <OutboxProvider>
          <ProfileProvider>
            <NotificationsProvider>
              <RootNavigator />
            </NotificationsProvider>
          </ProfileProvider>
        </OutboxProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
