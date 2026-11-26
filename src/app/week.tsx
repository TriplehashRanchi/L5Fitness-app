import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DisplayText } from '@/components/display-text';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { fmtKg } from '@/lib/body';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import { splitHighlight, type Translate } from '@/lib/i18n';
import { getWeek, tickAction, type WeekAction, type WeekCard } from '@/lib/progress-api';
import { goBack } from '@/lib/navigation';
import { useLanguage, useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const MUTED = '#8fa396';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const DAY_MS = 86_400_000;

// Weeks run Monday to Sunday. Day keys are plain "YYYY-MM-DD" text, shifted here without any time zone.
const shift = (key: string, days: number) => new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const mondayOf = (key: string) => shift(key, -((new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7));
const short = (key: string, locale: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${key}T00:00:00Z`));

/** A titled part of the page: a small heading, the content on the page itself, and a thin line above. */
function Block({ title, status, children }: { title: string; status?: string | null; children: ReactNode }) {
  const { language } = useLanguage();
  return (
    <View className="px-5" style={{ paddingTop: 22, paddingBottom: 22, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
      <View className="flex-row items-center" style={{ marginBottom: 14 }}>
        <Text {...COMPACT_TEXT} accessibilityRole="header" className="flex-1 font-bold uppercase text-muted" style={{ fontSize: 12, letterSpacing: language === 'en' ? 1.4 : 0 }}>
          {title}
        </Text>
        {status ? (
          <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 13 }}>
            {status}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Line({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} className="flex-row items-center" style={{ minHeight: 44, borderTopWidth: first ? 0 : 1, borderTopColor: HAIRLINE }}>
      <Text {...COMPACT_TEXT} className="flex-1 text-muted" style={{ fontSize: 15 }}>
        {label}
      </Text>
      <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 15, flexShrink: 1, maxWidth: '60%', textAlign: 'right', marginLeft: 12 }}>
        {value}
      </Text>
    </View>
  );
}

const kgOrDash = (n: number | null, t: Translate) => (n == null ? t('care.weekNotEnough') : fmtKg(n));
const signed = (n: number | null, unit: string, t: Translate) => (n == null ? t('care.weekNotEnough') : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} ${unit}`);

/** One agreed action with a dot for each time it should happen this week. */
function ActionRow({ action, canTick, onTick, busy }: { action: WeekAction; canTick: boolean; onTick: () => void; busy: boolean }) {
  const t = useT();
  const done = Math.min(action.done, action.targetCount);
  return (
    <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View className="flex-1">
          <Text {...COMPACT_TEXT} className="font-semibold text-white" style={{ fontSize: 16 }}>
            {action.title}
          </Text>
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
            {action.done >= action.targetCount ? t('care.weekDoneForWeek') : t('care.countOf', { done: action.done, total: action.targetCount })}
          </Text>
        </View>
        {action.metric === 'custom' && canTick ? (
          <Pressable
            onPress={onTick}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('care.weekTickA11y', { title: action.title })}
            className="items-center justify-center rounded-full active:opacity-80"
            style={{ minHeight: 40, maxWidth: '50%', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: BRAND }}>
            {busy ? <ActivityIndicator color="#050a07" size="small" /> : <Text {...COMPACT_TEXT} className="font-black" style={{ color: '#050a07', fontSize: 14, textAlign: 'center' }}>{t('care.weekDoneToday')}</Text>}
          </Pressable>
        ) : null}
      </View>
      <View className="flex-row" style={{ gap: 6, marginTop: 10 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: action.targetCount }, (_, i) => (
          <View key={i} style={{ flex: 1, maxWidth: 44, height: 6, borderRadius: 3, backgroundColor: i < done ? BRAND : 'rgba(255,255,255,0.12)' }} />
        ))}
      </View>
    </View>
  );
}

/** Four weekly averages as bars; a week with no weigh-ins is an empty slot, not a zero. */
function TrendBars({ trend, locale }: { trend: WeekCard['weight']['trend']; locale: string }) {
  const values = trend.map((t) => t.avg).filter((v): v is number => v != null);
  if (values.length < 2) return null;
  const lo = Math.min(...values) - 1;
  const hi = Math.max(...values) + 1;
  return (
    <View className="flex-row items-end" style={{ gap: 10, height: 88, marginTop: 14 }}>
      {trend.map((t) => (
        <View key={t.weekStart} className="flex-1 items-center justify-end" style={{ height: '100%' }}>
          {t.avg == null ? (
            <View style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' }} />
          ) : (
            <View style={{ width: '100%', height: 14 + ((t.avg - lo) / Math.max(0.1, hi - lo)) * 60, borderRadius: 6, backgroundColor: BRAND }} />
          )}
          <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
            {short(t.weekStart, locale)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function WeekScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { format } = useDeviceClock();
  const t = useT();
  const today = toDayKey(getZonedParts(new Date(), format.timeZone));
  const thisWeek = mondayOf(today);

  const [weekStart, setWeekStart] = useState(thisWeek);
  const [card, setCard] = useState<WeekCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [ticking, setTicking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCard((await getWeek(today, weekStart)).card);
      setError(null);
    } catch (e) {
      setError(messageFrom(e));
    }
  }, [today, weekStart]);

  // Loads when the screen opens, and again when the week is changed.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const tick = async (id: string) => {
    setTicking(id);
    try {
      setCard((await tickAction(id, today, true, today)).card);
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setTicking(null);
    }
  };

  const w = card?.weight;
  const canTickToday = !!card && today >= card.weekStart && today <= card.weekEnd;
  const percent = card && card.agreed.total ? Math.round((card.agreed.completed / card.agreed.total) * 100) : null;

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={BRAND} colors={[BRAND]} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40, width: '100%', maxWidth: 840, alignSelf: 'center' }}>
        <View className="flex-row items-center gap-3 px-5 pb-2">
          <Pressable onPress={() => goBack(router)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')} className="h-11 w-11 items-center justify-center rounded-full border border-white/10 active:opacity-70">
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
          </Pressable>
          <DisplayText className="flex-1 text-[30px] font-bold tracking-tight text-white">{t('care.weekTitle')}</DisplayText>
        </View>

        {/* Which week: arrows go back through past weeks and forward to this one. */}
        <View className="flex-row items-center justify-between px-5" style={{ paddingVertical: 10 }}>
          <Pressable onPress={() => setWeekStart((s) => shift(s, -7))} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('care.weekEarlier')} className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-70">
            <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} tintColor="white" size={14} />
          </Pressable>
          <Text {...COMPACT_TEXT} className="flex-1 px-2 text-center font-bold text-white" style={{ fontSize: 16 }}>
            {t(weekStart === thisWeek ? 'care.weekRangeCurrent' : 'care.weekRange', { from: short(weekStart, format.locale), to: short(shift(weekStart, 6), format.locale) })}
          </Text>
          <Pressable
            onPress={() => setWeekStart((s) => shift(s, 7))}
            disabled={weekStart >= thisWeek}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('care.weekLater')}
            className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-70"
            style={{ opacity: weekStart >= thisWeek ? 0.3 : 1 }}>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor="white" size={14} />
          </Pressable>
        </View>

        {error ? (
          <View accessibilityRole="alert" className="mx-5 mb-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm text-white">{error}</Text>
          </View>
        ) : null}
        {!card && !error ? <ActivityIndicator color={BRAND} style={{ marginTop: 48 }} /> : null}

        {card && w ? (
          <>
            {/* The one number: agreed actions done. */}
            <View className="items-center px-5" style={{ paddingVertical: 24 }}>
              {card.agreed.total ? (
                <>
                  {/* One sentence, so each language can put the big number where it belongs. */}
                  <Text {...COMPACT_TEXT} accessibilityLabel={t('care.weekAgreedA11y', { done: card.agreed.completed, total: card.agreed.total })} className="text-center font-black text-white" style={{ fontSize: 56, lineHeight: 62 }}>
                    {splitHighlight(t('care.bigOf', { done: card.agreed.completed, total: card.agreed.total })).map((part, i) =>
                      part.highlight ? part.text : <Text key={i} style={{ fontSize: 28, color: MUTED }}>{part.text}</Text>
                    )}
                  </Text>
                  <Text {...COMPACT_TEXT} className="text-center text-muted" style={{ fontSize: 14, marginTop: 2 }}>
                    {card.isCurrent && card.daysLeft > 0 ? t(card.daysLeft === 1 ? 'care.weekAgreedDayLeft' : 'care.weekAgreedDaysLeft', { n: card.daysLeft }) : t('care.weekAgreedDone')}
                  </Text>
                  <View className="overflow-hidden rounded-full bg-white/10" style={{ height: 8, width: '100%', marginTop: 16 }}>
                    <View className="rounded-full bg-brand" style={{ height: 8, width: `${percent}%` }} />
                  </View>
                </>
              ) : (
                <Text {...COMPACT_TEXT} className="text-center text-muted" style={{ fontSize: 15, lineHeight: 22 }}>
                  {t('care.weekNoActions')}
                </Text>
              )}
            </View>

            {card.actions.length ? (
              <Block title={t('care.weekAgreedTitle')}>
                {card.actions.map((a) => (
                  <ActionRow key={a.id} action={a} canTick={canTickToday} busy={ticking === a.id} onTick={() => void tick(a.id)} />
                ))}
              </Block>
            ) : null}

            <Block title={t('care.weekWeight')} status={w.weighIns ? t(w.weighIns === 1 ? 'care.weekWeighInOne' : 'care.weekWeighInMany', { n: w.weighIns }) : null}>
              {w.current == null ? (
                <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
                  {t('care.weekNoWeighIns')}
                </Text>
              ) : (
                <>
                  <Line first label={t('care.weekStartWeight')} value={kgOrDash(w.baseline, t)} />
                  <Line label={t('care.weekThisAvg')} value={fmtKg(w.current)} />
                  <Line label={t('care.weekChangeStart')} value={signed(w.changeFromBaseline, 'kg', t)} />
                  <Line label={t('care.weekChangeLast')} value={signed(w.changeFromLastWeek, 'kg', t)} />
                  <Line label={t('care.weekTarget')} value={kgOrDash(w.target, t)} />
                  <TrendBars trend={w.trend} locale={format.locale} />
                  <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 11, lineHeight: 16, marginTop: 10 }}>
                    {t('care.weekWeightNote')}
                  </Text>
                </>
              )}
            </Block>

            <Block title={t('care.measureWaist')}>
              {card.waist.current == null ? (
                <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
                  {t('care.weekNoWaist')}
                </Text>
              ) : (
                <>
                  <Line first label={t('care.weekFirstReading')} value={card.waist.baseline == null ? t('care.weekNotEnough') : `${card.waist.baseline} cm`} />
                  <Line label={t('profile.thisWeek')} value={`${card.waist.current} cm`} />
                  <Line label={t('care.weekChange')} value={signed(card.waist.change, 'cm', t)} />
                </>
              )}
              <Pressable onPress={() => router.push('/measures' as never)} accessibilityRole="button" className="mt-3 self-start active:opacity-70">
                <Text {...COMPACT_TEXT} style={{ color: BRAND, fontSize: 14, fontWeight: '700' }}>
                  {t('care.weekLogReading')}
                </Text>
              </Pressable>
            </Block>

            <Block title={t('care.weekFelt')} status={card.wellbeing.checkins ? t(card.wellbeing.checkins === 1 ? 'care.weekCheckinOne' : 'care.weekCheckinMany', { n: card.wellbeing.checkins }) : null}>
              {card.wellbeing.checkins === 0 ? (
                <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
                  {t('care.weekNoCheckins')}
                </Text>
              ) : (
                <>
                  <Line first label={t('care.weekSleepAvg')} value={card.wellbeing.sleepHours == null ? t('care.weekNotAnswered') : t('care.weekHours', { n: card.wellbeing.sleepHours })} />
                  <Line label={t('care.weekEnergy')} value={card.wellbeing.energy == null ? t('care.weekNotAnswered') : String(card.wellbeing.energy)} />
                  <Line label={t('care.weekHunger')} value={card.wellbeing.hunger == null ? t('care.weekNotAnswered') : String(card.wellbeing.hunger)} />
                  <Line label={t('care.weekStress')} value={card.wellbeing.stress == null ? t('care.weekNotAnswered') : String(card.wellbeing.stress)} />
                </>
              )}
              {card.isCurrent ? (
                <Pressable onPress={() => router.push('/check-in' as never)} accessibilityRole="button" className="mt-3 self-start active:opacity-70">
                  <Text {...COMPACT_TEXT} style={{ color: BRAND, fontSize: 14, fontWeight: '700' }}>
                    {t('care.weekCheckToday')}
                  </Text>
                </Pressable>
              ) : null}
            </Block>

            <Block title={t('care.weekPlanMove')}>
              <Line first label={t('care.weekMealsTicked')} value={card.plan.planned ? t('care.countOf', { done: card.plan.done, total: card.plan.planned }) : t('care.weekNoMealPlan')} />
              <Line label={t('care.weekDaysTrained')} value={String(card.activity.workoutDays)} />
              <Line label={t('care.weekStepsAvg')} value={card.activity.avgSteps == null ? t('care.weekNotEnough') : card.activity.avgSteps.toLocaleString(format.locale)} />
            </Block>

            {card.review ? (
              <Block title={t('care.weekFromCoach')}>
                {card.review.barriers ? (
                  <View style={{ marginBottom: 12 }}>
                    <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12 }}>
                      {t('care.weekBarriers')}
                    </Text>
                    <Text {...COMPACT_TEXT} className="text-white" style={{ fontSize: 15, lineHeight: 22, marginTop: 2 }}>
                      {card.review.barriers}
                    </Text>
                  </View>
                ) : null}
                {card.review.coachFeedback ? (
                  <View>
                    <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12 }}>
                      {t('care.weekFeedback')}
                    </Text>
                    <Text {...COMPACT_TEXT} className="text-white" style={{ fontSize: 15, lineHeight: 22, marginTop: 2 }}>
                      {card.review.coachFeedback}
                    </Text>
                  </View>
                ) : null}
              </Block>
            ) : null}

            <Block title={t('care.weekNext', { date: short(card.next.weekStart, format.locale) })}>
              {card.next.actions.length ? (
                card.next.actions.map((a, i) => <Line key={a.id} first={i === 0} label={a.title} value={`${a.targetCount}×`} />)
              ) : (
                <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14, lineHeight: 21 }}>
                  {t('care.weekNextNone')}
                </Text>
              )}
            </Block>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
