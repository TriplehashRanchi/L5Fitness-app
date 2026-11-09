/** Water amounts, written the way people read them: 750 ml, 1.5 L, 2.25 L. */
export function formatWater(ml: number): string {
  if (ml < 1000) return `${ml} ml`;
  const litres = ml / 1000;
  // Up to two decimals, no trailing zeros: 2 L, 1.5 L, 2.25 L.
  return `${parseFloat(litres.toFixed(2))} L`;
}

/** Share of the daily goal, as a whole percent, never above 100. */
export function waterPercent(ml: number, goalMl: number): number {
  return goalMl > 0 ? Math.min(100, Math.round((ml / goalMl) * 100)) : 0;
}

/** Quick-add sizes: a glass, a bottle and a large bottle. */
export const WATER_PRESETS_ML = [250, 500, 750] as const;
