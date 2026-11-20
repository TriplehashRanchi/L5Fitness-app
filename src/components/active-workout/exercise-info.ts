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

const KNOWN: { test: RegExp; pose: Pose; focus: string; tip: string }[] = [
  { test: /bicycle/i, pose: 'bicycle', focus: 'Core · Obliques', tip: 'Lie on your back, hands behind your head. Bring one knee in while the opposite elbow reaches across to meet it, then switch sides like pedalling. Keep your lower back pressed down.' },
  { test: /mountain|climber/i, pose: 'climber', focus: 'Core · Cardio', tip: 'Start in a high plank, hands under shoulders. Drive one knee towards your chest, then switch legs quickly, like running on the floor. Keep your hips low and your back flat.' },
  { test: /jump(ing)?\s*jack|jacks?\b/i, pose: 'jack', focus: 'Full body · Cardio', tip: 'Stand tall. Jump your feet out wide while your arms swing up overhead, then jump back to start. Land softly on the balls of your feet and keep a steady rhythm.' },
  { test: /high\s*knee/i, pose: 'knees', focus: 'Legs · Cardio', tip: 'Run on the spot, lifting each knee up to hip height. Pump your arms, stay tall and land lightly on your toes. Go quick.' },
  { test: /crunch|sit[\s-]?up/i, pose: 'crunch', focus: 'Abs', tip: 'Lie on your back with knees bent. Curl your shoulders off the floor by tightening your abs, pause at the top, then lower slowly. Do not pull on your neck.' },
  { test: /plank/i, pose: 'plank', focus: 'Core · Shoulders', tip: 'Hold your body in one straight line from head to heels, on forearms or hands. Squeeze your abs and glutes and do not let your hips sag.' },
  { test: /push[\s-]?up/i, pose: 'pushup', focus: 'Chest · Arms', tip: 'Hands a little wider than your shoulders, body straight. Lower your chest to the floor, then press back up. Keep your elbows at about 45°.' },
  { test: /squat/i, pose: 'squat', focus: 'Legs · Glutes', tip: 'Feet shoulder-width apart. Sit your hips back and down like onto a chair, chest up, knees over toes. Push through your heels to stand.' },
  { test: /lunge/i, pose: 'lunge', focus: 'Legs · Glutes', tip: 'Step forward and lower until both knees are bent to about 90°. Keep your front knee over your ankle and your torso upright, then push back to start.' },
  { test: /burpee/i, pose: 'burpee', focus: 'Full body · Cardio', tip: 'Squat down, hands to the floor, jump your feet back to a plank, jump them in again, then explode up with a jump.' },
  { test: /cool|stretch|relax|breath/i, pose: 'stretch', focus: 'Recovery', tip: 'Slow down. Reach up, lean gently side to side and breathe deeply. Hold each stretch for a few breaths and let your heart rate come down.' },
  { test: /warm/i, pose: 'warmup', focus: 'Mobility', tip: 'Easy movement to wake your body up: arm circles, hip rotations and light bouncing. Start slow and build up.' },
];

const AMOUNT = /(\d+\s*(?:x|×)\s*\d+\s*[a-z]*|\d+\s*(?:-\s*\d+\s*)?(?:sets?|reps?|rounds?|mins?|minutes?|secs?|seconds?|s)\b(?:\s*(?:each|per)\s*\w+)?)/i;

/** Splits a workout's instruction text into one entry per exercise line. */
export function parseExercises(text: string | undefined | null): Exercise[] {
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
        focus: known?.focus ?? 'Full body',
        tip: known?.tip ?? 'Move with control, breathe steadily and keep good form. Slow down if your form slips.',
      };
    });
}
