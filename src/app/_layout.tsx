import '@/global.css';

import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { SplashOverlay } from '@/components/splash-overlay';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ProfileProvider, useProfile } from '@/providers/profile-provider';

// Keep the native splash up until we know which screen to show (no flash of the wrong screen).
SplashScreen.preventAutoHideAsync();

const INK = '#0b0b0d';
const BRAND = '#c6f432';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: INK, card: INK },
};

/** Between login and the app: finding out whether this member has finished the setup questions. */
function ProfileGate() {
  const { status, error, reload } = useProfile();
  const { signOut } = useAuth();
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-ink px-8">
      {status === 'error' ? (
        <>
          <Text className="text-center text-base font-bold text-white">We could not load your account</Text>
          <Text className="text-center text-sm text-muted">{error}</Text>
          <Pressable onPress={reload} accessibilityRole="button" className="mt-2 rounded-full bg-brand px-8 py-3 active:opacity-80">
            <Text className="font-bold text-ink">Try again</Text>
          </Pressable>
          <Pressable onPress={() => signOut()} hitSlop={10} accessibilityRole="button" className="py-2 active:opacity-60">
            <Text className="text-sm font-semibold text-muted">Log out</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color={BRAND} size="large" />
      )}
    </View>
  );
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
          {/* Logged out: intro → login. */}
          <Stack.Protected guard={!loggedIn && !hasOnboarded}>
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={!loggedIn && hasOnboarded}>
            <Stack.Screen name="login" options={{ animation: 'fade' }} />
          </Stack.Protected>
          {/* Logged in, first time: the setup questions. */}
          <Stack.Protected guard={loggedIn && status === 'needed'}>
            <Stack.Screen name="setup" options={{ animation: 'fade' }} />
          </Stack.Protected>
          {/* Logged in and set up: the app. */}
          <Stack.Protected guard={loggedIn && status === 'ready'}>
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="explore" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="edit-profile" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="client/[id]" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="add-meal" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack.Protected>
        </Stack>
      )}
      <SplashOverlay />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <RootNavigator />
      </ProfileProvider>
    </AuthProvider>
  );
}
