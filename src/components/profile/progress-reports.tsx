import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

import { DisplayText } from '@/components/display-text';
import { messageFrom } from '@/lib/http';
import { downloadSummary, type SummaryState } from '@/lib/progress-api';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const MUTED = '#8fa396';
const TRACK = 'rgba(255,255,255,0.12)';
const PDF_RED = '#ff2116';
const HAIRLINE = 'rgba(255,255,255,0.08)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

const TOTAL = 90;
const RING = 96;
/** The space at the end of a report row for the download icon, or the lock in its place. */
const ACTION = 44;

const INSIDE = [
  { key: 'prof.reports.chipWeight', icon: { ios: 'scalemass', android: 'monitor_weight', web: 'monitor_weight' } },
  { key: 'prof.reports.chipWaist', icon: { ios: 'ruler', android: 'straighten', web: 'straighten' } },
  { key: 'prof.reports.chipHabits', icon: { ios: 'checklist', android: 'checklist', web: 'checklist' } },
  { key: 'prof.reports.chipReadings', icon: { ios: 'heart', android: 'favorite', web: 'favorite' } },
] as const;

const clamp = (n: number) => Math.min(1, Math.max(0, n));
/** Whole days from one YYYY-MM-DD to another. */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** "2026-12-26" → "26 Dec". */
function shortDay(day: string, locale: string) {
  try {
    return new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    return day;
  }
}

/** How far through the 90 days the member is, with the day number in the middle. */
function DayRing({ day }: { day: number }) {
  const t = useT();
  const stroke = 7;
  const r = (RING - stroke) / 2;
  const len = 2 * Math.PI * r;
  const shown = Math.min(TOTAL, day);
  const progress = shown / TOTAL;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${t('prof.reports.journey')}. ${t('prof.reports.dayN', { n: shown })}`}
      accessibilityValue={{ min: 0, max: TOTAL, now: shown }}
      className="items-center justify-center"
      style={{ width: RING, height: RING }}>
      <Svg width={RING} height={RING} style={{ position: 'absolute' }}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={TRACK} strokeWidth={stroke} fill="none" />
        {progress > 0 ? (
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={BRAND}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${len * progress} ${len}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        ) : null}
      </Svg>
      <DisplayText maxFontSizeMultiplier={1} className="text-center text-white" style={{ fontSize: 30, lineHeight: 34, width: RING - 20 }} numberOfLines={1} adjustsFontSizeToFit>
        {shown}
      </DisplayText>
      <Text maxFontSizeMultiplier={1} className="font-bold uppercase text-muted" style={{ fontSize: 10, maxWidth: RING - 28 }} numberOfLines={1} adjustsFontSizeToFit>
        {t('prof.reports.badge')}
      </Text>
    </View>
  );
}

/**
 * The familiar PDF file: a white page outlined in red with its corner cut, a few lines of writing and a red
 * "PDF" label across the left edge. The same shape in grey until the report is ready.
 */
function PdfIcon({ ready }: { ready: boolean }) {
  const edge = ready ? PDF_RED : '#46504a';
  const line = ready ? '#7d7d7d' : '#39423d';
  return (
    <View style={{ width: 48, height: 57 }}>
      <Svg width={48} height={57} viewBox="58 38 241 286">
        <Path
          d="M116 46 H226 Q238 46 246 54 L284 92 Q292 100 292 112 V289 Q292 316 264 316 H116 Q89 316 89 289 V73 Q89 46 116 46 Z"
          fill={ready ? '#ffffff' : 'transparent'}
          stroke={edge}
          strokeWidth={12}
          strokeLinejoin="round"
        />
        <Path d="M116 94 H226 M116 114 H264 M116 133 H264 M116 152 H264 M116 171 H264" stroke={line} strokeWidth={5} />
        <Rect x={58} y={204} width={173} height={77} rx={7} fill={edge} />
        <SvgText x={144.5} y={261} textAnchor="middle" fontSize={56} fontWeight="600" fill={ready ? '#ffffff' : MUTED}>
          PDF
        </SvgText>
      </Svg>
    </View>
  );
}

/**
 * The day 30, 60 and 90 reports: where the member is in their 90 days, then one line per report, all on the
 * page itself with no boxes.
 * Tapping a line opens the report inside the app; the icon at its end downloads the PDF. A report that is
 * not ready says when it will be.
 */
export function ProgressReports({ started, summaries, todayKey, locale }: { started: string | null; summaries: SummaryState[]; todayKey: string; locale: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (days: number) => {
    setBusy(days);
    setError(null);
    try {
      await downloadSummary(days);
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setBusy(null);
    }
  };

  /** Day 1 is the day the programme began; 0 means it has not. */
  const day = started ? Math.max(0, daysBetween(started, todayKey) + 1) : 0;
  const next = summaries.find((s) => !s.ready);
  const anyReady = summaries.some((s) => s.ready);
  const daysTo = (s: SummaryState) => (s.readyOn ? Math.max(1, daysBetween(todayKey, s.readyOn)) : null);
  const nextIn = next ? daysTo(next) : null;

  const headline =
    day === 0
      ? t('prof.reports.notStarted')
      : !next
        ? t('prof.reports.allReady')
        : nextIn == null
          ? t('prof.reports.journey')
          : t(nextIn === 1 ? 'prof.reports.nextTomorrow' : 'prof.reports.nextIn', { n: nextIn });

  return (
    <View>
      {/* Where the member is today. */}
      <View className="items-center" style={{ paddingTop: 4, paddingBottom: 18 }}>
        <View>
          <DayRing day={day} />
          {day > 0 && !next ? (
            <View
              className="items-center justify-center rounded-full bg-brand"
              style={{ position: 'absolute', right: -2, bottom: 0, width: 30, height: 30, borderWidth: 3, borderColor: '#000000' }}>
              <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} tintColor={INK} size={14} />
            </View>
          ) : null}
        </View>
        <DisplayText {...COMPACT_TEXT} className="text-center text-white" style={{ fontSize: 20, lineHeight: 26, marginTop: 14 }}>
          {headline}
        </DisplayText>
        {day > 0 ? (
          <Text {...COMPACT_TEXT} className="text-center text-muted" style={{ fontSize: 13, lineHeight: 19, marginTop: 6 }}>
            {t(anyReady ? 'prof.reports.readyHint' : 'prof.reports.firstHint')}
          </Text>
        ) : null}
      </View>

      {summaries.map((s) => {
        const isNext = s === next;
        const left = s.ready ? null : daysTo(s);
        const title = t('prof.reports.day', { n: s.days });
        const status = s.ready
          ? t('prof.reports.view')
          : s.readyOn
            ? t('prof.reports.readyOn', { date: shortDay(s.readyOn, locale) })
            : t('prof.reports.afterStart');
        const countdown = left != null && day > 0 ? t(left === 1 ? 'prof.reports.dayLeft' : 'prof.reports.daysLeft', { n: left }) : null;
        const downloading = busy === s.days;
        return (
          <View
            key={s.days}
            className="flex-row items-center"
            style={{ gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
            <Pressable
              onPress={() => router.push({ pathname: '/report/[days]', params: { days: String(s.days) } } as never)}
              disabled={!s.ready}
              accessibilityRole="button"
              accessibilityLabel={[title, status, countdown].filter(Boolean).join('. ')}
              accessibilityState={{ disabled: !s.ready }}
              className="flex-1 flex-row items-center active:opacity-70"
              style={{ gap: 12, minHeight: 60 }}>
              <PdfIcon ready={s.ready} />
              <View className="flex-1">
                <Text {...COMPACT_TEXT} className="font-bold" style={{ fontSize: 15, lineHeight: 21, color: s.ready || isNext ? '#ffffff' : '#c3d0c8' }}>
                  {title}
                </Text>
                <Text {...COMPACT_TEXT} className={s.ready ? 'font-semibold text-brand' : 'text-muted'} style={{ fontSize: 12, lineHeight: 18, marginTop: 2 }}>
                  {status}
                </Text>
                {countdown ? (
                  <Text {...COMPACT_TEXT} className="font-semibold" style={{ fontSize: 12, lineHeight: 18, color: isNext ? '#ffffff' : MUTED }}>
                    {countdown}
                  </Text>
                ) : null}
                {isNext && day > 0 ? (
                  <View className="overflow-hidden rounded-full" style={{ height: 4, marginTop: 6, backgroundColor: TRACK }}>
                    <View className="rounded-full bg-brand" style={{ height: 4, width: `${clamp(day / s.days) * 100}%` }} />
                  </View>
                ) : null}
              </View>
            </Pressable>
            {s.ready ? (
              <Pressable
                onPress={() => void download(s.days)}
                disabled={busy != null}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${t('prof.reports.download')} PDF. ${title}`}
                accessibilityState={{ busy: downloading }}
                className="items-center justify-center active:opacity-60"
                style={{ width: ACTION, height: ACTION }}>
                {downloading ? (
                  <ActivityIndicator color={BRAND} size="small" />
                ) : (
                  <SymbolView name={{ ios: 'arrow.down.to.line', android: 'download', web: 'download' }} tintColor={BRAND} size={22} />
                )}
              </Pressable>
            ) : (
              <View className="items-center justify-center" style={{ width: ACTION, height: ACTION }}>
                <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} tintColor={MUTED} size={16} />
              </View>
            )}
          </View>
        );
      })}

      {error ? (
        <Text accessibilityRole="alert" {...COMPACT_TEXT} className="text-accent" style={{ fontSize: 13, marginTop: 10 }}>
          {error}
        </Text>
      ) : null}

      {/* What a report holds. */}
      <Text {...COMPACT_TEXT} className="font-semibold text-muted" style={{ fontSize: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
        {t('prof.reports.inside')}
      </Text>
      <View className="flex-row" style={{ gap: 8, marginTop: 12 }}>
        {INSIDE.map((item) => (
          <View key={item.key} className="flex-1 items-center" style={{ gap: 6 }}>
            <SymbolView name={item.icon} tintColor={BRAND} size={17} />
            <Text {...COMPACT_TEXT} className="text-center font-semibold text-white" style={{ fontSize: 11 }} numberOfLines={2}>
              {t(item.key)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
