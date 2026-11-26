import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

      <View className="absolute bottom-0 left-0 right-0 px-5" style={{ paddingBottom: insets.bottom + 16, paddingTop: 12, backgroundColor: 'rgba(0,0,0,0.92)' }}>
        <Pressable onPress={() => open(null)} accessibilityRole="button" className="h-14 flex-row items-center justify-center rounded-full active:opacity-80" style={{ gap: 8, backgroundColor: BRAND }}>
          <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} tintColor={INK} size={15} />
          <Text {...COMPACT_TEXT} className="text-base font-black" style={{ color: INK }}>
            {t('care.measureAdd')}
          </Text>
        </Pressable>
      </View>

      {/* Add or correct a reading */}
      <Modal visible={sheet != null} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: 'rgba(0,0,0,0.78)' }}>
            <View accessibilityViewIsModal className="w-full rounded-3xl border border-white/10 bg-card" style={{ maxWidth: 440, maxHeight: '92%' }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
                <Text {...COMPACT_TEXT} accessibilityRole="header" className="font-black text-white" style={{ fontSize: 20 }}>
                  {sheet?.editing ? t('care.measureCorrect') : t('care.measureAddOne')}
                </Text>

                {sheet?.editing ? null : (
                  <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 14 }}>
                    {KINDS.map((k) => (
                      <Pressable
                        key={k}
                        onPress={() => { setKind(k); setError(null); }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: kind === k }}
                        className={`rounded-full px-4 py-2 ${kind === k ? 'bg-[#1a8f40]' : 'bg-white/5'}`}>
                        <Text {...COMPACT_TEXT} className={`text-sm font-semibold ${kind === k ? 'text-white' : 'text-white/60'}`}>
                          {t(MEASURE_SPEC[k].labelKey)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {spec.clinical ? (
                  <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 12, lineHeight: 17, marginTop: 12 }}>
                    {t('care.measureReportNote')}
                  </Text>
                ) : null}

                <View className="flex-row items-center" style={{ gap: 10, marginTop: 16 }}>
                  <View className="flex-1 flex-row items-center rounded-xl border border-white/10 bg-white/5 px-4">
                    <TextInput
                      value={value}
                      onChangeText={(typed) => { setValue(typed); setError(null); }}
                      keyboardType="decimal-pad"
                      placeholder={kind === 'bp' ? t('care.measureTop') : '0'}
                      placeholderTextColor="#6f8577"
                      selectionColor={BRAND}
                      cursorColor={BRAND}
                      maxLength={6}
                      accessibilityLabel={kind === 'bp' ? t('care.measureTopNumber') : t('care.measureValueIn', { name: t(spec.labelKey), unit: spec.unit })}
                      maxFontSizeMultiplier={1.4}
                      className="flex-1 text-white"
                      style={{ minHeight: 56, fontSize: 22, fontWeight: '800' }}
                    />
                    {kind === 'bp' ? null : <Text {...COMPACT_TEXT} className="text-muted">{spec.unit}</Text>}
                  </View>
                  {kind === 'bp' ? (
                    <>
                      <Text className="text-2xl text-muted">/</Text>
                      <View className="flex-1 flex-row items-center rounded-xl border border-white/10 bg-white/5 px-4">
                        <TextInput
                          value={value2}
                          onChangeText={(typed) => { setValue2(typed); setError(null); }}
                          keyboardType="decimal-pad"
                          placeholder={t('care.measureBottom')}
                          placeholderTextColor="#6f8577"
                          selectionColor={BRAND}
                          cursorColor={BRAND}
                          maxLength={6}
                          accessibilityLabel={t('care.measureBottomNumber')}
                          maxFontSizeMultiplier={1.4}
                          className="flex-1 text-white"
                          style={{ minHeight: 56, fontSize: 22, fontWeight: '800' }}
                        />
                        <Text {...COMPACT_TEXT} className="text-muted">mmHg</Text>
                      </View>
                    </>
                  ) : null}
                </View>

                {kind === 'glucose' ? (
                  <View className="flex-row flex-wrap" style={{ gap: 8, marginTop: 12 }}>
                    {(Object.keys(CONTEXT_LABEL_KEY) as GlucoseContext[]).map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => setContext(context === c ? null : c)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: context === c }}
                        className={`rounded-full px-4 py-2 ${context === c ? 'bg-[#1a8f40]' : 'bg-white/5'}`}>
                        <Text {...COMPACT_TEXT} className={`text-sm font-semibold ${context === c ? 'text-white' : 'text-white/60'}`}>
                          {t(CONTEXT_LABEL_KEY[c])}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {/* The day: today, or earlier for a lab report. */}
                <View className="flex-row items-center justify-between" style={{ marginTop: 16 }}>
                  <Pressable onPress={() => setDay((d) => shift(d, -1))} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('care.measureEarlier')} className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-70">
                    <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} tintColor="white" size={13} />
                  </Pressable>
                  <Text {...COMPACT_TEXT} className="font-bold text-white" style={{ fontSize: 15 }}>
                    {dayLabel(day, today, format.locale)}
                  </Text>
                  <Pressable onPress={() => setDay((d) => (d >= today ? d : shift(d, 1)))} disabled={day >= today} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('care.measureLater')} className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:opacity-70" style={{ opacity: day >= today ? 0.3 : 1 }}>
                    <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} tintColor="white" size={13} />
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
                  className="rounded-xl border border-white/10 bg-white/5 px-4 text-base text-white"
                  style={{ minHeight: 48, marginTop: 14 }}
                />

                {error ? (
                  <Text accessibilityRole="alert" {...COMPACT_TEXT} className="text-accent" style={{ fontSize: 14, marginTop: 12 }}>
                    {error}
                  </Text>
                ) : null}

                <View className="flex-row" style={{ gap: 10, marginTop: 18 }}>
                  {sheet?.editing ? (
                    <Pressable onPress={() => { const m = sheet.editing; setSheet(null); setRemoving(m); }} accessibilityRole="button" className="items-center justify-center rounded-full border active:opacity-70" style={{ minHeight: 50, paddingHorizontal: 18, borderColor: 'rgba(255,90,79,0.5)' }}>
                      <Text {...COMPACT_TEXT} className="font-bold" style={{ color: '#ff5a4f' }}>{t('care.delete')}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => setSheet(null)} disabled={busy} accessibilityRole="button" className="flex-1 items-center justify-center rounded-full border border-white/15 active:opacity-70" style={{ minHeight: 50 }}>
                    <Text {...COMPACT_TEXT} className="text-center font-bold text-white">{t('common.cancel')}</Text>
                  </Pressable>
                  <Pressable onPress={save} disabled={busy} accessibilityRole="button" className="flex-1 items-center justify-center rounded-full active:opacity-80" style={{ minHeight: 50, backgroundColor: BRAND }}>
                    {busy ? <ActivityIndicator color={INK} /> : <Text {...COMPACT_TEXT} className="text-center font-black" style={{ color: INK }}>{t('common.save')}</Text>}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
