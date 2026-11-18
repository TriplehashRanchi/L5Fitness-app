import { useState, useEffect, useRef } from 'react';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, Text, Vibration, View } from 'react-native';
import { DisplayText } from '@/components/display-text';

const BRAND = '#3ddc68';
const INK = '#050a07';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;

const PRESETS = [30, 45, 60, 90, 120];

export function GymRestTimer() {
  const [totalSeconds, setTotalSeconds] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Trigger vibration and celebration when timer hits 0
  const notifyComplete = () => {
    setIsDone(true);
    setIsRunning(false);
    if (Platform.OS !== 'web') {
      try {
        Vibration.vibrate([0, 400, 150, 400]);
      } catch {
        // Safe fallback if vibration is not supported
      }
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 150, 400]);
      } catch {
        // Safe fallback
      }
    }
  };

  useEffect(() => {
    if (isRunning && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            notifyComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, remaining]);

  const selectPreset = (secs: number) => {
    setTotalSeconds(secs);
    setRemaining(secs);
    setIsDone(false);
    setIsRunning(true);
    setIsExpanded(true);
  };

  const toggleRun = () => {
    if (isDone || remaining === 0) {
      setRemaining(totalSeconds);
      setIsDone(false);
      setIsRunning(true);
    } else {
      setIsRunning((prev) => !prev);
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsDone(false);
    setRemaining(totalSeconds);
  };

  const addTime = (secs: number) => {
    setRemaining((prev) => prev + secs);
    setTotalSeconds((prev) => prev + secs);
    if (isDone) setIsDone(false);
  };

  const progressPercent = totalSeconds > 0 ? Math.max(0, Math.min(100, Math.round(((totalSeconds - remaining) / totalSeconds) * 100))) : 0;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <View className="mx-5 mb-5 overflow-hidden rounded-3xl border border-white/10 bg-card p-5">
      {/* Header bar */}
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => setIsExpanded((prev) => !prev)}
          className="flex-1 flex-row items-center gap-2.5 active:opacity-70">
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-card-2">
            <SymbolView
              name={{ ios: 'stopwatch.fill', android: 'timer', web: 'timer' }}
              tintColor={isRunning ? BRAND : '#8fa396'}
              size={18}
            />
          </View>
          <View>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-semibold tracking-wide text-white">
                Rest Timer
              </Text>
              {isRunning ? (
                <View className="flex-row items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5">
                  <View className="h-1.5 w-1.5 rounded-full bg-brand" />
                  <Text {...COMPACT_TEXT} className="text-[10px] font-semibold text-brand">
                    Active
                  </Text>
                </View>
              ) : isDone ? (
                <View className="flex-row items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5">
                  <Text {...COMPACT_TEXT} className="text-[10px] font-semibold text-brand">
                    Complete
                  </Text>
                </View>
              ) : null}
            </View>
            <Text {...COMPACT_TEXT} className="text-xs text-muted">
              {isRunning ? `${remaining}s remaining` : 'Interval between sets'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setIsExpanded((prev) => !prev)}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-full bg-card-2 active:opacity-70">
          <SymbolView
            name={
              isExpanded
                ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }
                : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }
            }
            tintColor="#8fa396"
            size={16}
          />
        </Pressable>
      </View>

      {/* When expanded or active */}
      {isExpanded ? (
        <View className="mt-4 pt-3 border-t border-white/5">
          {/* Large timer display */}
          <View className="items-center py-2">
            <DisplayText
              {...COMPACT_TEXT}
              style={{ fontSize: 44, lineHeight: 48 }}
              className={`font-black tracking-tight ${isDone ? 'text-brand' : isRunning ? 'text-brand' : 'text-white'}`}>
              {timeDisplay}
            </DisplayText>
            <Text {...COMPACT_TEXT} className="mt-1 text-xs text-muted">
              {isDone ? 'Rest interval complete' : isRunning ? 'Rest in progress' : 'Select interval'}
            </Text>
          </View>

          {/* Progress bar */}
          <View className="my-3 overflow-hidden rounded-full bg-card-2" style={{ height: 6 }}>
            <View
              className={`rounded-full ${isDone ? 'bg-accent' : 'bg-brand'}`}
              style={{ height: 6, width: isDone ? '100%' : `${progressPercent}%` }}
            />
          </View>

          {/* Presets row */}
          <View className="flex-row items-center justify-between gap-2 mt-2">
            {PRESETS.map((secs) => {
              const selected = totalSeconds === secs;
              return (
                <Pressable
                  key={secs}
                  onPress={() => selectPreset(secs)}
                  accessibilityRole="button"
                  accessibilityLabel={`${secs} seconds rest`}
                  className={`flex-1 items-center rounded-xl py-2 active:opacity-70 ${
                    selected ? 'bg-brand/20 border border-brand/50' : 'bg-card-2 border border-white/5'
                  }`}>
                  <Text
                    {...COMPACT_TEXT}
                    className={`text-xs font-bold ${selected ? 'text-brand' : 'text-muted'}`}>
                    {secs}s
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Control buttons */}
          <View className="flex-row items-center justify-center gap-3 mt-4">
            <Pressable
              onPress={() => addTime(15)}
              accessibilityRole="button"
              className="items-center rounded-full border border-white/10 bg-card-2 px-4 py-2.5 active:opacity-70">
              <Text {...COMPACT_TEXT} className="text-xs font-bold text-muted">
                +15s
              </Text>
            </Pressable>

            <Pressable
              onPress={toggleRun}
              accessibilityRole="button"
              className={`flex-row items-center gap-2 rounded-full px-6 py-2.5 active:opacity-80 ${
                isDone ? 'bg-accent' : isRunning ? 'bg-card-2 border border-white/15' : 'bg-brand'
              }`}>
              <SymbolView
                name={
                  isDone
                    ? { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }
                    : isRunning
                      ? { ios: 'pause.fill', android: 'pause', web: 'pause' }
                      : { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }
                }
                tintColor={isDone ? '#ffffff' : isRunning ? '#ffffff' : INK}
                size={14}
              />
              <Text
                {...COMPACT_TEXT}
                className={`text-sm font-bold ${isDone ? 'text-white' : isRunning ? 'text-white' : 'text-ink'}`}>
                {isDone ? 'Restart' : isRunning ? 'Pause' : 'Start'}
              </Text>
            </Pressable>

            <Pressable
              onPress={resetTimer}
              accessibilityRole="button"
              className="items-center rounded-full border border-white/10 bg-card-2 px-4 py-2.5 active:opacity-70">
              <Text {...COMPACT_TEXT} className="text-xs font-bold text-muted">
                Reset
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* Compact bar when collapsed */
        <View className="mt-3 flex-row items-center justify-between gap-2 border-t border-white/5 pt-3">
          <View className="flex-row gap-2">
            {[30, 60, 90].map((s) => (
              <Pressable
                key={s}
                onPress={() => selectPreset(s)}
                className="rounded-lg bg-card-2 px-3 py-1.5 active:opacity-70">
                <Text {...COMPACT_TEXT} className="text-xs font-semibold text-brand">
                  {s}s
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setIsExpanded(true)}
            className="flex-row items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 active:opacity-70">
            <Text {...COMPACT_TEXT} className="text-xs font-bold text-brand">
              Open Timer
            </Text>
            <SymbolView
              name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }}
              tintColor={BRAND}
              size={12}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}
