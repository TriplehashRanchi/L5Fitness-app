import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { PAUSE_REASON_KEY, type PauseReason } from '@/lib/wellness-api';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const REASONS: PauseReason[] = ['illness', 'injury', 'clinician', 'other'];

/**
 * "Pause the plan": the reason and an optional note. Used by a member for their own plan and by a dietitian
 * for a client. Reminders stop while a plan is paused, and it only restarts after the dietitian confirms.
 */
export function PauseSheet({
  visible,
  title,
  message,
  confirmLabel,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  busy: boolean;
  error: string | null;
  onSubmit: (reason: PauseReason, note: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [reason, setReason] = useState<PauseReason | null>(null);
  const [note, setNote] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="flex-1 items-center justify-center bg-black/75 px-6">
          <View accessibilityViewIsModal className="w-full max-w-[420px] rounded-3xl border border-white/10 bg-card" style={{ padding: 20 }}>
            <Text {...COMPACT_TEXT} accessibilityRole="header" className="font-black text-white" style={{ fontSize: 20 }}>
              {title ?? t('profile.pausePlan')}
            </Text>
            <Text {...COMPACT_TEXT} className="mt-2 text-muted" style={{ fontSize: 14, lineHeight: 20 }}>
              {message ?? t('acc.pauseBody')}
            </Text>
            <Text {...COMPACT_TEXT} className="mb-2 mt-5 text-sm font-semibold text-white">
              {t('acc.why')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {REASONS.map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setReason(r)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: reason === r }}
                  className={`rounded-full px-5 py-2.5 ${reason === r ? 'bg-[#1a8f40]' : 'bg-white/5'}`}>
                  <Text {...COMPACT_TEXT} className={`text-sm font-semibold ${reason === r ? 'text-white' : 'text-white/60'}`}>
                    {t(PAUSE_REASON_KEY[r])}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('acc.pauseNote')}
              placeholderTextColor="#6f8577"
              selectionColor={BRAND}
              cursorColor={BRAND}
              multiline
              maxLength={300}
              maxFontSizeMultiplier={1.4}
              accessibilityLabel={t('acc.pauseNoteA11y')}
              className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 text-base text-white"
              style={{ minHeight: 76, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' }}
            />
            {error ? (
              <Text accessibilityRole="alert" {...COMPACT_TEXT} className="mt-3 text-accent" style={{ fontSize: 14 }}>
                {error}
              </Text>
            ) : null}
            <View className="mt-5 flex-row gap-3">
              <Pressable onPress={onClose} disabled={busy} accessibilityRole="button" className="flex-1 items-center justify-center rounded-full border border-white/15 px-3 py-3 active:opacity-70">
                <Text {...COMPACT_TEXT} className="text-center font-bold text-white">{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => reason && onSubmit(reason, note)}
                disabled={busy || !reason}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy || !reason }}
                className="flex-1 items-center justify-center rounded-full px-3 py-3 active:opacity-80"
                style={{ backgroundColor: reason ? BRAND : 'rgba(255,255,255,0.1)' }}>
                {busy ? <ActivityIndicator color={INK} /> : <Text {...COMPACT_TEXT} className="text-center font-bold" style={{ color: reason ? INK : '#6f8577' }}>{confirmLabel ?? t('acc.pauseConfirm')}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
