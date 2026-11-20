import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { ExercisePhoto } from '@/components/active-workout/exercise-photo';
import { parseExercises, type Exercise } from '@/components/active-workout/exercise-info';
import { DisplayText } from '@/components/display-text';
import { Bar, BRAND, CheckDot, COMPACT_TEXT, HAIRLINE, INK } from '@/components/today-card/ui';

/** The blinking dot of the LIVE label. */
function LiveDot() {
  const reduce = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    o.value = withRepeat(withSequence(withTiming(0.25, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, [reduce, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND }, style]} />;
}

function Stat({ label, value, unit, color = '#fff' }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <View className="flex-1">
      <Text {...COMPACT_TEXT} className="text-[10px] font-bold uppercase tracking-widest text-muted">
        {label}
      </Text>
      <View className="mt-0.5 flex-row items-baseline gap-1">
        <DisplayText {...COMPACT_TEXT} style={{ fontSize: 30, lineHeight: 34, color }} className="font-black">
          {value}
        </DisplayText>
        {unit ? (
          <Text {...COMPACT_TEXT} className="text-xs font-semibold text-muted">
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** One move. Tapping it opens the big moving photo and how to do it, right there in the list. */
function Row({
  ex,
  index,
  total,
  done,
  current,
  open,
  first,
  width,
  onToggleOpen,
  onToggleDone,
}: {
  ex: Exercise;
  index: number;
  total: number;
  done: boolean;
  current: boolean;
  open: boolean;
  first: boolean;
  /** Width of the list, for the big photo. */
  width: number;
  onToggleOpen: () => void;
  onToggleDone: () => void;
}) {
  return (
    <View style={first ? null : { borderTopWidth: 1, borderTopColor: HAIRLINE }}>
      <View className="flex-row items-center">
        <Pressable
          onPress={onToggleOpen}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`Move ${index + 1}: ${ex.name}${ex.amount ? `, ${ex.amount}` : ''}${done ? ', done' : ''}. ${open ? 'Hide' : 'Show'} how to do it`}
          className="flex-1 flex-row items-center gap-3 py-3 active:opacity-70"
          style={{ opacity: done && !open ? 0.5 : 1 }}>
          {open ? null : <ExercisePhoto pose={ex.pose} width={84} radius={12} />}
          <View className="flex-1">
            <Text {...COMPACT_TEXT} className={`text-[11px] font-black uppercase tracking-widest ${current && !done ? 'text-brand' : 'text-muted'}`}>
              {done ? 'Done' : current ? 'Now' : 'Up next'} · {index + 1} of {total}
            </Text>
            {open ? (
              <DisplayText {...COMPACT_TEXT} numberOfLines={2} className="mt-0.5 text-[24px] font-bold leading-7 tracking-tight text-white">
                {ex.name}
              </DisplayText>
            ) : (
              <Text
                {...COMPACT_TEXT}
                numberOfLines={1}
                className={`mt-0.5 text-[17px] font-bold ${done ? 'text-muted' : 'text-white'}`}
                style={done ? { textDecorationLine: 'line-through' } : undefined}>
                {ex.name}
              </Text>
            )}
            <Text {...COMPACT_TEXT} numberOfLines={1} className="mt-0.5 text-sm text-muted">
              {ex.amount ? <Text className="font-bold text-brand">{ex.amount}</Text> : null}
              {ex.amount ? '  ·  ' : ''}
              {ex.focus}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onToggleDone}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`Mark ${ex.name} as ${done ? 'not done' : 'done'}`}
          className="items-center justify-center active:opacity-70"
          style={{ width: 44, height: 48 }}>
          <CheckDot done={done} />
        </Pressable>
      </View>

      {open ? (
        <View className="pb-5">
          {width > 0 ? <ExercisePhoto pose={ex.pose} width={width} radius={20} animate={!done} /> : null}
          <Text {...COMPACT_TEXT} className="mt-3 text-[15px] leading-6 text-white/80">
            {ex.tip}
          </Text>
          <Pressable
            onPress={onToggleDone}
            accessibilityRole="button"
            accessibilityLabel={done ? `Mark ${ex.name} as not done` : `Mark ${ex.name} as done`}
            className={`mt-4 min-h-12 flex-row items-center justify-center gap-2 rounded-full active:opacity-80 ${done ? 'border border-white/15' : 'bg-white'}`}>
            <SymbolView name={done ? { ios: 'arrow.uturn.backward', android: 'undo', web: 'undo' } : { ios: 'checkmark', android: 'check', web: 'check' }} tintColor={done ? '#fff' : INK} size={15} />
            <Text {...COMPACT_TEXT} className={`text-base font-black ${done ? 'text-white' : 'text-ink'}`}>
              {done ? 'Undo' : index + 1 < total ? 'Done · Next move' : 'Done'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** The workout while it runs, shown in Today's plan where it was started: live time and burn, then every move with its photo. */
export function ActiveWorkoutCard({
  title,
  instructions,
  startedLabel,
  timeDisplay,
  kcal,
  busy,
  onFinish,
  onCancel,
}: {
  title: string;
  instructions?: string;
  startedLabel: string;
  timeDisplay: string;
  kcal: number;
  busy: boolean;
  onFinish: () => void;
  onCancel: () => void;
}) {
  const exercises = useMemo(() => parseExercises(instructions), [instructions]);
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  /** The move opened by hand ('' = all closed); null follows the first move still to do. */
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  const current = exercises.find((e) => !doneIds.has(e.id)) ?? null;
  const openId = pickedId ?? current?.id ?? null;
  const doneCount = exercises.filter((e) => doneIds.has(e.id)).length;
  const progress = exercises.length ? doneCount / exercises.length : 0;
  const allDone = exercises.length > 0 && doneCount === exercises.length;

  const toggleDone = (id: string) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Back to following the next move still to do.
    setPickedId(null);
  };

  return (
    <View className="pb-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <LiveDot />
          <Text {...COMPACT_TEXT} className="text-[11px] font-black uppercase tracking-widest text-brand">
            Live workout
          </Text>
        </View>
        <Text {...COMPACT_TEXT} className="text-xs text-muted">
          Started {startedLabel}
        </Text>
      </View>

      <DisplayText numberOfLines={2} className="mt-2 text-[28px] font-bold leading-9 tracking-tight text-white">
        {title}
      </DisplayText>

      <View className="mt-4 flex-row items-center gap-4">
        <Stat label="Time" value={timeDisplay} color={BRAND} />
        <View className="h-9 w-px bg-white/10" />
        <Stat label="Burn" value={String(kcal)} unit="kcal" color="#fb923c" />
        {exercises.length ? (
          <>
            <View className="h-9 w-px bg-white/10" />
            <Stat label="Moves" value={`${doneCount}/${exercises.length}`} />
          </>
        ) : null}
      </View>

      {exercises.length ? (
        <View className="mt-4">
          <Bar progress={progress} label="Workout progress" valueText={`${doneCount} of ${exercises.length} moves done`} height={6} />
        </View>
      ) : null}

      {exercises.length ? (
        <View className="mt-5" onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
          {exercises.map((ex, i) => (
            <Row
              key={ex.id}
              ex={ex}
              index={i}
              total={exercises.length}
              first={i === 0}
              width={width}
              done={doneIds.has(ex.id)}
              current={current?.id === ex.id}
              open={openId === ex.id}
              onToggleOpen={() => setPickedId(openId === ex.id ? '' : ex.id)}
              onToggleDone={() => toggleDone(ex.id)}
            />
          ))}
        </View>
      ) : instructions ? (
        <Text selectable {...COMPACT_TEXT} className="mt-4 text-sm leading-6 text-white">
          {instructions}
        </Text>
      ) : null}

      <View className="mt-6 flex-row items-center gap-3">
        <Pressable
          onPress={onFinish}
          disabled={busy}
          accessibilityRole="button"
          className={`min-h-14 flex-1 flex-row items-center justify-center gap-2 rounded-full active:opacity-80 ${allDone || !exercises.length ? 'bg-brand' : 'border border-brand/60'}`}>
          {busy ? (
            <ActivityIndicator color={allDone || !exercises.length ? INK : BRAND} size="small" />
          ) : (
            <>
              <SymbolView name={{ ios: 'flag.checkered', android: 'sports_score', web: 'sports_score' }} tintColor={allDone || !exercises.length ? INK : BRAND} size={17} />
              <Text {...COMPACT_TEXT} className={`text-base font-black ${allDone || !exercises.length ? 'text-ink' : 'text-brand'}`}>
                Finish workout
              </Text>
            </>
          )}
        </Pressable>
        <Pressable onPress={onCancel} disabled={busy} hitSlop={8} accessibilityRole="button" className="min-h-14 items-center justify-center px-4 active:opacity-60">
          <Text {...COMPACT_TEXT} className="text-sm font-semibold text-muted">
            Cancel
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
