import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DIET_AFTER_PROFILE } from '@/components/complete-profile-button';
import { CheckDot, COMPACT_TEXT, ErrorLine, Section, TextLink } from '@/components/today-card/ui';
import type { CoachingStatus, DayItem, Home } from '@/lib/fitness-api';
import { emptyPlanCopy } from '@/lib/plan-copy';
import { SLOT_LABEL, SLOT_ORDER } from '@/lib/wellness-api';

const FORK = { ios: 'fork.knife', android: 'restaurant_menu', web: 'restaurant_menu' } as const;
const VISIBLE = 4;

export function DietBlock({
  diet,
  coaching,
  pending,
  error,
  onToggle,
  onOpen,
}: {
  diet: Home['diet'];
  coaching: CoachingStatus | undefined;
  pending: Set<string>;
  error: string | null;
  onToggle: (item: DayItem) => void;
  onOpen: () => void;
}) {
  const [all, setAll] = useState(false);
  const items = useMemo(
    () => [...(diet?.items ?? [])].sort((a, b) => SLOT_ORDER.indexOf(a.mealSlot) - SLOT_ORDER.indexOf(b.mealSlot)),
    [diet?.items]
  );
  if (!diet || items.length === 0) {
    const text = coaching?.status === 'accepted' ? 'No diet plan has been added for today yet.' : coaching?.status === 'not_shared' ? DIET_AFTER_PROFILE : emptyPlanCopy(coaching, false).line;
    return (
      <Section icon={FORK} title="Diet">
        <Text {...COMPACT_TEXT} className="text-sm leading-5 text-muted">
          {text}
        </Text>
      </Section>
    );
  }
  const shown = all ? items : items.slice(0, VISIBLE);
  const hidden = items.length - shown.length;
  const complete = diet.done >= diet.total;
  return (
    <Section icon={FORK} title="Diet" status={`${diet.done}/${diet.total}`} done={complete}>
      <View>
        {shown.map((item) => {
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
              <Text {...COMPACT_TEXT} className={`flex-1 text-base ${item.done ? 'text-muted line-through' : 'font-semibold text-white'}`} numberOfLines={1}>
                {item.title}
              </Text>
              <Text {...COMPACT_TEXT} className="text-xs text-muted">
                {SLOT_LABEL[item.mealSlot]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorLine message={error} />
      <View className="flex-row items-center justify-between">
        {items.length > VISIBLE ? (
          <TextLink
            label={all ? 'Show fewer' : `+${hidden} more`}
            accessibilityLabel={all ? 'Show fewer meals' : `View all ${items.length} meals`}
            onPress={() => setAll((v) => !v)}
          />
        ) : (
          <View />
        )}
        {/* The way to the Diet tab, only while something is still left to tick. */}
        {complete ? null : <TextLink label="Go to diet  ›" accessibilityLabel="Go to diet to finish today's meals" onPress={onOpen} />}
      </View>
    </Section>
  );
}
