import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GREEN_BG, GreenBackground } from '@/components/green-background';
import { ProfileForm } from '@/components/profile-form';

/**
 * The same one-question-at-a-time profile steps as right after the first login, opened later from a
 * "Complete profile" button. Saving the last step (or "Close") returns to where the member came from.
 */
export default function CompleteProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1" style={{ backgroundColor: GREEN_BG }}>
      <StatusBar style="light" />
      <GreenBackground />
      <View className="flex-1" style={{ paddingTop: insets.top + 8 }}>
        <ProfileForm mode="setup" onDone={() => router.back()} onSkip={() => router.back()} skipLabel="Close" />
      </View>
    </View>
  );
}
