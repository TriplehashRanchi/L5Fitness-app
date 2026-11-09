import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { AuthCancelled, AuthError } from '@/lib/auth-api';
import { useAuth } from '@/providers/auth-provider';

type Mode = 'login' | 'signup';
type Errors = Partial<Record<'name' | 'email' | 'password', string>>;

const INK = '#0b0b0d';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

function validate(mode: Mode, name: string, email: string, password: string): Errors {
  const errors: Errors = {};
  if (mode === 'signup' && name.trim().length < 2) errors.name = 'Enter your full name';
  if (!EMAIL_RE.test(email.trim())) errors.email = 'Enter a valid email address';
  if (mode === 'signup' && password.length < MIN_PASSWORD)
    errors.password = `Use at least ${MIN_PASSWORD} characters`;
  if (mode === 'login' && !password) errors.password = 'Enter your password';
  return errors;
}

function GoogleMark() {
  // Official Google "G" (from Google's sign-in assets), 20pt as the branding guidelines ask.
  return (
    <Image
      source={require('@/assets/images/google-g.png')}
      style={{ width: 20, height: 20 }}
      accessibilityIgnoresInvertColors
    />
  );
}

function AppleMark() {
  // iOS: Apple's own system glyph. Android / web: the same logo as an image.
  return (
    <SymbolView
      name={{ ios: 'apple.logo' }}
      size={20}
      tintColor="#000000"
      fallback={
        <Image
          source={require('@/assets/images/apple-logo.png')}
          style={{ width: 20, height: 20 }}
          accessibilityIgnoresInvertColors
        />
      }
    />
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | null>(null);

  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const isSignup = mode === 'signup';

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
  };

  const run = async (kind: 'email' | 'google' | 'apple', action: () => Promise<void>) => {
    setBusy(kind);
    try {
      await action();
      // On success the root layout switches to the app automatically.
    } catch (e) {
      setBusy(null);
      // Closing the Google sheet is a change of mind, not a failure: no pop-up.
      if (e instanceof AuthCancelled) return;
      const message = e instanceof AuthError ? e.message : 'Something went wrong. Please try again.';
      Alert.alert(isSignup ? 'Sign up failed' : 'Login failed', message);
    }
  };

  const onSubmit = () => {
    const found = validate(mode, name, email, password);
    setErrors(found);
    if (Object.keys(found).length) return;
    run('email', () =>
      isSignup ? signUp(name.trim(), email.trim(), password) : signIn(email.trim(), password)
    );
  };

  const onGoogle = () => run('google', signInWithGoogle);
  const onApple = () => run('apple', signInWithApple);

  const onForgot = () =>
    Alert.alert('Reset password', 'Password reset will be available soon. Please contact the gym desk.');

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />

      {/* Expo apps are edge-to-edge on Android too, so both platforms need padding. */}
      <KeyboardAvoidingView className="flex-1" behavior="padding">
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: insets.bottom + 24,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          }}>
          {/* Header photo, fading into the background */}
          <View className="h-80 overflow-hidden">
            <Image
              source={require('@/assets/onboarding/slide-1.jpg')}
              contentFit="cover"
              contentPosition={{ top: '18%' }}
              style={StyleSheet.absoluteFill}
              accessibilityIgnoresInvertColors
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.55)', 'rgba(11,11,13,0.25)', 'rgba(11,11,13,0.85)', INK]}
              locations={[0, 0.35, 0.75, 1]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View className="flex-1 justify-between px-6 pb-2" style={{ paddingTop: insets.top + 8 }}>
              <View className="flex-row items-center gap-2.5">
                <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-brand">
                  <Text maxFontSizeMultiplier={1.1} className="text-[13px] font-black text-ink">
                    L5
                  </Text>
                </View>
                <Text
                  maxFontSizeMultiplier={1.1}
                  className="text-[13px] font-black tracking-[3px] text-white">
                  FITNESS
                </Text>
              </View>
              <View>
                <Text maxFontSizeMultiplier={1.2} className="text-[34px] font-black leading-[40px] tracking-tight text-white">
                  {isSignup ? 'Create your\n' : 'Welcome\n'}
                  <Text className="text-brand">{isSignup ? 'account.' : 'back.'}</Text>
                </Text>
                <Text maxFontSizeMultiplier={1.3} className="mt-2 text-sm text-white/65">
                  {isSignup ? 'Start your fitness journey today' : 'Log in to continue your training'}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex-1 gap-5 px-6 pt-6">
            {/* Form */}
            <View className="gap-4">
              {isSignup ? (
                <TextField
                  label="Full name"
                  icon={{ ios: 'person', android: 'person', web: 'person' }}
                  placeholder="Your name"
                  value={name}
                  onChangeText={setName}
                  error={errors.name}
                  autoComplete="name"
                  textContentType="name"
                  autoCapitalize="words"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              ) : null}
              <TextField
                ref={emailRef}
                label="Email"
                icon={{ ios: 'envelope', android: 'mail', web: 'mail' }}
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                keyboardType="email-address"
                autoComplete="email"
                textContentType={isSignup ? 'emailAddress' : 'username'}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              <TextField
                ref={passwordRef}
                secure
                label="Password"
                icon={{ ios: 'lock', android: 'lock', web: 'lock' }}
                placeholder={isSignup ? `Min. ${MIN_PASSWORD} characters` : 'Your password'}
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                textContentType={isSignup ? 'newPassword' : 'password'}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />
              {!isSignup ? (
                <Pressable onPress={onForgot} hitSlop={8} className="self-end active:opacity-60">
                  <Text maxFontSizeMultiplier={1.3} className="text-sm font-semibold text-brand">
                    Forgot password?
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Button
              title={isSignup ? 'Create account' : 'Log in'}
              onPress={onSubmit}
              loading={busy === 'email'}
              disabled={busy !== null}
            />

            {/* Divider */}
            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-white/10" />
              <Text maxFontSizeMultiplier={1.3} className="text-xs text-muted">
                or continue with
              </Text>
              <View className="h-px flex-1 bg-white/10" />
            </View>

            {/* Google + Apple side by side */}
            <View className="flex-row gap-3">
              <Button
                variant="google"
                title="Google"
                className="flex-1"
                accessibilityLabel="Continue with Google"
                left={<GoogleMark />}
                onPress={onGoogle}
                loading={busy === 'google'}
                disabled={busy !== null}
              />
              <Button
                variant="apple"
                title="Apple"
                className="flex-1"
                accessibilityLabel="Continue with Apple"
                left={<AppleMark />}
                onPress={onApple}
                loading={busy === 'apple'}
                disabled={busy !== null}
              />
            </View>

            <View className="mt-auto flex-row flex-wrap justify-center pt-2">
              <Text className="text-sm text-muted">
                {isSignup ? 'Already a member? ' : 'New to L5 Fitness? '}
              </Text>
              <Pressable onPress={() => switchMode(isSignup ? 'login' : 'signup')} hitSlop={8}>
                <Text className="text-sm font-bold text-brand">{isSignup ? 'Log in' : 'Sign up'}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
