import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Bar, ErrorLine, PillButton, Section, TextLink } from '@/components/today-card/ui';
import type { StepsStatus } from '@/lib/steps/types';
import { useT } from '@/providers/language-provider';

const WALK = { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' } as const;

export type StepsConnection = {
  status: StepsStatus | 'loading';
  sourceName: string;
  connecting: boolean;
  connect: () => Promise<void>;
  openSettings: () => void;
};

export function StepsBlock({
  steps,
  goal,
  locale,
  connection,
  saving,
  error,
  onSave,
  onClearError,
  onHistory,
}: {
  steps: number | null;
  goal: number;
  locale: string;
  connection: StepsConnection;
  saving: boolean;
  error: string | null;
  onSave: (text: string) => Promise<boolean>;
  onClearError: () => void;
  onHistory: () => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const fmt = (n: number) => n.toLocaleString(locale);
  const done = steps != null && goal > 0 && steps >= goal;
  const value = steps == null ? `– / ${fmt(goal)}` : `${fmt(steps)} / ${fmt(goal)}`;
  const save = async () => {
    if (await onSave(text)) {
      setEditing(false);
      setText('');
    }
  };
  return (
    <Section icon={WALK} title={t('hm.steps')} status={value} done={done}>
      <Bar progress={steps != null && goal > 0 ? steps / goal : 0} label={t('hm.steps')} valueText={t('hm.stepsValue', { value })} />
      {editing ? (
        <View className="mt-3">
          <View className="flex-row items-center gap-2">
            <TextInput
              value={text}
              onChangeText={(typed) => {
                setText(typed.replace(/[^0-9]/g, ''));
                if (error) onClearError();
              }}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              editable={!saving}
              placeholder={t('hm.stepsToday')}
              placeholderTextColor="#8fa396"
              onSubmitEditing={save}
              returnKeyType="done"
              maxFontSizeMultiplier={1.3}
              accessibilityLabel={t('hm.stepsToday')}
              className="min-h-11 flex-1 rounded-full border border-white/10 bg-card-2 px-4 text-base text-white"
            />
            <PillButton primary label={t('common.save')} accessibilityLabel={t('hm.saveSteps')} busy={saving} onPress={save} />
            <PillButton
              label={t('common.cancel')}
              disabled={saving}
              onPress={() => {
                setEditing(false);
                setText('');
                onClearError();
              }}
            />
          </View>
          <ErrorLine message={error} />
        </View>
      ) : (
        <View className="mt-1 flex-row flex-wrap items-center gap-x-5">
          {connection.status === 'needs-permission' ? (
            <TextLink label={connection.connecting ? t('hm.connecting') : t('hm.connect', { source: connection.sourceName })} onPress={() => void connection.connect()} />
          ) : connection.status === 'needs-setup' ? (
            <TextLink label={t('hm.setUp', { source: connection.sourceName })} onPress={connection.openSettings} />
          ) : null}
          <TextLink label={t('hm.addSteps')} accessibilityLabel={t('hm.addStepsHand')} onPress={() => setEditing(true)} />
          <TextLink label={t('hm.history')} onPress={onHistory} />
        </View>
      )}
    </Section>
  );
}
