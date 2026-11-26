import type { CoachingStatus, Home } from '@/lib/fitness-api';
import type { Translate } from '@/lib/i18n';

/** The text shown when there is no workout: still loading, not shared, waiting for a dietitian, or nothing planned. */
export function emptyPlanCopy(coaching: CoachingStatus | undefined, loading: boolean, t: Translate) {
  const title = loading ? t('hm.planLoading') : coaching?.status === 'pending' ? t('hm.planNextChapter') : t('hm.planPersonal');
  const line = loading
    ? ' '
    : coaching?.status === 'not_shared'
      ? t('hm.planNotShared')
      : coaching?.status === 'pending'
        ? t('hm.planPending')
        : t('hm.planNoExercise', { name: coaching?.dietitianName || t('hm.yourDietitian') });
  return { title, line };
}

/** The headline and one-line description of today's workout, including the empty / pending / not-shared texts. */
export function planCopy(data: Home | null, loading: boolean, t: Translate) {
  const plan = data?.plan ?? null;
  if (!plan) return emptyPlanCopy(data?.coaching, loading, t);
  const line = [
    plan.exerciseCount ? t('hm.planExercises', { n: plan.exerciseCount }) : null,
    t('hm.planMinutes', { n: plan.durationMin }),
    t('hm.planKcal', { n: plan.kcal }),
    plan.focus ? t('hm.planFocus', { focus: plan.focus }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return { title: plan.title, line };
}
