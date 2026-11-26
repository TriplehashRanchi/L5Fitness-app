import { useState } from 'react';
import { View } from 'react-native';

import { Bar, ErrorLine, PillButton, Section } from '@/components/today-card/ui';
import type { Home } from '@/lib/fitness-api';
import { formatWater } from '@/lib/water';
import { useT } from '@/providers/language-provider';

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
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const run = async (p: Promise<string | null>) => setError(await p);
  const done = water.goalMl > 0 && water.totalMl >= water.goalMl;
  const text = `${formatWater(water.totalMl)} / ${formatWater(water.goalMl)}`;
  return (
    <Section icon={DROP} title={t('hm.water')} status={text} done={done}>
      <Bar progress={water.goalMl > 0 ? water.totalMl / water.goalMl : 0} label={t('hm.water')} valueText={text} />
      <View className="mt-3 flex-row gap-2">
        <PillButton flex label="+250 ml" accessibilityLabel={t('hm.addWaterA11y', { ml: 250 })} busy={busy} onPress={() => run(onAdd(250))} />
        <PillButton flex label="+500 ml" accessibilityLabel={t('hm.addWaterA11y', { ml: 500 })} busy={busy} onPress={() => run(onAdd(500))} />
        <PillButton
          label={t('hm.undo')}
          accessibilityLabel={t('hm.undoLast')}
          disabled={!water.lastId || busy}
          onPress={() => run(onUndo())}
        />
      </View>
      <ErrorLine message={error} />
    </Section>
  );
}
