import { en as coreEn } from './en';
import { kn as coreKn } from './kn';
import { ml as coreMl } from './ml';
import { account } from './parts/account';
import { activity } from './parts/activity';
import { care } from './parts/care';
import { home } from './parts/home';
import { profile } from './parts/profile';
import { ta as coreTa } from './ta';
import { te as coreTe } from './te';

export type Language = 'en' | 'ml' | 'ta' | 'kn' | 'te';

// The words are the core files plus one file per area in ./parts.
const en = { ...coreEn, ...account.en, ...profile.en, ...home.en, ...activity.en, ...care.en };
export type Key = keyof typeof en;
export type Translate = (key: Key, vars?: Record<string, string | number>) => string;
type Table = Partial<Record<Key, string>>;
const ml: Table = { ...coreMl, ...account.ml, ...profile.ml, ...home.ml, ...activity.ml, ...care.ml };
const ta: Table = { ...coreTa, ...account.ta, ...profile.ta, ...home.ta, ...activity.ta, ...care.ta };
const kn: Table = { ...coreKn, ...account.kn, ...profile.kn, ...home.kn, ...activity.kn, ...care.kn };
const te: Table = { ...coreTe, ...account.te, ...profile.te, ...home.te, ...activity.te, ...care.te };

/** The languages the app speaks. `native` is the language's name written in itself, so a reader can find theirs. */
export const LANGUAGES: { code: Language; name: string; native: string }[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
];

const TABLES: Record<Language, Table> = { en, ml, ta, kn, te };

export const isLanguage = (value: unknown): value is Language => LANGUAGES.some((l) => l.code === value);

/** The text for `key` in `language`, with `{name}` filled in. A key that is not translated yet shows the English. */
export function translate(language: Language, key: Key, vars?: Record<string, string | number>): string {
  const text = TABLES[language][key] ?? en[key];
  return vars ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole)) : text;
}

let current: Language = 'en';
/** Set by the language provider, for the code below that is not inside a component. */
export const setCurrentLanguage = (language: Language) => {
  current = language;
};
export const currentLanguage = () => current;

/**
 * `translate` in the app's current language, for code with no access to `useT()`: an error thrown from lib/,
 * an alert raised from a helper. Never use it for text a component draws: the screen would not redraw when the
 * language changes. There, use `useT()` and hand `t` to helpers.
 */
export const tr: Translate = (key, vars) => translate(current, key, vars);

/** Splits "What do you {hl}eat?{/hl}" into pieces, marking which are highlighted. */
export function splitHighlight(text: string): { text: string; highlight: boolean }[] {
  const out: { text: string; highlight: boolean }[] = [];
  const re = /\{hl\}(.*?)\{\/hl\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), highlight: false });
    out.push({ text: m[1], highlight: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), highlight: false });
  return out;
}

/** The language to start with when none was chosen: the phone's own, if the app speaks it. */
export const fromDevice = (code: string | null | undefined): Language => (isLanguage(code) ? code : 'en');

export { en };
