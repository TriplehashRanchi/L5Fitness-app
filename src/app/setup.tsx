import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfileForm } from '@/components/profile-form';
import { messageFrom } from '@/lib/http';
import { useAuth } from '@/providers/auth-provider';
import { useProfile } from '@/providers/profile-provider';

/** Account details already come from sign-in; fitness personalization can wait. */
export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { deferSetup } = useProfile();
  const [personalize, setPersonalize] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = session?.user.name?.trim().split(/\s+/)[0];

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await deferSetup();
    } catch (e) {
      setError(messageFrom(e));
      setBusy(false);
    }
  };

  if (personalize) {
    return <View className="flex-1 bg-ink">
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 8 }} className="px-5">
        <Pressable onPress={() => setPersonalize(false)} accessibilityRole="button" className="py-3">
          <Text className="font-semibold text-brand">Back to quick start</Text>
        </Pressable>
      </View>
      <ProfileForm mode="setup" />
    </View>;
  }

  return (
    <View className="flex-1 bg-ink">
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 32, paddingBottom: 24, paddingHorizontal: 24 }}>
        <View className="mb-10 h-12 w-12 items-center justify-center rounded-2xl bg-brand">
          <Text className="text-lg font-black text-ink">L5</Text>
        </View>
        <Text className="mb-3 text-xs font-bold uppercase tracking-[3px] text-brand">You’re ready</Text>
        <Text className="text-4xl font-black leading-[44px] text-white">{name ? `Welcome, ${name}.` : 'Welcome to L5.'}</Text>
        <Text className="mt-4 text-base leading-7 text-muted">Your account is set up. Let’s get you moving.</Text>

        <View className="mt-8 gap-4 rounded-3xl border border-white/10 bg-card p-5">
          <Text className="text-lg font-bold text-white">Your profile, at your pace</Text>
          <Text className="text-sm leading-6 text-muted">Age, body measurements and food preferences help personalize your fitness journey. You can add them later from Profile.</Text>
          <View className="self-start rounded-full bg-card-2 px-3 py-2">
            <Text className="text-xs font-semibold text-brand">No more questions to get started</Text>
          </View>
        </View>
        <View className="flex-1" />
        {error ? <Text accessibilityRole="alert" className="mt-5 text-sm text-accent">{error}</Text> : null}
        <View className="mt-10 gap-3">
          <Pressable onPress={start} disabled={busy} accessibilityRole="button" className="items-center rounded-2xl bg-brand py-4 active:opacity-80">
            {busy ? <ActivityIndicator color="#0b0b0d" /> : <Text className="text-base font-bold text-ink">Start using L5</Text>}
          </Pressable>
          <Pressable onPress={() => setPersonalize(true)} disabled={busy} accessibilityRole="button" className="items-center rounded-2xl border border-white/15 py-4 active:opacity-70">
            <Text className="text-sm font-semibold text-white">Personalize now · Optional</Text>
          </Pressable>
        </View>
      </ScrollView>
      <View style={{ height: insets.bottom + 12 }} />
    </View>
  );
}
