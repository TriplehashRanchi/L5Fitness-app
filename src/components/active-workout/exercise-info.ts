import type { Key, Translate } from '@/lib/i18n';

export type Pose = 'jack' | 'knees' | 'climber' | 'bicycle' | 'crunch' | 'plank' | 'pushup' | 'squat' | 'lunge' | 'stretch' | 'warmup' | 'burpee' | 'generic';

export type Exercise = {
  id: string;
  name: string;
  /** "3 × 30 sec", "5 min", … or '' when the line has no numbers. */
  amount: string;
  pose: Pose;
  /** What the move looks like and how to do it. */
  tip: string;
  /** What it works. */
  focus: string;
};

/**
 * The moves the app knows. `test` is matched against the instruction line as it was written (in English);
 * only what the app adds (what the move works and how to do it) is in the member's language.
 */
const KNOWN: { test: RegExp; pose: Pose; focusKey: Key; tipKey: Key }[] = [
  { test: /bicycle/i, pose: 'bicycle', focusKey: 'act.focusCoreObliques', tipKey: 'act.tipBicycle' },
  { test: /mountain|climber/i, pose: 'climber', focusKey: 'act.focusCoreCardio', tipKey: 'act.tipClimber' },
  { test: /jump(ing)?\s*jack|jacks?\b/i, pose: 'jack', focusKey: 'act.focusFullCardio', tipKey: 'act.tipJack' },
  { test: /high\s*knee/i, pose: 'knees', focusKey: 'act.focusLegsCardio', tipKey: 'act.tipKnees' },
  { test: /crunch|sit[\s-]?up/i, pose: 'crunch', focusKey: 'act.focusAbs', tipKey: 'act.tipCrunch' },
  { test: /plank/i, pose: 'plank', focusKey: 'act.focusCoreShoulders', tipKey: 'act.tipPlank' },
  { test: /push[\s-]?up/i, pose: 'pushup', focusKey: 'act.focusChestArms', tipKey: 'act.tipPushup' },
  { test: /squat/i, pose: 'squat', focusKey: 'act.focusLegsGlutes', tipKey: 'act.tipSquat' },
  { test: /lunge/i, pose: 'lunge', focusKey: 'act.focusLegsGlutes', tipKey: 'act.tipLunge' },
  { test: /burpee/i, pose: 'burpee', focusKey: 'act.focusFullCardio', tipKey: 'act.tipBurpee' },
  { test: /cool|stretch|relax|breath/i, pose: 'stretch', focusKey: 'act.focusRecovery', tipKey: 'act.tipStretch' },
  { test: /warm/i, pose: 'warmup', focusKey: 'act.focusMobility', tipKey: 'act.tipWarmup' },
];

const AMOUNT = /(\d+\s*(?:x|×)\s*\d+\s*[a-z]*|\d+\s*(?:-\s*\d+\s*)?(?:sets?|reps?|rounds?|mins?|minutes?|secs?|seconds?|s)\b(?:\s*(?:each|per)\s*\w+)?)/i;

/** Splits a workout's instruction text into one entry per exercise line. */
export function parseExercises(text: string | undefined | null, t: Translate): Exercise[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .map((line, i) => {
      const m = line.match(AMOUNT);
      const amount = m ? m[0].replace(/\s*x\s*/i, ' × ').replace(/\s+/g, ' ').trim() : '';
      let name = (m ? line.replace(m[0], ' ') : line).replace(/[:\-–—,|()]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!name) name = line;
      name = name.charAt(0).toUpperCase() + name.slice(1);
      const known = KNOWN.find((k) => k.test.test(line));
      return {
        id: `${i}-${name}`,
        name,
        amount,
        pose: known?.pose ?? 'generic',
        focus: t(known?.focusKey ?? 'act.focusFull'),
        tip: t(known?.tipKey ?? 'act.tipGeneric'),
      };
    });
}
