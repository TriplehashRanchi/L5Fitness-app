import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Bar, ErrorLine, PillButton, Section, TextLink } from '@/components/today-card/ui';
import type { StepsStatus } from '@/lib/steps/types';

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
    <Section icon={WALK} title="Steps" status={value} done={done}>
      <Bar progress={steps != null && goal > 0 ? steps / goal : 0} label="Steps" valueText={`${value} steps`} />
      {editing ? (
        <View className="mt-3">
          <View className="flex-row items-center gap-2">
            <TextInput
              value={text}
              onChangeText={(t) => {
                setText(t.replace(/[^0-9]/g, ''));
                if (error) onClearError();
              }}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              editable={!saving}
              placeholder="Steps today"
              placeholderTextColor="#8fa396"
              onSubmitEditing={save}
              returnKeyType="done"
              maxFontSizeMultiplier={1.3}
              accessibilityLabel="Steps today"
              className="min-h-11 flex-1 rounded-full border border-white/10 bg-card-2 px-4 text-base text-white"
            />
            <PillButton primary label="Save" accessibilityLabel="Save steps" busy={saving} onPress={save} />
            <PillButton
              label="Cancel"
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
            <TextLink label={connection.connecting ? 'Connecting…' : `Connect ${connection.sourceName}`} onPress={() => void connection.connect()} />
          ) : connection.status === 'needs-setup' ? (
            <TextLink label={`Set up ${connection.sourceName}`} onPress={connection.openSettings} />
          ) : null}
          <TextLink label="Add steps" accessibilityLabel="Add today's steps by hand" onPress={() => setEditing(true)} />
          <TextLink label="History" onPress={onHistory} />
        </View>
      )}
    </Section>
  );
}
