import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { SectionTitle } from '@/components/day-plan/section-title';
import type { CoachingStatus, DayItem, MyDay } from '@/lib/fitness-api';
import { DIET_AFTER_PROFILE } from '@/components/complete-profile-button';
import { emptyPlanCopy } from '@/lib/plan-copy';
import { SLOT_LABEL, SLOT_ORDER } from '@/lib/wellness-api';

const BRAND = '#3ddc68';
const INK = '#050a07';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

/** Diet plan items grouped by meal slot, each with a tick (read-only when `canTick` is false). */
export function DietSection({
  diet,
  coaching,
  canTick,
  pending,
  onToggle,
}: {
  diet: MyDay['diet'] | undefined;
  coaching: CoachingStatus | undefined;
  canTick: boolean;
  pending: Set<string>;
  onToggle: (item: DayItem) => void;
}) {
  const items = diet?.items ?? [];
  const right =
    diet && diet.total > 0 ? (
      <Text {...COMPACT_TEXT} className="text-sm font-bold text-brand">
        {diet.done}/{diet.total}
      </Text>
    ) : undefined;

  if (items.length === 0) {
    const text =
      coaching?.status === 'accepted'
        ? 'No diet plan has been added for this day yet.'
        : coaching?.status === 'not_shared'
          ? DIET_AFTER_PROFILE
          : emptyPlanCopy(coaching, false).line;
    return (
      <View className="mb-5">
        <SectionTitle title="Diet plan" />
        <View className="mx-5 rounded-3xl border border-white/10 bg-card p-5">
          <Text {...COMPACT_TEXT} className="text-sm leading-6 text-muted">
            {text}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="mb-5">
      <SectionTitle title="Diet plan" right={right} />
      <View className="mx-5 rounded-3xl border border-white/10 bg-card px-5 py-2">
        {SLOT_ORDER.map((slot) => {
          const slotItems = items.filter((i) => i.mealSlot === slot);
          if (slotItems.length === 0) return null;
          return (
            <View key={slot} className="py-2">
              <Text {...COMPACT_TEXT} className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">
                {SLOT_LABEL[slot]}
              </Text>
              {slotItems.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => onToggle(item)}
                  disabled={!canTick || pending.has(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.done, disabled: !canTick }}
                  accessibilityLabel={`${item.title}${item.calories ? `, ${item.calories} calories` : ''}`}
                  className="min-h-14 flex-row items-center gap-3 py-2 active:opacity-70">
                  <View
                    style={{ width: 28, height: 28, borderRadius: 14, borderWidth: item.done ? 0 : 2, borderColor: '#8fa396', backgroundColor: item.done ? BRAND : 'transparent' }}
                    className="items-center justify-center">
                    {item.done ? (
                      <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={INK} size={14} />
                    ) : null}
                  </View>
                  <View className="flex-1">
                    <Text {...COMPACT_TEXT} className={`text-sm font-semibold ${item.done ? 'text-muted line-through' : 'text-white'}`}>
                      {item.title}
                    </Text>
                    {item.details ? (
                      <Text {...COMPACT_TEXT} className="mt-0.5 text-xs leading-5 text-muted">
                        {item.details}
                      </Text>
                    ) : null}
                  </View>
                  {item.calories ? (
                    <Text {...COMPACT_TEXT} className="text-xs font-semibold text-muted">
                      {item.calories} kcal
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          );
        })}
        {!canTick ? (
          <Text {...COMPACT_TEXT} className="pb-3 pt-1 text-xs text-muted">
            You can tick items off on the day itself.
          </Text>
        ) : null}
      </View>
    </View>
  );
}
