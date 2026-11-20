import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { CompleteProfileButton } from '@/components/complete-profile-button';
import { BRAND, COMPACT_TEXT, PillButton, Section, TextLink } from '@/components/today-card/ui';
import type { CoachingStatus, Workout } from '@/lib/fitness-api';
import { emptyPlanCopy } from '@/lib/plan-copy';

const DUMBBELL = { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' } as const;

/** Instruction lines; the ones that look like sets or reps are highlighted. */
function Lines({ text }: { text: string }) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <View className="mt-2 gap-1.5">
      {lines.map((line, i) => {
        const hot = /\d+\s*(x|×|sets?|reps?|rounds?|min|sec|s\b)/i.test(line);
        return (
          <View key={i} className="flex-row items-start gap-3 py-1">
            <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 8, backgroundColor: hot ? BRAND : '#8fa396' }} />
            <Text selectable {...COMPACT_TEXT} className={`flex-1 text-sm leading-6 ${hot ? 'font-semibold text-brand' : 'text-white'}`}>
              {line.replace(/^[-•*]\s*/, '')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function WorkoutBlock({
  plan,
  done,
  active,
  dateLabel,
  coaching,
  onStart,
  onOpen,
}: {
  plan: Workout | null;
  done: boolean;
  /** A workout is running right now (its card is at the top of Home). */
  active: boolean;
  dateLabel: string;
  coaching: CoachingStatus | undefined;
  onStart: () => void;
  /** Opens the full plan, where the workout is laid out in full. */
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!plan) {
    const line = coaching?.status === 'accepted' || !coaching ? null : emptyPlanCopy(coaching, false).line;
    return (
      <Section first icon={DUMBBELL} title="Workout">
        <Text {...COMPACT_TEXT} className="text-sm leading-5 text-muted">
          {line ?? 'No workout planned today'}
        </Text>
        <CompleteProfileButton coaching={coaching} />
      </Section>
    );
  }
  const status = done ? 'Done' : active ? 'In progress' : undefined;
  return (
    <Section first icon={DUMBBELL} title="Workout" status={status} done={done}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1" accessible accessibilityLabel={`Workout, ${dateLabel}: ${plan.title}, ${plan.durationMin} minutes, ${plan.kcal} kilocalories${status ? `, ${status}` : ''}`}>
          <Text {...COMPACT_TEXT} className={`text-lg font-bold leading-6 ${done ? 'text-muted' : 'text-white'}`} numberOfLines={2}>
            {plan.title}
          </Text>
          <Text {...COMPACT_TEXT} className="mt-0.5 text-sm text-muted">
            {plan.durationMin} min · {plan.kcal} kcal
          </Text>
        </View>
        {!done && !active ? (
          <PillButton primary label="Start" accessibilityLabel="Start workout" onPress={onStart} icon={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} />
        ) : null}
      </View>
      <View className="flex-row items-center justify-between">
        {plan.instructions?.trim() ? (
          <Pressable
            onPress={() => setOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={open ? 'Hide exercises' : 'View exercises'}
            className="min-h-11 flex-row items-center gap-1.5 active:opacity-60">
            <Text {...COMPACT_TEXT} className="text-sm font-bold text-brand">
              {open ? 'Hide' : 'Exercises'}
            </Text>
            <SymbolView
              name={open ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
              tintColor={BRAND}
              size={12}
            />
          </Pressable>
        ) : (
          <View />
        )}
        {/* The way to the full workout, only while it is still to be done. */}
        {!done && !active ? <TextLink label="Go to workout  ›" accessibilityLabel="Go to today's workout" onPress={onOpen} /> : null}
      </View>
      {open && plan.instructions?.trim() ? <Lines text={plan.instructions} /> : null}
    </Section>
  );
}
