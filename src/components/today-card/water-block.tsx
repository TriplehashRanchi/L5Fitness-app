import { useState } from 'react';
import { View } from 'react-native';

import { Bar, ErrorLine, PillButton, Section } from '@/components/today-card/ui';
import type { Home } from '@/lib/fitness-api';
import { formatWater } from '@/lib/water';

const DROP = { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' } as const;

export function WaterBlock({
  water,
  busy,
  onAdd,
  onUndo,
}: {
  water: Home['water'];
  busy: boolean;
  /** Each resolves to an error message, or null when saved. */
  onAdd: (ml: number) => Promise<string | null>;
  onUndo: () => Promise<string | null>;
}) {
  const [error, setError] = useState<string | null>(null);
  const run = async (p: Promise<string | null>) => setError(await p);
  const done = water.goalMl > 0 && water.totalMl >= water.goalMl;
  const text = `${formatWater(water.totalMl)} / ${formatWater(water.goalMl)}`;
  return (
    <Section icon={DROP} title="Water" status={text} done={done}>
      <Bar progress={water.goalMl > 0 ? water.totalMl / water.goalMl : 0} label="Water" valueText={text} />
      <View className="mt-3 flex-row gap-2">
        <PillButton flex label="+250 ml" accessibilityLabel="Add 250 millilitres of water" busy={busy} onPress={() => run(onAdd(250))} />
        <PillButton flex label="+500 ml" accessibilityLabel="Add 500 millilitres of water" busy={busy} onPress={() => run(onAdd(500))} />
        <PillButton
          label="Undo"
          accessibilityLabel="Undo the last drink"
          disabled={!water.lastId || busy}
          onPress={() => run(onUndo())}
        />
      </View>
      <ErrorLine message={error} />
    </Section>
  );
}
