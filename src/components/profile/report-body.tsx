import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { DisplayText } from '@/components/display-text';
import { WeekCarousel } from '@/components/profile/week-carousel';
import { WeightChart } from '@/components/weight-chart';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { fmtKg, GOAL_KEY } from '@/lib/body';
import { CONTEXT_LABEL_KEY, MEASURE_SPEC, readingText, type Measure, type Report } from '@/lib/progress-api';
import { useLanguage, useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const TRACK = 'rgba(255,255,255,0.1)';
const HAIRLINE = 'rgba(255,255,255,0.08)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const DASH = '–';

const round1 = (n: number) => Math.round(n * 10) / 10;
const signed = (n: number, unit: string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} ${unit}`;

/** A titled part of the page: a small heading, the content on the page itself, and a thin line above. */
function Section({ title, bleed, children }: { title: string; bleed?: boolean; children: ReactNode }) {
  const { language } = useLanguage();
  return (
    // `bleed` lets the content run to the screen's edges (the week cards); the heading keeps the page's margin.
    <View className={bleed ? '' : 'px-5'} style={{ paddingTop: 22, paddingBottom: 22, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
      <Text {...COMPACT_TEXT} accessibilityRole="header" className={`font-bold uppercase text-muted ${bleed ? 'px-5' : ''}`} style={{ fontSize: 12, letterSpacing: language === 'en' ? 1.4 : 0, marginBottom: 14 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** One number with its name above and a short note below. Two sit in a row, or three with `third`. */
function Figure({ label, value, note, accent, third }: { label: string; value: string; note?: string; accent?: boolean; third?: boolean }) {
  return (
    <View accessible accessibilityLabel={[label, value, note].filter(Boolean).join('. ')} style={{ width: third ? '33.33%' : '50%', paddingVertical: 10, paddingRight: 10 }}>
      <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, lineHeight: 17 }}>
        {label}
      </Text>
      <DisplayText {...COMPACT_TEXT} style={{ fontSize: 24, lineHeight: 30, marginTop: 2, color: accent ? BRAND : '#ffffff' }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </DisplayText>
      {note ? (
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 11, lineHeight: 16, marginTop: 1 }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function Bar({ share, height = 6 }: { share: number; height?: number }) {
  return (
    <View className="overflow-hidden rounded-full" style={{ height, backgroundColor: TRACK }}>
      <View className="rounded-full bg-brand" style={{ height, width: `${Math.min(1, Math.max(0, share)) * 100}%` }} />
    </View>
  );
}

/** A habit: its name, how often, and a bar. Nothing logged is an empty bar with words, never "0 of". */
function Habit({ label, value, share }: { label: string; value: string; share: number }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={{ paddingVertical: 9 }}>
      <View className="flex-row items-center" style={{ gap: 12, marginBottom: 7 }}>
        <Text {...COMPACT_TEXT} className="flex-1 text-white" style={{ fontSize: 14 }}>
          {label}
        </Text>
        <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 13, flexShrink: 1, textAlign: 'right' }}>
          {value}
        </Text>
      </View>
      <Bar share={share} />
    </View>
  );
}

/** A plain line: what it is on the left, the value on the right. */
function Line({ label, value, note, first }: { label: string; value: string; note?: string; first?: boolean }) {
  return (
    <View accessible accessibilityLabel={[label, value, note].filter(Boolean).join('. ')} style={{ paddingVertical: 11, borderTopWidth: first ? 0 : 1, borderTopColor: HAIRLINE }}>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <Text {...COMPACT_TEXT} className="flex-1 text-muted" style={{ fontSize: 14 }}>
          {label}
        </Text>
        <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 14, flexShrink: 1, textAlign: 'right' }}>
          {value}
        </Text>
      </View>
      {note ? (
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, lineHeight: 18, marginTop: 4 }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function Quiet({ children }: { children: string }) {
  return (
    <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, lineHeight: 19 }}>
      {children}
    </Text>
  );
}

/** Everything in one report, top to bottom: weight goal, key numbers, habits, weeks, readings and coach notes. */
export function ReportBody({ report }: { report: Report }) {
  const t = useT();
  const { format } = useDeviceClock();
  const { weight: w, habits, waist, bmi, wellbeing, adherence } = report;

  const date = (day: string, year = false) =>
    new Intl.DateTimeFormat(format.locale, { day: 'numeric', month: 'short', year: year ? 'numeric' : undefined, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  const count = (n: number) => Math.round(n).toLocaleString(format.locale);
  const kg = (n: number | null) => (n == null ? DASH : fmtKg(n));
  const litres = (ml: number) => `${round1(ml / 1000)} L`; // i18n-ignore: the unit
  const total = report.dayNumber;
  const ofDays = (n: number) => t('rep.ofDays', { n, total });

  const changed = w.change == null ? null : w.change < 0 ? t('rep.lost', { kg: fmtKg(Math.abs(w.change)) }) : w.change > 0 ? t('rep.gained', { kg: fmtKg(w.change) }) : t('rep.noChange');
  // The chart wants the newest first. The first week begins part way through when the start was not a Monday.
  const trend = report.weeks
    .flatMap((x) => (x.weight == null ? [] : [{ id: x.weekStart, day: x.weekStart < report.start ? report.start : x.weekStart, weightKg: x.weight }]))
    .reverse();

  const waistNote =
    waist.readings >= 2 && waist.first != null && waist.last != null ? t('rep.waistFrom', { change: signed(round1(waist.last - waist.first), 'cm'), first: waist.first }) : waist.readings ? t('rep.oneReading') : undefined;

  const readings = (list: Measure[]) =>
    list.length ? (
      list.map((m, i) => (
        <Line
          key={m.id}
          first={i === 0}
          label={`${date(m.day)} · ${t(MEASURE_SPEC[m.kind].labelKey)}${m.context ? ` (${t(CONTEXT_LABEL_KEY[m.context])})` : ''}`}
          value={readingText(m)}
        />
      ))
    ) : (
      <Quiet>{t('rep.nonePeriod')}</Quiet>
    );

  const subheading = (text: string, top = 0) => (
    <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 14, marginTop: top, marginBottom: 6 }}>
      {text}
    </Text>
  );

  return (
    <View>
      <Text {...COMPACT_TEXT} className="px-5 text-muted" style={{ fontSize: 13, paddingBottom: 16 }}>
        {[`${date(report.start)} – ${date(report.end, true)}`, report.goal ? t(GOAL_KEY[report.goal]) : null].filter(Boolean).join('  ·  ')}
      </Text>

      {/* Where it began, where it is, where it is going and what is left. */}
      <Section title={t('rep.weightProgress')}>
        <View className="flex-row flex-wrap" style={{ marginTop: -10 }}>
          <Figure label={t('rep.start')} value={kg(w.start)} />
          <Figure label={t('rep.current')} value={kg(w.current)} />
          <Figure label={t('rep.target')} value={kg(w.target)} />
          <Figure
            label={t(report.goal === 'maintain' ? 'rep.fromTarget' : 'rep.toGo')}
            value={w.current == null || w.target == null ? DASH : w.reached ? t('rep.reached') : kg(w.remaining)}
            accent
          />
        </View>
        {w.percent != null ? (
          <View accessible accessibilityLabel={`${t('rep.toTarget')}: ${w.percent}%`} style={{ marginTop: 8 }}>
            <View className="flex-row items-end" style={{ gap: 12, marginBottom: 8 }}>
              <Text {...COMPACT_TEXT} className="flex-1 font-bold text-white" style={{ fontSize: 14 }}>
                {t('rep.toTarget')}
              </Text>
              <DisplayText {...COMPACT_TEXT} className="text-right text-brand" style={{ fontSize: 22, lineHeight: 28, minWidth: 72 }} numberOfLines={1} adjustsFontSizeToFit>
                {`${w.percent}%`}
              </DisplayText>
            </View>
            <Bar share={w.percent / 100} height={10} />
          </View>
        ) : null}
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, lineHeight: 20, marginTop: 10 }}>
          {[changed ?? t('rep.noWeight'), w.perWeek != null ? t('rep.perWeek', { kg: signed(w.perWeek, 'kg') }) : null, t('rep.weighIns', { n: w.weighIns })].filter(Boolean).join('  ·  ')}
        </Text>
      </Section>

      {w.target != null ? (
        <Section title={t('rep.chart')}>
          <WeightChart history={trend} targetKg={w.target} locale={format.locale} />
        </Section>
      ) : null}

      <Section title={t('rep.numbers')}>
        <View className="flex-row flex-wrap" style={{ marginTop: -10 }}>
          <Figure label={t('care.measureWaist')} value={waist.last == null ? DASH : `${waist.last} cm`} note={waistNote} />
          <Figure label="BMI" value={bmi.current == null ? DASH : String(bmi.current)} note={bmi.start != null && bmi.current != null ? t('rep.bmiStart', { n: bmi.start }) : undefined} />
          <Figure label={t('rep.avgSteps')} value={report.deviceDerived.avgSteps == null ? DASH : count(report.deviceDerived.avgSteps)} note={t('rep.dailyGoal', { value: count(habits.steps.goal) })} />
          <Figure label={t('rep.avgWater')} value={habits.water.avgMl == null ? DASH : litres(habits.water.avgMl)} note={t('rep.dailyGoal', { value: litres(habits.water.goalMl) })} />
          <Figure label={t('rep.avgSleep')} value={wellbeing?.sleepHours == null ? DASH : t('rep.hours', { n: wellbeing.sleepHours })} note={t('rep.fromCheckins')} />
          <Figure
            label={t('rep.actionsDone')}
            value={adherence.agreedPercent == null ? DASH : `${adherence.agreedPercent}%`}
            note={adherence.agreed.total ? t('rep.of', { n: adherence.agreed.completed, total: adherence.agreed.total }) : undefined}
          />
        </View>
      </Section>

      <Section title={t('rep.habits')}>
        <View style={{ marginTop: -9 }}>
          <Habit label={t('rep.hCheckins')} value={ofDays(wellbeing?.checkins ?? 0)} share={(wellbeing?.checkins ?? 0) / total} />
          <Habit label={t('rep.hSteps')} value={habits.steps.days ? ofDays(habits.steps.met) : t('rep.none')} share={habits.steps.met / total} />
          <Habit label={t('rep.hWater')} value={habits.water.days ? ofDays(habits.water.met) : t('rep.none')} share={habits.water.met / total} />
          <Habit label={t('rep.hMeals')} value={habits.mealDays ? ofDays(habits.mealDays) : t('rep.none')} share={habits.mealDays / total} />
          <Habit
            label={t('rep.hActions')}
            value={adherence.agreed.total ? t('rep.of', { n: adherence.agreed.completed, total: adherence.agreed.total }) : t('rep.none')}
            share={adherence.agreed.total ? adherence.agreed.completed / adherence.agreed.total : 0}
          />
          <Habit
            label={t('rep.hPlan')}
            value={adherence.plan.planned ? t('rep.of', { n: adherence.plan.done, total: adherence.plan.planned }) : t('rep.none')}
            share={adherence.plan.planned ? adherence.plan.done / adherence.plan.planned : 0}
          />
        </View>
      </Section>

      <Section title={t('rep.wellbeing')}>
        {wellbeing ? (
          <View className="flex-row flex-wrap" style={{ marginTop: -10 }}>
            {/* Sleep is already among the key numbers above. */}
            <Figure third label={t('rep.energy')} value={wellbeing.energy == null ? DASH : String(wellbeing.energy)} />
            <Figure third label={t('rep.hunger')} value={wellbeing.hunger == null ? DASH : String(wellbeing.hunger)} />
            <Figure third label={t('rep.stress')} value={wellbeing.stress == null ? DASH : String(wellbeing.stress)} />
          </View>
        ) : (
          <Quiet>{t('rep.noCheckins')}</Quiet>
        )}
      </Section>

      <Section title={t('rep.weeks')} bleed>
        <WeekCarousel report={report} />
        <View className="px-5" style={{ marginTop: 12 }}>
          <Quiet>{t('rep.weeksNote')}</Quiet>
        </View>
      </Section>

      {/* Three separate groups, never blended: typed in, counted by the phone, checked against a report. */}
      <Section title={t('rep.measures')}>
        {subheading(t('rep.self'))}
        {readings(report.selfReported)}
        {subheading(t('rep.device'), 18)}
        <Quiet>{report.deviceDerived.avgSteps != null ? t('rep.deviceLine', { days: report.deviceDerived.stepDays, avg: count(report.deviceDerived.avgSteps) }) : t('rep.noSteps')}</Quiet>
        {subheading(t('rep.verified'), 18)}
        {readings(report.clinician)}
      </Section>

      {report.reviews.length ? (
        <Section title={t('rep.coach')}>
          {report.reviews.map((r, i) => (
            <View key={r.weekStart}>
              {subheading(date(r.weekStart, true), i ? 14 : 0)}
              {r.barriers ? <Quiet>{t('rep.barriers', { text: r.barriers })}</Quiet> : null}
              {r.coachFeedback ? <Quiet>{t('rep.feedback', { text: r.coachFeedback })}</Quiet> : null}
            </View>
          ))}
        </Section>
      ) : null}

      <View className="px-5" style={{ paddingTop: 18, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
        <Quiet>{t('rep.disclaimer')}</Quiet>
      </View>
    </View>
  );
}
