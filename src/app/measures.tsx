import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { DisplayText } from '@/components/display-text';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { parseDecimal } from '@/lib/body';
import { dayLabel, getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import {
  addMeasure,
  CONTEXT_LABEL_KEY,
  listMeasures,
  MEASURE_SPEC,
  ORIGIN_LABEL_KEY,
  readingText,
  removeMeasure,
  updateMeasure,
  type GlucoseContext,
  type Measure,
  type MeasureKind,
} from '@/lib/progress-api';
import { goBack } from '@/lib/navigation';
import { useLanguage } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const HAIRLINE = 'rgba(255,255,255,0.07)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const DAY_MS = 86_400_000;
const KINDS = Object.keys(MEASURE_SPEC) as MeasureKind[];
const shift = (key: string, days: number) => new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** A choice among a few: green when chosen. */
function Chip({ label, chosen, onPress }: { label: string; chosen: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: chosen }}
      className="justify-center active:opacity-70"
      // Colours written outright: left to a class, an unset style value can blank them on a phone.
      style={{ minHeight: 38, paddingHorizontal: 15, borderRadius: 19, borderWidth: 1, borderColor: chosen ? BRAND : 'rgba(255,255,255,0.14)', backgroundColor: chosen ? BRAND : 'rgba(255,255,255,0.05)' }}>
      <Text {...COMPACT_TEXT} style={{ fontSize: 13, fontWeight: '700', color: chosen ? INK : '#ffffff' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** One big number to type, with its unit under it. */
function BigNumber({ value, onChange, placeholder, unit, label }: { value: string; onChange: (typed: string) => void; placeholder: string; unit: string; label: string }) {
  return (
    <View className="flex-1 items-center" style={{ paddingVertical: 12, paddingHorizontal: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' }}>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor="#56635b"
        selectionColor={BRAND}
        cursorColor={BRAND}
        maxLength={6}
        accessibilityLabel={label}
        maxFontSizeMultiplier={1.2}
        style={{ alignSelf: 'stretch', textAlign: 'center', minHeight: 56, padding: 0, fontSize: 38, fontWeight: '900', color: '#ffffff' }}
      />
      <Text {...COMPACT_TEXT} className="font-semibold text-muted" style={{ fontSize: 13 }}>
        {unit}
      </Text>
    </View>
  );
}

/**
 * Waist and health readings the member chooses to keep: blood pressure, blood sugar, HbA1c, cholesterol.
 * Optional, and meant for readings a doctor asked them to track. The app only stores and shows the
 * numbers; it never says whether a number is good or bad.
 */
export default function MeasuresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { format } = useDeviceClock();
  const { t, language } = useLanguage();
  const today = toDayKey(getZonedParts(new Date(), format.timeZone));
  const { kind: startKind } = useLocalSearchParams<{ kind?: string }>();

  const [items, setItems] = useState<Measure[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // "Log waist" on Profile comes here with ?kind=waist_cm: the form is open straight away.
  const preset = startKind && startKind in MEASURE_SPEC ? (startKind as MeasureKind) : null;
  const [sheet, setSheet] = useState<{ editing: Measure | null } | null>(preset ? { editing: null } : null);
  const [removing, setRemoving] = useState<Measure | null>(null);
  const [busy, setBusy] = useState(false);

  // The add form
  const [kind, setKind] = useState<MeasureKind>(preset ?? 'waist_cm');
  const [value, setValue] = useState('');
  const [value2, setValue2] = useState('');
  const [context, setContext] = useState<GlucoseContext | null>(null);
  const [day, setDay] = useState(today);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await listMeasures()).measurements);
      setLoadError(null);
    } catch (e) {
      setLoadError(messageFrom(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const open = (editing: Measure | null, preset?: MeasureKind) => {
    setError(null);
    setKind(editing?.kind ?? preset ?? 'waist_cm');
    setValue(editing ? String(editing.value) : '');
    setValue2(editing?.value2 != null ? String(editing.value2) : '');
    setContext(editing?.context ?? null);
    setDay(editing?.day ?? today);
    setNote(editing?.note ?? '');
    setSheet({ editing });
  };

  const spec = MEASURE_SPEC[kind];
  const save = async () => {
    const v = parseDecimal(value);
    const specName = language === 'en' ? t(spec.labelKey).toLowerCase() : t(spec.labelKey);
    if (v == null || v < spec.min || v > spec.max) return setError(t('care.measureEnter', { name: specName, min: spec.min, max: spec.max, unit: spec.unit }));
    let v2: number | undefined;
    if (kind === 'bp') {
      const second = parseDecimal(value2);
      if (second == null || second < (spec.min2 ?? 0) || second > (spec.max2 ?? 999)) return setError(t('care.measureEnterBottom', { min: spec.min2 ?? 0, max: spec.max2 ?? 999 }));
      if (second >= v) return setError(t('care.measureTopHigher'));
      v2 = second;
    }
    setBusy(true);
    setError(null);
    const input = { kind, value: v, value2: v2, context: kind === 'glucose' && context ? context : undefined, day, today, note: note.trim() || undefined };
    try {
      if (sheet?.editing) await updateMeasure(sheet.editing.id, input);
      else await addMeasure(input);
      setSheet(null);
      await load();
    } catch (e) {
      setError(messageFrom(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await removeMeasure(removing.id);
      setRemoving(null);
      await load();
    } catch (e) {
      setLoadError(messageFrom(e));
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110, width: '100%', maxWidth: 840, alignSelf: 'center' }}>
        <View className="flex-row items-center gap-3 px-5 pb-2">
          <Pressable onPress={() => goBack(router)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')} className="h-11 w-11 items-center justify-center rounded-full border border-white/10 active:opacity-70">
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} tintColor="white" size={16} />
          </Pressable>
          <DisplayText className="flex-1 text-[30px] font-bold tracking-tight text-white">{t('care.measureTitle')}</DisplayText>
        </View>
        <Text {...COMPACT_TEXT} className="px-5 text-sm leading-5 text-muted">
          {t('care.measureIntro')}
        </Text>

        {loadError ? (
          <View accessibilityRole="alert" className="mx-5 mt-4 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3">
            <Text className="text-sm text-white">{loadError}</Text>
          </View>
        ) : null}
        {!items && !loadError ? <ActivityIndicator color={BRAND} style={{ marginTop: 40 }} /> : null}
        {items && items.length === 0 ? (
          <Text {...COMPACT_TEXT} className="px-5 text-muted" style={{ marginTop: 40, textAlign: 'center', fontSize: 15 }}>
            {t('care.measureEmpty')}
          </Text>
        ) : null}

        <View className="px-5" style={{ marginTop: 18 }}>
          {items?.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => (m.verified ? undefined : open(m))}
              disabled={m.verified}
              accessibilityRole="button"
              accessibilityLabel={`${t(MEASURE_SPEC[m.kind].labelKey)} ${readingText(m)}, ${dayLabel(m.day, today, format.locale)}, ${t(ORIGIN_LABEL_KEY[m.origin])}`}
              className="flex-row items-center active:opacity-70"
              style={{ gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: HAIRLINE }}>
              <View className="flex-1">
                <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13 }}>
                  {t(MEASURE_SPEC[m.kind].labelKey)}
                  {m.context ? ` · ${t(CONTEXT_LABEL_KEY[m.context])}` : ''}
                </Text>
                <Text {...COMPACT_TEXT} className="font-black text-white" style={{ fontSize: 22, marginTop: 1 }}>
                  {readingText(m)}
                </Text>
                {m.note ? (
                  <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 2 }} numberOfLines={2}>
                    {m.note}
                  </Text>
                ) : null}
              </View>
              <View className="items-end" style={{ gap: 4, maxWidth: '50%' }}>
                <Text {...COMPACT_TEXT} className="text-white" style={{ fontSize: 13 }}>
                  {dayLabel(m.day, today, format.locale)}
                </Text>
                <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: m.verified ? 'rgba(61,220,104,0.15)' : 'rgba(255,255,255,0.08)' }}>
                  <Text {...COMPACT_TEXT} className="font-bold" style={{ fontSize: 11, color: m.verified ? BRAND : '#c4d0c8' }}>
                    {m.edited ? t('care.measureEdited', { origin: t(ORIGIN_LABEL_KEY[m.origin]) }) : t(ORIGIN_LABEL_KEY[m.origin])}
                  </Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* A small button floating at the lower right. It rises into place when the screen opens. */}
      <Animated.View entering={FadeInDown.delay(150).springify()} style={{ position: 'absolute', right: 20, bottom: insets.bottom + 20 }}>
        <Pressable
          onPress={() => open(null)}
          accessibilityRole="button"
          className="flex-row items-center active:opacity-80"
          style={{ gap: 8, minHeight: 50, paddingLeft: 18, paddingRight: 22, borderRadius: 25, backgroundColor: BRAND, boxShadow: '0px 6px 18px rgba(61,220,104,0.35)' }}>
          <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={INK} size={16} />
          <Text {...COMPACT_TEXT} className="font-black" style={{ color: INK, fontSize: 15 }}>
            {t('care.measureAdd')}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Add or correct a reading */}
      <BottomSheet
        visible={sheet != null}
        title={sheet?.editing ? t('care.measureCorrect') : t('care.measureAddOne')}
        subtitle={sheet?.editing ? `${t(spec.labelKey)} · ${t(ORIGIN_LABEL_KEY[sheet.editing.origin])}` : undefined}
        onClose={() => setSheet(null)}
        footer={
          <>
            <Pressable onPress={save} disabled={busy} accessibilityRole="button" accessibilityState={{ busy }} className="items-center justify-center rounded-full active:opacity-80" style={{ minHeight: 54, backgroundColor: BRAND }}>
              {busy ? (
                <ActivityIndicator color={INK} />
              ) : (
                <Text {...COMPACT_TEXT} className="text-center font-black" style={{ color: INK, fontSize: 16 }}>
                  {t('common.save')}
                </Text>
              )}
            </Pressable>
            {sheet?.editing ? (
              <Pressable
                onPress={() => {
                  const m = sheet.editing;
                  setSheet(null);
                  setRemoving(m);
                }}
                disabled={busy}
                accessibilityRole="button"
                className="flex-row items-center justify-center active:opacity-60"
                style={{ gap: 7, minHeight: 46, marginTop: 4 }}>
                <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} tintColor="#ff5a4f" size={15} />
                <Text {...COMPACT_TEXT} className="font-bold" style={{ fontSize: 14, color: '#ff5a4f' }}>
                  {t('care.delete')}
                </Text>
              </Pressable>
            ) : null}
          </>
        }>
        {sheet?.editing ? null : (
          <View className="flex-row flex-wrap" style={{ gap: 8, marginBottom: 14 }}>
            {KINDS.map((k) => (
              <Chip key={k} label={t(MEASURE_SPEC[k].labelKey)} chosen={kind === k} onPress={() => { setKind(k); setError(null); }} />
            ))}
          </View>
        )}

        <View className="flex-row items-center" style={{ gap: 10 }}>
          <BigNumber
            value={value}
            onChange={(typed) => { setValue(typed); setError(null); }}
            placeholder={kind === 'bp' ? t('care.measureTop') : '0'}
            unit={spec.unit}
            label={kind === 'bp' ? t('care.measureTopNumber') : t('care.measureValueIn', { name: t(spec.labelKey), unit: spec.unit })}
          />
          {kind === 'bp' ? (
            <>
              <Text className="text-3xl text-muted">/</Text>
              <BigNumber value={value2} onChange={(typed) => { setValue2(typed); setError(null); }} placeholder={t('care.measureBottom')} unit={spec.unit} label={t('care.measureBottomNumber')} />
            </>
          ) : null}
        </View>

        {error ? (
          <Text accessibilityRole="alert" {...COMPACT_TEXT} className="text-center text-accent" style={{ fontSize: 14, marginTop: 10 }}>
            {error}
          </Text>
        ) : null}

        {kind === 'glucose' ? (
          <View className="flex-row flex-wrap justify-center" style={{ gap: 8, marginTop: 12 }}>
            {(Object.keys(CONTEXT_LABEL_KEY) as GlucoseContext[]).map((c) => (
              <Chip key={c} label={t(CONTEXT_LABEL_KEY[c])} chosen={context === c} onPress={() => setContext(context === c ? null : c)} />
            ))}
          </View>
        ) : null}

        {/* The day: today, or earlier for a lab report. */}
        <View className="flex-row items-center justify-between" style={{ marginTop: 14, minHeight: 56, paddingHorizontal: 8, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <Pressable onPress={() => setDay((d) => shift(d, -1))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('care.measureEarlier')} className="h-10 w-10 items-center justify-center active:opacity-60">
            <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} tintColor="white" size={16} />
          </Pressable>
          <View className="flex-1 flex-row items-center justify-center" style={{ gap: 8 }}>
            <SymbolView name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }} tintColor={BRAND} size={16} />
            <Text {...COMPACT_TEXT} className="shrink font-bold text-white" style={{ fontSize: 15 }}>
              {dayLabel(day, today, format.locale)}
            </Text>
          </View>
          <Pressable onPress={() => setDay((d) => (d >= today ? d : shift(d, 1)))} disabled={day >= today} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('care.measureLater')} className="h-10 w-10 items-center justify-center active:opacity-60" style={{ opacity: day >= today ? 0.25 : 1 }}>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor="white" size={16} />
          </Pressable>
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t('care.noteOptional')}
          placeholderTextColor="#6f8577"
          selectionColor={BRAND}
          cursorColor={BRAND}
          maxLength={200}
          maxFontSizeMultiplier={1.4}
          accessibilityLabel={t('meal.note')}
          style={{ minHeight: 52, marginTop: 10, paddingHorizontal: 16, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', color: '#ffffff', fontSize: 15 }}
        />

        {spec.clinical ? (
          <View className="flex-row" style={{ gap: 8, marginTop: 12 }}>
            <SymbolView name={{ ios: 'info.circle', android: 'info', web: 'info' }} tintColor="#8fa396" size={14} style={{ marginTop: 2 }} />
            <Text {...COMPACT_TEXT} className="flex-1 text-muted" style={{ fontSize: 12, lineHeight: 17 }}>
              {t('care.measureReportNote')}
            </Text>
          </View>
        ) : null}
      </BottomSheet>

      <ConfirmSheet
        visible={removing != null}
        title={t('care.measureDeleteQ')}
        message={t('care.measureDeleteMsg')}
        confirmLabel={t('care.delete')}
        destructive
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </View>
  );
}
