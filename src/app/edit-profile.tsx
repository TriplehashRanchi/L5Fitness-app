import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GREEN_BG, GreenBackground } from '@/components/green-background';
import { ProfileForm } from '@/components/profile-form';

/**
 * Changing the profile uses the same one-question-at-a-time screens as first-time setup, filled in with the
 * member's current answers. "Save" at the top right saves from any screen; the cross closes without saving.
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1" style={{ backgroundColor: GREEN_BG }}>
      <StatusBar style="light" />
      <GreenBackground />
      <View className="flex-1" style={{ paddingTop: insets.top + 8 }}>
        <ProfileForm mode="setup" editing onDone={() => router.back()} />
      </View>
    </View>
  );
}
