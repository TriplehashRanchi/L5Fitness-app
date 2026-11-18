import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { messageFrom } from '@/lib/http';
import { getClientTraining, removeClientTraining, saveClientTraining } from '@/lib/wellness-api';

export function ClientTrainingEditor({ memberId, day }: { memberId: string; day: string }) {
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState('45');
  const [kcal, setKcal] = useState('0');
  const [instructions, setInstructions] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exists, setExists] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getClientTraining(memberId, day).then(({ plan }) => {
      if (cancelled) return;
      setTitle(plan?.title ?? '');
      setMinutes(String(plan?.durationMin ?? 45));
      setKcal(String(plan?.kcal ?? 0));
      setInstructions(plan?.instructions ?? '');
      setExists(!!plan);
      setLoaded(true);
    }).catch((e) => !cancelled && setNotice(messageFrom(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [memberId, day]);

  async function save() {
    const durationMin = Number(minutes);
    const calories = Number(kcal);
    if (!title.trim() || !instructions.trim()) return setNotice('Add a title and exercise instructions.');
    if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 600) return setNotice('Duration must be 1–600 whole minutes.');
    if (!Number.isInteger(calories) || calories < 0 || calories > 5000) return setNotice('Calories must be a whole number from 0 to 5000.');
    setBusy(true);
    try {
      await saveClientTraining(memberId, { day, title: title.trim(), durationMin, kcal: calories, instructions: instructions.trim() });
      setExists(true);
      setNotice('Saved. This exercise plan is available on the member’s home screen.');
    } catch (e) { setNotice(messageFrom(e)); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try {
      await removeClientTraining(memberId, day);
      setTitle(''); setInstructions(''); setMinutes('45'); setKcal('0'); setExists(false); setConfirm(false);
      setNotice('Exercise plan removed.');
    } catch (e) { setNotice(messageFrom(e)); }
    finally { setBusy(false); }
  }

  return <View className="mx-5 mt-5 rounded-3xl border border-white/10 bg-card p-5">
    <Text className="text-lg font-bold text-white">Exercise plan</Text>
    <Text className="mt-1 text-xs text-muted">{day} · For this member only</Text>
    {notice ? <Text accessibilityRole="alert" className="mt-3 text-sm text-brand">{notice}</Text> : null}
    {loading ? <ActivityIndicator color="#3ddc68" className="my-5" /> : loaded ? <View className="mt-4 gap-4">
      {[
        { label: 'Workout title', value: title, change: setTitle, max: 80, numeric: false, multiline: false },
        { label: 'Duration (minutes)', value: minutes, change: setMinutes, max: 3, numeric: true, multiline: false },
        { label: 'Estimated calories', value: kcal, change: setKcal, max: 4, numeric: true, multiline: false },
        { label: 'Exercises, sets, reps & rest intervals', value: instructions, change: setInstructions, max: 4000, numeric: false, multiline: true },
      ].map((f) => <View key={f.label}>
        <Text className="mb-2 text-xs font-semibold text-muted">{f.label}</Text>
        <TextInput accessibilityLabel={f.label} value={f.value} onChangeText={f.change} editable={!busy} maxLength={f.max} multiline={f.multiline} keyboardType={f.numeric ? 'number-pad' : 'default'} selectionColor="#3ddc68" style={{ minHeight: f.multiline ? 160 : 48, textAlignVertical: f.multiline ? 'top' : 'center' }} className="rounded-2xl border border-white/10 bg-card-2 px-4 py-3 text-base text-white" />
      </View>)}
      <Pressable accessibilityRole="button" onPress={save} disabled={busy} className="min-h-14 items-center justify-center rounded-full bg-brand px-4 active:opacity-80">
        {busy ? <ActivityIndicator color="#050a07" /> : <Text className="font-bold text-ink">Save exercise plan</Text>}
      </Pressable>
      {exists ? <Pressable accessibilityRole="button" onPress={() => setConfirm(true)} disabled={busy} className="min-h-11 items-center justify-center"><Text className="text-sm text-muted">Remove exercise plan</Text></Pressable> : null}
    </View> : <Text className="mt-3 text-sm text-muted">Could not load this plan. Reopen this client to try again.</Text>}
    <ConfirmSheet visible={confirm} title="Remove exercise plan?" message={`The member will no longer see the plan for ${day}.`} confirmLabel="Remove" busy={busy} onConfirm={remove} onCancel={() => setConfirm(false)} />
  </View>;
}
