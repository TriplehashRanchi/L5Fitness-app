import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DIET_AFTER_PROFILE } from '@/components/complete-profile-button';
import { CheckDot, COMPACT_TEXT, ErrorLine, Section, TextLink } from '@/components/today-card/ui';
import type { CoachingStatus, DayItem, Home } from '@/lib/fitness-api';
import { emptyPlanCopy } from '@/lib/plan-copy';
import { SLOT_LABEL, SLOT_ORDER } from '@/lib/wellness-api';

const FORK = { ios: 'fork.knife', android: 'restaurant_menu', web: 'restaurant_menu' } as const;

export function DietBlock({
  diet,
  coaching,
  pending,
  error,
  onToggle,
  onOpen,
  first,
}: {
  diet: Home['diet'];
  coaching: CoachingStatus | undefined;
  pending: Set<string>;
  error: string | null;
  onToggle: (item: DayItem) => void;
  onOpen: () => void;
  /** Nothing sits above it, so no line on top. */
  first?: boolean;
}) {
  const items = useMemo(
    () => [...(diet?.items ?? [])].sort((a, b) => SLOT_ORDER.indexOf(a.mealSlot) - SLOT_ORDER.indexOf(b.mealSlot)),
    [diet?.items]
  );
  if (!diet || items.length === 0) {
    const text = coaching?.status === 'accepted' ? 'No diet plan has been added for today yet.' : coaching?.status === 'not_shared' ? DIET_AFTER_PROFILE : emptyPlanCopy(coaching, false).line;
    return (
      <Section first={first} icon={FORK} title="Diet">
        <Text {...COMPACT_TEXT} className="text-sm leading-5 text-muted">
          {text}
        </Text>
      </Section>
    );
  }
  const complete = diet.done >= diet.total;
  return (
    <Section first={first} icon={FORK} title="Diet" status={`${diet.done}/${diet.total}`} done={complete}>
      <View>
        {items.map((item) => {
          const busy = pending.has(item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => onToggle(item)}
              disabled={busy}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.done, busy }}
              accessibilityLabel={`${SLOT_LABEL[item.mealSlot]}: ${item.title}, ${item.done ? 'done' : 'not done'}`}
              accessibilityHint={item.done ? 'Double tap to mark as not done' : 'Double tap to mark as done'}
              className="flex-row items-center gap-3 active:opacity-70"
              style={{ minHeight: 48, opacity: busy ? 0.6 : 1 }}>
              <CheckDot done={item.done} />
              <Text {...COMPACT_TEXT} className={`flex-1 text-base ${item.done ? 'text-muted line-through' : 'font-semibold text-white'}`} numberOfLines={1} style={item.done ? { textDecorationLine: 'line-through' } : undefined}>
                {item.title}
              </Text>
              <Text {...COMPACT_TEXT} className="text-xs text-muted" style={item.done ? { textDecorationLine: 'line-through' } : undefined}>
                {SLOT_LABEL[item.mealSlot]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorLine message={error} />
      <View className="flex-row items-center justify-end">
        {/* The way to the full plan, only while something is still left to tick. */}
        {complete ? null : <TextLink label="Full plan  ›" accessibilityLabel="Open today's full plan to finish your meals" onPress={onOpen} />}
      </View>
    </Section>
  );
}
