import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text } from 'react-native';

import type { CoachingStatus } from '@/lib/fitness-api';

/** What the diet block says while the profile is not shared (the workout block above it carries the button). */
export const DIET_AFTER_PROFILE = 'Your diet plan will appear here after that.';

/**
 * Shown next to "Complete your fitness profile and enable sharing…": opens the same step-by-step questions
 * as right after the first login; the last step turns sharing on. Renders nothing once the profile is shared.
 */
export function CompleteProfileButton({ coaching }: { coaching: CoachingStatus | undefined }) {
  const router = useRouter();
  if (coaching?.status !== 'not_shared') return null;
  return (
    <Pressable
      onPress={() => router.push('/complete-profile' as never)}
      accessibilityRole="button"
      accessibilityLabel="Complete your fitness profile"
      className="mt-3 min-h-11 flex-row items-center gap-2 self-start rounded-full bg-brand px-5 active:opacity-80">
      <Text maxFontSizeMultiplier={1.3} className="text-sm font-bold text-ink">
        Complete profile
      </Text>
      <SymbolView name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} tintColor="#050a07" size={12} />
    </Pressable>
  );
}
