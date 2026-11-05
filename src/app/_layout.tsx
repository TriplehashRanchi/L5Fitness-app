import '@/global.css';

import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { SplashOverlay } from '@/components/splash-overlay';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

// Keep the native splash up until we know which screen to show (no flash of the wrong screen).
SplashScreen.preventAutoHideAsync();

const INK = '#0b0b0d';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: INK, card: INK },
};

function RootNavigator() {
  const { isReady, hasOnboarded, session } = useAuth();

  if (!isReady) return null;

  const loggedIn = !!session;

  return (
    <ThemeProvider value={theme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: INK } }}>
        {/* Every start while logged out → onboarding → login. Logged in → straight to the app. */}
        <Stack.Protected guard={!loggedIn && !hasOnboarded}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={!loggedIn && hasOnboarded}>
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={loggedIn}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
      <SplashOverlay />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
