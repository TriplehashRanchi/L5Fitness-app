import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '@/lib/http';
import type { Language } from '@/lib/i18n';

// ── The food library ─────────────────────────────────────────────────────────────────────────

export type Portion = { id: string; unit: string; kcal: [number, number]; protein: [number, number] };
export type Food = {
  id: string;
  slug: string;
  category: string;
  region: string;
  diet: string;
  names: Partial<Record<Language, string>> & { en: string; alt?: string[] };
  portions: Portion[];
  oilMatters: boolean;
  coconutMatters: boolean;
  notes: string | null;
};
export type Oil = 'light' | 'usual' | 'heavy';
export type Coconut = 'none' | 'usual' | 'extra';

/** One food on a plate, as chosen in the app: the server works out its range again when the meal is saved. */
export type PlateItem = { foodId: string; portionId: string; count: number; oil: Oil; coconut: Coconut };

const CACHE = 'l5-foods-v1';
const FRESH_MS = 24 * 3_600_000;

/** Downloads the library. The caller keeps the last copy on the phone (see `useFoods`). */
export const fetchFoods = () => api<{ foods: Food[] }>('/foods').then((r) => r.foods);

/** The last saved copy of the library and when it was saved. */
export async function readCachedFoods(): Promise<{ foods: Food[]; at: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE);
    return raw ? (JSON.parse(raw) as { foods: Food[]; at: number }) : null;
  } catch {
    return null;
  }
}
export const saveCachedFoods = (foods: Food[]) => AsyncStorage.setItem(CACHE, JSON.stringify({ foods, at: Date.now() })).catch(() => {});
export const isFresh = (at: number) => Date.now() - at < FRESH_MS;

export const nameOf = (food: Food, language: Language) => food.names[language] ?? food.names.en;

const fold = (text: string) => text.toLowerCase().normalize('NFC').trim();

/** Foods matching what was typed, in any of the five languages or an alternate spelling. Names that start with it come first. */
export function searchFoods(foods: Food[], query: string, limit = 12): Food[] {
  const q = fold(query);
  if (!q) return [];
  const scored: { food: Food; score: number }[] = [];
  for (const food of foods) {
    const names = [...Object.entries(food.names).filter(([k]) => k !== 'alt').map(([, v]) => String(v)), ...(food.names.alt ?? []), food.slug.replace(/_/g, ' ')].map(fold);
    const start = names.some((n) => n.startsWith(q) || n.split(/\s+/).some((w) => w.startsWith(q)));
    const inside = names.some((n) => n.includes(q));
    if (start || inside) scored.push({ food, score: start ? 0 : 1 });
  }
  return scored.sort((a, b) => a.score - b.score || a.food.names.en.localeCompare(b.food.names.en)).slice(0, limit).map((s) => s.food);
}

// ── The range for a plate (the same arithmetic the server uses, so the phone can show it as you choose) ──

const OIL = { light: 0.9, usual: 1, heavy: 1.25 } as const;
const COCONUT = { none: 0.9, usual: 1, extra: 1.15 } as const;
const round5 = (n: number) => Math.round(n / 5) * 5;
const round1 = (n: number) => Math.round(n * 10) / 10;

export type Range = { kcalMin: number; kcalMax: number; proteinMin: number; proteinMax: number };

export function estimateItem(food: Food, item: PlateItem): Range | null {
  const portion = food.portions.find((p) => p.id === item.portionId);
  if (!portion) return null;
  const factor = (food.oilMatters ? OIL[item.oil] : 1) * (food.coconutMatters ? COCONUT[item.coconut] : 1);
  return {
    kcalMin: round5(portion.kcal[0] * item.count * factor),
    kcalMax: round5(portion.kcal[1] * item.count * factor),
    proteinMin: round1(portion.protein[0] * item.count),
    proteinMax: round1(portion.protein[1] * item.count),
  };
}

export function estimatePlate(foods: Map<string, Food>, items: PlateItem[]): Range {
  return items.reduce<Range>(
    (sum, item) => {
      const food = foods.get(item.foodId);
      const r = food ? estimateItem(food, item) : null;
      return r ? { kcalMin: sum.kcalMin + r.kcalMin, kcalMax: sum.kcalMax + r.kcalMax, proteinMin: round1(sum.proteinMin + r.proteinMin), proteinMax: round1(sum.proteinMax + r.proteinMax) } : sum;
    },
    { kcalMin: 0, kcalMax: 0, proteinMin: 0, proteinMax: 0 }
  );
}

// ── Suggestions from a photo ─────────────────────────────────────────────────────────────────

export type Suggestion = { foodId: string; slug: string; name: string; portionId: string; count: number; confidence: 'high' | 'medium' | 'low' };
export const suggestFromPhoto = (uploadId: string) =>
  api<{ suggestions: Suggestion[] }>('/meals/suggest', { method: 'POST', body: { uploadId }, timeoutMs: 60_000 });
