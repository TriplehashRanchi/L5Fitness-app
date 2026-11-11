import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GREEN_BG, GreenBackground } from '@/components/green-background';
import { ProfileForm } from '@/components/profile-form';
import { messageFrom } from '@/lib/http';
import { useProfile } from '@/providers/profile-provider';

/**
 * Right after the first login: the profile questions, one step at a time.
 * "Skip" finishes setup without answers and goes to Home; the questions can be answered later from Profile or Diet.
 * The back arrow and the Skip button are drawn by the form, in its top row.
 */
export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const { deferSetup } = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skip = async () => {
    setBusy(true);
    setError(null);
    try {
      await deferSetup();
    } catch (e) {
      setError(messageFrom(e));
      setBusy(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: GREEN_BG }}>
      <StatusBar style="light" />
      <GreenBackground />
      <View className="flex-1" style={{ paddingTop: insets.top + 8 }}>
        <ProfileForm mode="setup" onSkip={skip} skipping={busy} skipError={error} />
      </View>
    </View>
  );
}
