import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { messageFrom } from '@/lib/http';
import type { Key as TextKey } from '@/lib/i18n';
import { getClientTargets, saveClientTargets, type ClientTargets } from '@/lib/wellness-api';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

type Key = keyof ClientTargets;
const FIELDS: { key: Key; labelKey: TextKey; unitKey: TextKey; min: number; max: number }[] = [
  { key: 'waterMl', labelKey: 'care.targetWater', unitKey: 'care.unitMlDay', min: 500, max: 10000 },
  { key: 'steps', labelKey: 'care.metricSteps', unitKey: 'care.unitStepsDay', min: 1000, max: 100000 },
  { key: 'calories', labelKey: 'care.targetCalories', unitKey: 'care.unitKcalDay', min: 800, max: 6000 },
  { key: 'proteinG', labelKey: 'care.targetProtein', unitKey: 'care.unitGramDay', min: 0, max: 500 },
  { key: 'weeklyWorkouts', labelKey: 'care.targetWorkouts', unitKey: 'care.unitPerWeek', min: 1, max: 7 },
];

const toText = (t: ClientTargets): Record<Key, string> => ({
  waterMl: t.waterMl?.toString() ?? '',
  steps: t.steps?.toString() ?? '',
  calories: t.calories?.toString() ?? '',
  proteinG: t.proteinG?.toString() ?? '',
  weeklyWorkouts: t.weeklyWorkouts?.toString() ?? '',
});

/** A dietitian sets (or clears) a client's daily targets. An empty field means "not set". */
export function ClientTargetsEditor({ memberId }: { memberId: string }) {
  const t = useT();
  const [values, setValues] = useState<Record<Key, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getClientTargets(memberId)
      .then((r) => !cancelled && setValues(toText(r.targets)))
      .catch((e) => !cancelled && setMessage({ kind: 'error', text: messageFrom(e) }));
    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const save = async () => {
    if (!values) return;
    const targets = {} as ClientTargets;
    for (const f of FIELDS) {
      const raw = values[f.key].trim();
      if (!raw) {
        targets[f.key] = null;
        continue;
      }
      const n = Number(raw);
      if (!Number.isInteger(n) || n < f.min || n > f.max) {
        return setMessage({ kind: 'error', text: t('care.targetRange', { field: t(f.labelKey), min: f.min, max: f.max }) });
      }
      targets[f.key] = n;
    }
    setBusy(true);
    setMessage(null);
    try {
      const saved = await saveClientTargets(memberId, targets);
      setValues(toText(saved.targets ?? targets));
      setMessage({ kind: 'ok', text: t('care.targetsSaved') });
    } catch (e) {
      setMessage({ kind: 'error', text: messageFrom(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="mx-5 mt-5 rounded-3xl border border-white/5 bg-card p-5">
      <Text className="text-base font-bold text-white">{t('care.targetsTitle')}</Text>
      <Text {...COMPACT_TEXT} className="mt-1 text-xs text-muted">
        {t('care.targetsHint')}
      </Text>
      {values ? (
        <View className="mt-4 gap-3">
          {FIELDS.map((f) => (
            <View key={f.key} className="flex-row items-center gap-3">
              <Text {...COMPACT_TEXT} className="w-24 text-sm font-semibold text-white">
                {t(f.labelKey)}
              </Text>
              <TextInput
                value={values[f.key]}
                onChangeText={(typed) => setValues((v) => (v ? { ...v, [f.key]: typed.replace(/\D/g, '') } : v))}
                keyboardType="number-pad"
                maxLength={6}
                placeholder={t('care.targetNotSet')}
                placeholderTextColor="#6f8577"
                selectionColor={BRAND}
                cursorColor={BRAND}
                accessibilityLabel={t('care.targetFieldLabel', { field: t(f.labelKey), unit: t(f.unitKey) })}
                style={{ minHeight: 44 }}
                className="flex-1 rounded-2xl border border-white/10 bg-card-2 px-4 text-base text-white"
              />
              <Text {...COMPACT_TEXT} className="w-20 text-xs text-muted">
                {t(f.unitKey)}
              </Text>
            </View>
          ))}
        </View>
      ) : !message ? (
        <View className="items-center py-6">
          <ActivityIndicator color={BRAND} />
        </View>
      ) : null}
      {message ? (
        <Text
          accessibilityRole="alert"
          className={`mt-3 text-sm ${message.kind === 'ok' ? 'text-brand' : 'text-white'}`}>
          {message.text}
        </Text>
      ) : null}
      {values ? (
        <Pressable
          onPress={save}
          disabled={busy}
          accessibilityRole="button"
          className="mt-4 items-center rounded-full bg-brand py-3 active:opacity-80">
          {busy ? <ActivityIndicator color="#050a07" /> : <Text className="font-bold text-ink">{t('care.targetsSave')}</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}
