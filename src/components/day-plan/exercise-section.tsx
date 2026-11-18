import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { SectionTitle } from '@/components/day-plan/section-title';
import { StatusChip } from '@/components/day-plan/status-chip';
import type { CoachingStatus, MyDay } from '@/lib/fitness-api';
import { CompleteProfileButton } from '@/components/complete-profile-button';
import { emptyPlanCopy } from '@/lib/plan-copy';

const BRAND = '#3ddc68';
const INK = '#050a07';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** Turns a plan's free text into readable rows; lines that look like sets or reps get a highlighted look. */
function InstructionLines({ text }: { text: string }) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <View className="gap-2">
      {lines.map((line, i) => {
        const setsReps = /\d+\s*(x|×|sets?|reps?|rounds?|min|sec|s\b)/i.test(line);
        const cleaned = line.replace(/^[-•*]\s*/, '');
        return (
          <View key={i} className={`flex-row items-start gap-3 rounded-2xl px-4 py-3 ${setsReps ? 'bg-brand/10' : 'bg-card-2'}`}>
            <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 8, backgroundColor: setsReps ? BRAND : '#8fa396' }} />
            <Text selectable {...COMPACT_TEXT} className="flex-1 text-sm leading-6 text-white">
              {cleaned}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The dietitian's workout for the day: title, chips, status, every instruction line.
 * `onStart` shows a Start workout button (only pass it for today, when the workout is not done).
 */
export function ExerciseSection({
  training,
  coaching,
  loading,
  onStart,
}: {
  training: MyDay['training'];
  coaching: CoachingStatus | undefined;
  loading: boolean;
  onStart?: () => void;
}) {
  const dietitian = coaching?.dietitianName;
  if (!training) {
    const copy = emptyPlanCopy(coaching, loading);
    return (
      <View className="mb-5">
        <SectionTitle title="Exercise" />
        <View className="mx-5 rounded-3xl border border-white/10 bg-card p-5">
          <Text {...COMPACT_TEXT} className="text-base font-bold text-white">
            {copy.title}
          </Text>
          <Text {...COMPACT_TEXT} className="mt-2 text-sm leading-6 text-muted">
            {copy.line}
          </Text>
          {loading ? null : <CompleteProfileButton coaching={coaching} />}
        </View>
      </View>
    );
  }
  return (
    <View className="mb-5">
      <SectionTitle title="Exercise" right={<StatusChip done={training.done} />} />
      <View className="mx-5 rounded-3xl border border-white/10 bg-card p-5">
        <Text {...COMPACT_TEXT} className="text-xl font-bold uppercase leading-7 text-white">
          {training.title}
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {[`${training.durationMin} min`, `${training.kcal} kcal`].map((chip) => (
            <View key={chip} className="rounded-full bg-brand/15 px-3 py-1">
              <Text {...COMPACT_TEXT} className="text-xs font-bold text-brand">
                {chip}
              </Text>
            </View>
          ))}
        </View>
        {dietitian ? (
          <Text {...COMPACT_TEXT} className="mt-3 text-xs font-semibold text-muted">
            Set by {dietitian}
          </Text>
        ) : null}
        {training.instructions ? (
          <View className="mt-4">
            <InstructionLines text={training.instructions} />
          </View>
        ) : null}
        {onStart ? (
          <Pressable
            onPress={onStart}
            accessibilityRole="button"
            accessibilityLabel="Start workout"
            className="mt-5 min-h-12 flex-row items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 active:opacity-80">
            <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} tintColor={INK} size={16} />
            <Text {...COMPACT_TEXT} className="text-base font-black text-ink">
              Start workout
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
