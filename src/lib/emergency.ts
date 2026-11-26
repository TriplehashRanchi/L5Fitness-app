import { getLocales } from 'expo-localization';

import type { Key } from '@/lib/i18n';

/**
 * Emergency help. The app is not a monitored emergency service: when someone describes an urgent
 * symptom, the app tells them to call the local emergency number at once and does not wait for a coach.
 */

/** `label` is a word key: show it with `t(line.label)`. */
type Line = { country: string; number: string; label: Key };

/** The number to call for an ambulance, by the phone's region. Anywhere else: 112 (works in most countries). */
const BY_REGION: Record<string, Line> = {
  IN: { country: 'India', number: '112', label: 'acc.line.IN' }, // i18n-ignore
  AE: { country: 'UAE', number: '998', label: 'acc.line.AE' }, // i18n-ignore
  SA: { country: 'Saudi Arabia', number: '997', label: 'acc.line.SA' }, // i18n-ignore
  QA: { country: 'Qatar', number: '999', label: 'acc.line.QA' }, // i18n-ignore
  KW: { country: 'Kuwait', number: '112', label: 'acc.line.KW' }, // i18n-ignore
  OM: { country: 'Oman', number: '9999', label: 'acc.line.OM' }, // i18n-ignore
  BH: { country: 'Bahrain', number: '999', label: 'acc.line.BH' }, // i18n-ignore
};
const FALLBACK: Line = { country: '', number: '112', label: 'acc.line.other' };

export function emergencyLine(region?: string | null): Line {
  const code = (region ?? getLocales()[0]?.regionCode ?? '').toUpperCase();
  return BY_REGION[code] ?? FALLBACK;
}

/** India's free mental-health helpline (Tele-MANAS), shown with the emergency number for self-harm. */
export const SELF_HARM_HELPLINE: { number: string; label: Key } = { number: '14416', label: 'acc.helpline' };

export type Urgency = 'medical' | 'self_harm';

const SELF_HARM = /\b(suicid\w*|kill (my ?self|me)|end (my|this) life|want to die|self[- ]?harm|hurt myself|marna chahta|marna chahti|jaan de)\b/i;
const MEDICAL = [
  /chest\s*(pain|pressure|tight\w*|heav\w*)/i,
  /(pain|pressure|tightness)\s+in\s+(my\s+)?(chest|heart)/i,
  /heart\s*attack/i,
  /(can'?t|cannot|unable to|difficulty|trouble)\s+(to\s+)?breath\w*/i,
  /short(ness)?\s+of\s+breath/i,
  /(fainted|fainting|passed\s*out|blacked\s*out|unconscious|collapsed)/i,
  /\b(stroke|face\s+(is\s+)?droop\w*|slurred\s+speech|one\s+side\s+(is\s+)?(weak|numb))\b/i,
  /\b(seizure|convulsion)s?\b/i,
  /(vomit\w*|cough\w*|spit\w*)\s+(up\s+)?blood/i,
  /(heavy|severe|uncontrolled)\s+bleeding/i,
  /(allergic reaction|throat\s+(is\s+)?(closing|swelling)|swollen\s+(tongue|throat))/i,
  // Hinglish
  /seene\s+mein\s+(dard|jakdan)/i,
  /saans\s+(nahi|nhi|phool|lene\s+mein)/i,
  /(behosh|bhosh\s+kho)/i,
];

/** What an urgent message looks like in the words people type, or null when it is not urgent. Errs on the side of showing help. */
export function urgencyOf(text: string): Urgency | null {
  if (SELF_HARM.test(text)) return 'self_harm';
  return MEDICAL.some((re) => re.test(text)) ? 'medical' : null;
}
