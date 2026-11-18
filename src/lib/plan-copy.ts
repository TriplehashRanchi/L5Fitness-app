import type { CoachingStatus, Home } from '@/lib/fitness-api';

/** The text shown when there is no workout: still loading, not shared, waiting for a dietitian, or nothing planned. */
export function emptyPlanCopy(coaching: CoachingStatus | undefined, loading: boolean) {
  const title = loading ? 'Loading workout…' : coaching?.status === 'pending' ? 'Your next chapter.' : 'Your personal plan.';
  const line = loading
    ? ' '
    : coaching?.status === 'not_shared'
      ? 'Complete your fitness profile and enable sharing to receive personal diet and exercise plans.'
      : coaching?.status === 'pending'
        ? 'Your coach will assign a dietitian to you soon. Your personal plans will appear here after they are added.'
        : `${coaching?.dietitianName || 'Your dietitian'} is your dietitian. No exercise plan has been added for today yet.`;
  return { title, line };
}

/** The headline and one-line description of today's workout, including the empty / pending / not-shared texts. */
export function planCopy(data: Home | null, loading: boolean) {
  const plan = data?.plan ?? null;
  if (!plan) return emptyPlanCopy(data?.coaching, loading);
  const line = [
    plan.exerciseCount ? `${plan.exerciseCount} exercises` : null,
    `${plan.durationMin} minutes`,
    `${plan.kcal} estimated kcal`,
    plan.focus ? `Focus: ${plan.focus}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return { title: plan.title, line };
}
