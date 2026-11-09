import type { SymbolViewProps } from 'expo-symbols';

export type IconName = SymbolViewProps['name'];

/**
 * The API sends a short icon key with each workout and class. This maps the key to the real
 * icon on each platform. An unknown key falls back to the dumbbell.
 */
const ICONS: Record<string, IconName> = {
  dumbbell: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
  strength: { ios: 'figure.strengthtraining.traditional', android: 'fitness_center', web: 'fitness_center' },
  functional: { ios: 'figure.strengthtraining.functional', android: 'sports_gymnastics', web: 'sports_gymnastics' },
  run: { ios: 'figure.run', android: 'directions_run', web: 'directions_run' },
  yoga: { ios: 'figure.yoga', android: 'self_improvement', web: 'self_improvement' },
  mobility: { ios: 'figure.flexibility', android: 'self_improvement', web: 'self_improvement' },
  boxing: { ios: 'figure.boxing', android: 'sports_mma', web: 'sports_mma' },
  flame: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  core: { ios: 'figure.core.training', android: 'accessibility_new', web: 'accessibility_new' },
  bolt: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
};

export const iconFor = (key: string): IconName => ICONS[key] ?? ICONS.dumbbell;

/** Icon key for a workout category. */
const CATEGORY_ICON: Record<string, string> = {
  strength: 'dumbbell',
  cardio: 'run',
  hiit: 'flame',
  yoga: 'yoga',
  crossfit: 'functional',
  boxing: 'boxing',
};

export const categoryIcon = (slug: string): IconName => iconFor(CATEGORY_ICON[slug] ?? 'dumbbell');
