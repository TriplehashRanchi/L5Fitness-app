import { useFocusEffect } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { useDeviceClock } from '@/hooks/use-device-clock';
import { Block, Screen } from '@/components/screen';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import { splitHighlight } from '@/lib/i18n';
import { badgeWords, getMilestones, type Badge, type Milestones } from '@/lib/together-api';
import { useT } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

// One symbol for each kind of badge (the server names them in SF Symbol words; Android and web get a close match).
const ICON: Record<string, SymbolViewProps['name']> = {
  sparkles: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  flame: { ios: 'flame', android: 'local_fire_department', web: 'local_fire_department' },
  'checkmark.seal': { ios: 'checkmark.seal', android: 'verified', web: 'verified' },
  'heart.text.square': { ios: 'heart.text.square', android: 'favorite', web: 'favorite' },
  'figure.strengthtraining.traditional': { ios: 'figure.strengthtraining.traditional', android: 'fitness_center', web: 'fitness_center' },
  'fork.knife': { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' },
  'figure.walk': { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  trophy: { ios: 'trophy', android: 'emoji_events', web: 'emoji_events' },
  'flag.checkered': { ios: 'flag.checkered', android: 'flag', web: 'flag' },
};

function BadgeTile({ b, fresh }: { b: Badge; fresh: boolean }) {
  const t = useT();
  const words = badgeWords(b, t);
  const earned = !!b.earnedAt;
  const state = earned ? t('care.milestonesEarnedA11y') : b.have != null && b.goal ? t('care.milestonesHaveA11y', { have: b.have, goal: b.goal }) : t('care.milestonesNotYetA11y');
  return (
    <View
      accessible
      accessibilityLabel={`${words.title}. ${state} ${words.how}`}
      className="flex-row items-center"
      style={{ gap: 14, paddingVertical: 12, opacity: earned ? 1 : 0.6 }}>
      <View className="items-center justify-center rounded-full" style={{ width: 52, height: 52, backgroundColor: earned ? 'rgba(61,220,104,0.18)' : 'rgba(255,255,255,0.08)' }}>
        <SymbolView name={ICON[b.icon] ?? ICON.sparkles} tintColor={earned ? BRAND : '#8fa396'} size={24} />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <Text {...COMPACT_TEXT} className="shrink font-bold text-white" style={{ fontSize: 16 }}>
            {words.title}
          </Text>
          {fresh ? (
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: BRAND }}>
              <Text {...COMPACT_TEXT} className="font-black" style={{ color: '#050a07', fontSize: 11 }}>
                {t('care.milestonesNew')}
              </Text>
            </View>
          ) : null}
        </View>
        <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
          {words.how}
        </Text>
        {!earned && b.have != null && b.goal ? (
          <View className="overflow-hidden rounded-full bg-white/10" style={{ height: 5, marginTop: 8 }}>
            <View className="rounded-full bg-brand" style={{ height: 5, width: `${Math.round((b.have / b.goal) * 100)}%` }} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Milestones: small celebrations for doing things (a streak, a perfect week, a month in), never for losing weight fast. */
export default function MilestonesScreen() {
  const { format } = useDeviceClock();
  const t = useT();
  const today = toDayKey(getZonedParts(new Date(), format.timeZone));
  const [data, setData] = useState<Milestones | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const m = await getMilestones(today);
      setData(m);
      // The ones earned this time are marked NEW once: the server only lists them the first time.
      setFresh((f) => (m.fresh.length ? m.fresh : f));
      setError(null);
    } catch (e) {
      setError(messageFrom(e));
    }
  }, [today]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const earned = data?.badges.filter((b) => b.earnedAt) ?? [];
  const next = data?.badges.filter((b) => !b.earnedAt) ?? [];
  return (
    <Screen title={t('profile.milestones')} intro={t('care.milestonesIntro')} error={error} onRefresh={load}>
      {data ? (
        <>
          <Block>
            <Text {...COMPACT_TEXT} className="font-black text-white" style={{ fontSize: 44 }}>
              {splitHighlight(t(data.streak === 1 ? 'care.bigStreakOne' : 'care.bigStreakMany', { n: data.streak })).map((part, i) =>
                part.highlight ? part.text : <Text key={i} className="text-muted" style={{ fontSize: 18 }}>{part.text}</Text>
              )}
            </Text>
            <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
              {t('care.milestonesDayCounts')}
            </Text>
          </Block>
          <Block title={t('care.milestonesEarned')} status={t('care.countOf', { done: earned.length, total: data.badges.length })}>
            {earned.length === 0 ? <Text {...COMPACT_TEXT} className="text-muted" style={{ fontSize: 14 }}>{t('care.milestonesFirst')}</Text> : earned.map((b) => <BadgeTile key={b.code} b={b} fresh={fresh.includes(b.code)} />)}
          </Block>
          {next.length ? <Block title={t('care.milestonesStill')}>{next.map((b) => <BadgeTile key={b.code} b={b} fresh={false} />)}</Block> : null}
        </>
      ) : null}
    </Screen>
  );
}
