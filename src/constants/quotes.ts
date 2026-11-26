import type { Key, Translate } from '@/lib/i18n';

/** `author` is a person's name, the same in every language; `authorKey` is a signature that is translated. */
type Quote = { text: Key } & ({ author: string } | { authorKey: Key });

export const GYM_QUOTES: Quote[] = [
  { text: 'acc.quote.consistency', authorKey: 'acc.author.gymMantra' },
  { text: 'acc.quote.onlyBad', authorKey: 'acc.author.athlete' },
  { text: 'acc.quote.small', author: 'Robin Sharma' }, // i18n-ignore
  { text: 'acc.quote.discipline', authorKey: 'acc.author.mindset' },
  { text: 'acc.quote.body', authorKey: 'acc.author.ironCulture' },
  { text: 'acc.quote.strength', author: 'Arnold S.' }, // i18n-ignore
  { text: 'acc.quote.reps', authorKey: 'acc.author.coach' },
];

export function getDailyQuote(t: Translate): { text: string; author: string } {
  // Use day of year so it stays stable throughout the day
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
  const quote = GYM_QUOTES[dayOfYear % GYM_QUOTES.length];
  return { text: t(quote.text), author: 'author' in quote ? quote.author : t(quote.authorKey) };
}

