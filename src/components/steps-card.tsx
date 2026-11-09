import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

import { useSteps } from '@/hooks/use-steps';

const BRAND = '#c6f432';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

function ActionButton({ title, onPress, busy }: { title: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      className="min-w-[88px] items-center rounded-full bg-brand px-4 py-2 active:opacity-80">
      {busy ? (
        <ActivityIndicator color="#0b0b0d" size="small" />
      ) : (
        <Text {...COMPACT_TEXT} className="text-xs font-bold text-ink">
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** Today's steps from Apple Health (iOS) or Health Connect (Android). */
export function StepsCard({ now, locale }: { now: Date; locale: string }) {
  const { status, steps, asked, connecting, connect, openSettings, sourceName } = useSteps(now);

  if (status === 'loading') return null;
  if (status === 'unavailable') {
    // Members never see this: a store build on a supported phone is never "unavailable" here.
    // It tells developers why the card is empty in Expo Go and on web.
    if (!__DEV__) return null;
    return (
      <View className="mx-5 mt-5 rounded-3xl border border-white/10 bg-card p-5">
        <Text className="text-sm font-bold text-white">Steps are off in this build</Text>
        <Text className="mt-1 text-xs text-muted">
          Reading steps needs the installed app on a phone. It does not work in Expo Go or on web.
          Developers only: members do not see this note.
        </Text>
      </View>
    );
  }

  let title = 'Steps today';
  let detail = `From ${sourceName}`;
  let action: { title: string; onPress: () => void; busy?: boolean } | null = null;

  if (status === 'needs-setup') {
    title = 'Count your steps';
    detail = 'Install or update Health Connect, then come back here.';
    action = { title: 'Set up', onPress: openSettings };
  } else if (status === 'needs-permission') {
    title = 'Count your steps';
    // Asked once and still not allowed: the system will not ask again, so point to settings.
    detail = asked
      ? `Allow Steps for L5 Fitness in ${sourceName}.`
      : `Connect ${sourceName} to see your daily steps.`;
    action = asked
      ? { title: 'Open settings', onPress: openSettings }
      : { title: 'Connect', onPress: connect, busy: connecting };
  } else if (steps === 0 && Platform.OS === 'ios') {
    // Apple does not say whether reading was allowed, so 0 can mean "no" as well as "no steps yet".
    detail = 'Still 0 after a walk? In the Health app go to Sharing → Apps → L5 Fitness and turn on Steps.';
  }

  return (
    <View className="mx-5 mt-5 flex-row items-center gap-4 rounded-3xl bg-card p-5">
      <View className="h-12 w-12 items-center justify-center rounded-2xl bg-card-2">
        <SymbolView
          name={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }}
          tintColor={BRAND}
          size={22}
        />
      </View>
      <View className="flex-1">
        <Text className="text-base font-bold text-white">{title}</Text>
        <Text className="mt-0.5 text-xs text-muted">{detail}</Text>
      </View>
      {action ? (
        <ActionButton {...action} />
      ) : (
        <Text
          {...COMPACT_TEXT}
          accessibilityLabel={steps == null ? 'Steps not available' : `${steps} steps`}
          className="text-2xl font-black text-brand">
          {steps == null ? '–' : steps.toLocaleString(locale)}
        </Text>
      )}
    </View>
  );
}
