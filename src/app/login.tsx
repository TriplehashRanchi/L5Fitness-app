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
  Text,
  View,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayText } from '@/components/display-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { AuthCancelled, AuthError } from '@/lib/auth-api';
import { splitHighlight, type Key } from '@/lib/i18n';
import { useAuth } from '@/providers/auth-provider';
import { useLanguage } from '@/providers/language-provider';

type Mode = 'login' | 'signup';
/** What is wrong with each field, as word keys: translated when drawn, so they follow the language. */
type Errors = Partial<Record<'name' | 'email' | 'password', Key>>;

// Same palette as onboarding.
const BRAND = '#3ddc68';
const DIVIDER = 'rgba(255,255,255,0.12)';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_PASSWORD = 8;

function validate(mode: Mode, name: string, email: string, password: string): Errors {
  const errors: Errors = {};
  if (mode === 'signup' && name.trim().length < 2) errors.name = 'acc.nameError';
  if (!EMAIL_RE.test(email.trim())) errors.email = 'acc.emailError';
  if (mode === 'signup' && password.length < MIN_PASSWORD) errors.password = 'acc.passwordShort';
  if (mode === 'login' && !password) errors.password = 'acc.passwordMissing';
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
  const { language, t } = useLanguage();
  const english = language === 'en';
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
      const message = e instanceof AuthError ? e.message : t('acc.wrong');
      Alert.alert(t(isSignup ? 'acc.signUpFailed' : 'acc.loginFailed'), message);
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
    Alert.alert(t('acc.resetTitle'), t('acc.resetBody'));

  return (
    <View className="flex-1" style={{ backgroundColor: '#050a07' }}>
      <StatusBar style="light" />
      {/* Background from the design reference: near-black with a soft green haze at the top and a fainter one at the bottom */}
      <LinearGradient
        colors={['rgba(46,120,68,0.32)', 'rgba(46,120,68,0.1)', 'rgba(46,120,68,0)']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 420 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(24,80,42,0)', 'rgba(24,80,42,0.28)']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 300 }}
        pointerEvents="none"
      />

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
          <View className="px-6" style={{ paddingTop: insets.top + 28 }}>
            {/* The headline never waits for its font: DisplayText swaps it in once loaded. */}
            <DisplayText
              maxFontSizeMultiplier={1.1}
              numberOfLines={english ? 2 : 3}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{ fontWeight: '900' }}
              className={`uppercase text-white ${english ? 'text-[40px] leading-[44px]' : 'text-[32px] leading-[48px]'}`}>
              {splitHighlight(t(isSignup ? 'acc.signUpTitle' : 'acc.welcomeTitle')).map((part, i) =>
                part.highlight ? (
                  <Text key={i} style={{ color: BRAND }}>
                    {part.text}
                  </Text>
                ) : (
                  part.text
                )
              )}
            </DisplayText>
            <Text maxFontSizeMultiplier={1.3} className="mt-3 text-[15px] text-white/70">
              {t(isSignup ? 'acc.signUpSub' : 'acc.loginSub')}
            </Text>
          </View>

          <View className="flex-1 gap-5 px-6 pt-8">
            {/* Form */}
            <View className="gap-4">
              {isSignup ? (
                <TextField
                  label={t('acc.fullName')}
                  icon={{ ios: 'person', android: 'person', web: 'person' }}
                  placeholder={t('acc.yourName')}
                  value={name}
                  onChangeText={setName}
                  error={errors.name ? t(errors.name) : undefined}
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
                label={t('acc.email')}
                icon={{ ios: 'envelope', android: 'mail', web: 'mail' }}
                placeholder="you@example.com" // i18n-ignore
                value={email}
                onChangeText={setEmail}
                error={errors.email ? t(errors.email) : undefined}
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
                label={t('acc.password')}
                icon={{ ios: 'lock', android: 'lock', web: 'lock' }}
                placeholder={isSignup ? t('acc.passwordMin', { n: MIN_PASSWORD }) : t('acc.yourPassword')}
                value={password}
                onChangeText={setPassword}
                error={errors.password ? t(errors.password, { n: MIN_PASSWORD }) : undefined}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                textContentType={isSignup ? 'newPassword' : 'password'}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />
              {!isSignup ? (
                <Pressable onPress={onForgot} hitSlop={8} accessibilityRole="button" className="self-end active:opacity-60">
                  <Text maxFontSizeMultiplier={1.3} style={{ color: BRAND }} className="text-sm font-semibold">
                    {t('acc.forgot')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Button
              title={t(isSignup ? 'acc.createAccount' : 'acc.logIn')}
              onPress={onSubmit}
              loading={busy === 'email'}
              disabled={busy !== null}
            />

            {/* Divider */}
            <View className="flex-row items-center gap-3">
              <View style={{ backgroundColor: DIVIDER }} className="h-px flex-1" />
              <Text maxFontSizeMultiplier={1.3} className="text-xs text-muted">
                {t('acc.orContinue')}
              </Text>
              <View style={{ backgroundColor: DIVIDER }} className="h-px flex-1" />
            </View>

            {/* Google + Apple side by side */}
            <View className="flex-row gap-3">
              <Button
                variant="google"
                title="Google"
                className="flex-1"
                accessibilityLabel={t('acc.continueGoogle')}
                left={<GoogleMark />}
                onPress={onGoogle}
                loading={busy === 'google'}
                disabled={busy !== null}
              />
              <Button
                variant="apple"
                title="Apple"
                className="flex-1"
                accessibilityLabel={t('acc.continueApple')}
                left={<AppleMark />}
                onPress={onApple}
                loading={busy === 'apple'}
                disabled={busy !== null}
              />
            </View>

            <View className="mt-auto flex-row flex-wrap justify-center pt-2">
              <Text className="text-sm text-muted">
                {t(isSignup ? 'acc.alreadyMember' : 'acc.newHere')}{' '}
              </Text>
              <Pressable onPress={() => switchMode(isSignup ? 'login' : 'signup')} hitSlop={8} accessibilityRole="button">
                <Text style={{ color: BRAND }} className="text-sm font-bold">{t(isSignup ? 'acc.logIn' : 'acc.signUp')}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
