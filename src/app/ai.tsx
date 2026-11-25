import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoachLogo } from '@/components/coach-logo';
import { DisplayText } from '@/components/display-text';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { askCoach, getAiStatus, type AiTurn } from '@/lib/ai-api';
import { newMessageId } from '@/lib/chat-api';
import { getZonedParts, toDayKey } from '@/lib/datetime';
import { ApiError, messageFrom } from '@/lib/http';
import { acquireSocket, releaseSocket } from '@/lib/realtime';
import { useAuth } from '@/providers/auth-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const MUTED = '#8fa396';
const SOFT = 'rgba(255,255,255,0.08)';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const MAX_LENGTH = 2000;
/** How much of the conversation is kept on the phone and sent along with a new question. */
const KEEP = 40;

/** One message on screen. `state` is set on the coach's answer while it is on its way, or when it failed. */
type Message = { id: string; role: 'user' | 'assistant'; content: string; state?: 'writing' | 'failed' };

/** The coach's mark (see CoachLogo) with a soft green glow behind it that breathes, faster while it is thinking. */
function Orb({ size, busy = false }: { size: number; busy?: boolean }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    const ms = busy ? 700 : 2000;
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: ms, easing: Easing.inOut(Easing.quad) })), -1);
  }, [reduced, busy, pulse]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.18 + pulse.value * 0.35, transform: [{ scale: 1.12 + pulse.value * 0.16 }] }));
  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      {/* the ball sits a touch below the middle of its box and is 88% of it wide */}
      <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size * 0.88, height: size * 0.88, borderRadius: size / 2, top: size * 0.08, backgroundColor: BRAND }, ring]} />
      <CoachLogo size={size} />
    </View>
  );
}

/** One of the three "thinking" dots: it brightens and dims, a little after the one before it. */
function Dot({ delay }: { delay: number }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 380 }), withTiming(0, { duration: 380 }), withTiming(0, { duration: 440 })), -1));
  }, [reduced, delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: 0.3 + v.value * 0.7, transform: [{ translateY: -3 * v.value }] }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#ffffff' }, style]} />;
}

/** Three dots, one after the other: the coach is thinking and has not written anything yet. */
function Thinking() {
  return (
    <View accessible accessibilityLabel="L5 Coach is thinking" accessibilityLiveRegion="polite" className="flex-row items-center" style={{ gap: 5, height: 24 }}>
      <Dot delay={0} />
      <Dot delay={160} />
      <Dot delay={320} />
    </View>
  );
}

/** **bold** inside a line. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
          <Text key={i} style={{ fontWeight: '700', color: '#ffffff' }}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          p
        )
      )}
    </>
  );
}

/**
 * The coach's answer. It writes plain text with light marks: **bold**, "- " for a bullet, "1." for a step.
 * Those are drawn properly; anything else is shown as it is.
 */
function Answer({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <View style={{ gap: 6 }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{ height: 4 }} />;
        const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
        const step = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
        const heading = /^\s*#{1,4}\s+(.*)$/.exec(line);
        if (bullet || step) {
          return (
            <View key={i} className="flex-row" style={{ gap: 10 }}>
              <Text {...COMPACT_TEXT} style={{ width: step ? 22 : 12, fontSize: 16, lineHeight: 24, color: BRAND, fontWeight: '700' }}>
                {step ? `${step[1]}.` : '•'}
              </Text>
              <Text {...COMPACT_TEXT} selectable className="flex-1" style={{ fontSize: 16, lineHeight: 24, color: '#e9efea' }}>
                <Inline text={(bullet ? bullet[1] : step![2]) ?? ''} />
              </Text>
            </View>
          );
        }
        return (
          <Text key={i} {...COMPACT_TEXT} selectable style={{ fontSize: 16, lineHeight: 24, color: '#e9efea', fontWeight: heading ? '700' : '400' }}>
            <Inline text={heading ? heading[1] : line} />
          </Text>
        );
      })}
    </View>
  );
}

type Idea = { icon: SymbolViewProps['name']; color: string; title: string; ask: string };

/** Four things to ask, so the first tap is easy. The food one follows the time of day. */
function ideasFor(hour: number): Idea[] {
  const meal = hour < 11 ? 'breakfast' : hour < 16 ? 'lunch' : hour < 19 ? 'an evening snack' : 'dinner';
  return [
    { icon: { ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }, color: '#fb923c', title: `Plan my ${meal.replace('an evening ', '')}`, ask: `What should I have for ${meal}?` },
    { icon: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }, color: BRAND, title: '15-minute workout', ask: 'Give me a 15-minute home workout' },
    { icon: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' }, color: '#38bdf8', title: 'How is my day going?', ask: 'How am I doing with my plan today?' },
    { icon: { ios: 'moon.zzz.fill', android: 'bedtime', web: 'bedtime' }, color: '#a78bfa', title: 'I missed a workout', ask: 'I missed my workout. What now?' },
  ];
}

/** Short things to say next, offered under the coach's latest answer. */
const FOLLOW_UPS = ['Make it shorter', 'Give me another option', 'Explain why'];

function greeting(hour: number) {
  if (hour < 5) return 'Up late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * L5 Coach: the AI assistant. Opened from the sparkle at the top of Home. One conversation, kept on this
 * phone; each question goes to our server (which holds the key and adds the member's plan), and the answer
 * is shown as it is written.
 */
export default function CoachScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { format } = useDeviceClock();
  const userId = session?.user.id ?? 'nobody';
  const firstName = (session?.user.name ?? '').trim().split('@')[0].split(/\s+/)[0] || 'there';
  const storeKey = `l5-coach-chat:${userId}`;

  /** null until the saved conversation has been read. */
  const [messages, setMessages] = useState<Message[] | null>(null);
  /** null = still asking the server; false = the coach is not switched on yet. */
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const current = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The conversation so far, from this phone.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storeKey)
      .then((raw) => {
        if (cancelled) return;
        const saved = raw ? (JSON.parse(raw) as Message[]) : [];
        // An answer that was still being written when the app closed never arrived: drop it.
        setMessages(Array.isArray(saved) ? saved.filter((m) => !m.state && typeof m.content === 'string') : []);
      })
      .catch(() => !cancelled && setMessages([]));
    return () => {
      cancelled = true;
    };
  }, [storeKey]);

  useEffect(() => {
    if (!messages) return;
    const keep = messages.filter((m) => !m.state).slice(-KEEP);
    AsyncStorage.setItem(storeKey, JSON.stringify(keep)).catch(() => {});
  }, [messages, storeKey]);

  const checkStatus = useCallback(() => {
    getAiStatus()
      .then((s) => mounted.current && setEnabled(s.enabled))
      // Could not ask (offline): let them try; a question will say what is wrong.
      .catch(() => mounted.current && setEnabled(true));
  }, []);
  useEffect(checkStatus, [checkStatus]);

  // The answer arrives in pieces over the live connection while the request is still open.
  useEffect(() => {
    const socket = acquireSocket();
    const onDelta = (p: { requestId?: string; text?: string }) => {
      if (!p?.requestId || p.requestId !== current.current || typeof p.text !== 'string') return;
      setMessages((list) => list?.map((m) => (m.id === p.requestId ? { ...m, content: m.content + p.text } : m)) ?? list);
    };
    socket.on('ai:delta', onDelta);
    return () => {
      socket.off('ai:delta', onDelta);
      releaseSocket();
    };
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /** Sends the conversation `history` (ending with a question) and shows the answer as it comes. */
  const ask = async (history: Message[]) => {
    const requestId = newMessageId();
    current.current = requestId;
    setBusy(true);
    setError(null);
    setMessages([...history, { id: requestId, role: 'assistant', content: '', state: 'writing' }]);
    const turns: AiTurn[] = history.slice(-KEEP).map((m) => ({ role: m.role, content: m.content }));
    try {
      const { reply } = await askCoach(turns, requestId, toDayKey(getZonedParts(new Date(), format.timeZone)));
      if (!mounted.current) return;
      // The full answer replaces whatever pieces arrived (all of them, or none if the live connection was down).
      setMessages((list) => list?.map((m) => (m.id === requestId ? { id: requestId, role: 'assistant', content: reply } : m)) ?? list);
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof ApiError && e.code === 'AI_NOT_CONFIGURED') setEnabled(false);
      setError(messageFrom(e));
      // The question stays; the empty answer becomes a "try again".
      setMessages((list) => list?.map((m) => (m.id === requestId ? { ...m, content: '', state: 'failed' } : m)) ?? list);
    } finally {
      if (current.current === requestId) current.current = null;
      if (mounted.current) setBusy(false);
    }
  };

  const submit = (value?: string) => {
    const body = (value ?? text).trim();
    if (!body || busy || !messages) return;
    setText('');
    const history = [...messages.filter((m) => !m.state), { id: newMessageId(), role: 'user' as const, content: body }];
    void ask(history);
  };

  const retry = () => {
    if (busy || !messages) return;
    void ask(messages.filter((m) => !m.state));
  };

  /** A different answer to the same question: the last answer is dropped and the question asked again. */
  const regenerate = () => {
    if (busy || !messages) return;
    const kept = messages.filter((m) => !m.state);
    while (kept.length && kept[kept.length - 1].role === 'assistant') kept.pop();
    if (kept.length) void ask(kept);
  };

  const share = (content: string) => {
    void Share.share({ message: content }).catch(() => {});
  };

  const startOver = () => {
    if (busy) return;
    setError(null);
    setMessages([]);
  };

  // Newest first: the list is drawn upside down so it starts at the bottom.
  const rows = useMemo(() => [...(messages ?? [])].reverse(), [messages]);
  const hour = new Date().getHours();
  const ideas = useMemo(() => ideasFor(hour), [hour]);
  const canSend = text.trim().length > 0 && !busy;
  const off = enabled === false;
  /** The newest message is a finished answer: offer what to do with it. */
  const answered = !busy && rows[0]?.role === 'assistant' && !rows[0].state;

  const roundButton = (label: string, icon: SymbolViewProps['name'], onPress: () => void, disabled = false) => (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} className="h-11 w-11 items-center justify-center rounded-full active:opacity-60" style={{ backgroundColor: SOFT, opacity: disabled ? 0.4 : 1 }}>
      <SymbolView name={icon} tintColor="white" size={17} />
    </Pressable>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: '#000000' }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Top bar: close on the left, who you are talking to in the middle, a new chat on the right. */}
        <View className="flex-row items-center px-4" style={{ paddingTop: insets.top + 8, paddingBottom: 10 }}>
          {roundButton('Close', { ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }, () => router.back())}
          <View className="flex-1 flex-row items-center justify-center" style={{ gap: 10 }}>
            <Orb size={34} busy={busy} />
            <View>
              <Text {...COMPACT_TEXT} accessibilityRole="header" numberOfLines={1} className="text-[17px] font-bold text-white">
                L5 Coach
              </Text>
              <View className="flex-row items-center" style={{ gap: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: off ? MUTED : BRAND }} />
                <Text {...COMPACT_TEXT} numberOfLines={1} accessibilityLiveRegion="polite" className="text-[11px] font-semibold" style={{ color: busy ? BRAND : MUTED }}>
                  {off ? 'Coming soon' : busy ? 'Thinking…' : 'Knows your plan'}
                </Text>
              </View>
            </View>
          </View>
          {rows.length > 0 ? roundButton('Start a new chat', { ios: 'square.and.pencil', android: 'edit_square', web: 'edit_square' }, startOver, busy) : <View style={{ width: 44 }} />}
        </View>

        {off ? (
          // No key on the server yet: say so kindly instead of failing on the first question.
          <View className="flex-1 items-center justify-center px-10">
            <Orb size={96} />
            <DisplayText {...COMPACT_TEXT} className="mt-7 text-center text-[26px] leading-8 tracking-tight text-white">
              L5 Coach is almost here
            </DisplayText>
            <Text {...COMPACT_TEXT} className="mt-2 text-center text-[15px] leading-6 text-muted">
              Your AI assistant for food, training and everything in between is being switched on. Check back soon.
            </Text>
            <Pressable onPress={checkStatus} accessibilityRole="button" className="mt-5 min-h-11 justify-center active:opacity-60">
              <Text {...COMPACT_TEXT} className="text-sm font-bold text-brand">
                Check again
              </Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24, width: '100%', maxWidth: 560, alignSelf: 'center' }}>
            <View className="items-center">
              <Orb size={104} />
              <Text {...COMPACT_TEXT} className="mt-7 text-center text-[15px] font-semibold text-muted">
                {greeting(hour)}, {firstName}
              </Text>
              <DisplayText {...COMPACT_TEXT} className="mt-1 text-center text-[30px] leading-9 tracking-tight text-white">
                What can I help with?
              </DisplayText>
            </View>

            {/* Four ways to start, two by two. A tap asks it straight away. */}
            <View className="flex-row flex-wrap" style={{ marginTop: 30, gap: 10 }}>
              {ideas.map((idea) => (
                <Pressable
                  key={idea.title}
                  onPress={() => submit(idea.ask)}
                  disabled={messages === null}
                  accessibilityRole="button"
                  accessibilityLabel={`Ask: ${idea.ask}`}
                  className="active:opacity-70"
                  style={{ flexBasis: '47%', flexGrow: 1, minHeight: 104, borderRadius: 24, padding: 14, justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <View className="items-center justify-center" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${idea.color}26` }}>
                    <SymbolView name={idea.icon} tintColor={idea.color} size={18} />
                  </View>
                  <Text {...COMPACT_TEXT} numberOfLines={2} className="text-[15px] font-bold leading-5 text-white">
                    {idea.title}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text {...COMPACT_TEXT} className="mt-5 text-center text-[13px] leading-5 text-muted">
              Or ask anything below. I answer in the language you write in.
            </Text>
          </ScrollView>
        ) : (
          <FlatList
            data={rows}
            inverted
            keyExtractor={(m) => m.id}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 14, width: '100%', maxWidth: 720, alignSelf: 'center' }}
            // Upside down, so this sits under the newest answer: quick things to say next.
            ListHeaderComponent={
              answered ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginTop: 14, marginLeft: 38 }} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                  {FOLLOW_UPS.map((f) => (
                    <Pressable key={f} onPress={() => submit(f)} accessibilityRole="button" accessibilityLabel={`Say: ${f}`} className="justify-center rounded-full active:opacity-60" style={{ minHeight: 36, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
                      <Text {...COMPACT_TEXT} className="text-[13px] font-semibold text-white">
                        {f}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : undefined
            }
            renderItem={({ item, index }) =>
              item.role === 'user' ? (
                // What the member asked: a quiet grey bubble on the right.
                <View className="items-end" style={{ marginTop: 26, marginBottom: 18 }}>
                  <View style={{ maxWidth: '86%', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 22, borderBottomRightRadius: 7, backgroundColor: 'rgba(255,255,255,0.11)' }}>
                    <Text {...COMPACT_TEXT} selectable style={{ fontSize: 16, lineHeight: 23, color: '#ffffff' }}>
                      {item.content}
                    </Text>
                  </View>
                </View>
              ) : (
                // The coach's answer is not in a bubble: it reads like a page, under the coach's name.
                <View className="flex-row" style={{ gap: 10 }}>
                  <CoachLogo size={28} />
                  <View className="flex-1">
                    <Text {...COMPACT_TEXT} className="text-[12px] font-bold text-muted" style={{ marginBottom: 6, marginTop: 5 }}>
                      L5 Coach
                    </Text>
                    {item.state === 'failed' ? (
                      <Pressable onPress={retry} accessibilityRole="button" accessibilityLabel="The coach could not answer. Try again" className="min-h-9 justify-center active:opacity-60">
                        <Text {...COMPACT_TEXT} className="text-[15px] font-semibold leading-6" style={{ color: '#ff8a8a' }}>
                          {error ?? 'The coach could not answer.'} <Text style={{ color: BRAND, fontWeight: '700' }}>Try again</Text>
                        </Text>
                      </Pressable>
                    ) : item.content ? (
                      <>
                        {/* A caret at the end while the answer is still being written. */}
                        <Answer text={item.state === 'writing' ? `${item.content} ▍` : item.content} />
                        {!item.state ? (
                          <View className="flex-row" style={{ gap: 4, marginTop: 8, marginLeft: -8 }}>
                            <Pressable onPress={() => share(item.content)} hitSlop={4} accessibilityRole="button" accessibilityLabel="Share this answer" className="h-9 w-9 items-center justify-center rounded-full active:opacity-50">
                              <SymbolView name={{ ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' }} tintColor={MUTED} size={15} />
                            </Pressable>
                            {index === 0 && !busy ? (
                              <Pressable onPress={regenerate} hitSlop={4} accessibilityRole="button" accessibilityLabel="Answer again" className="h-9 w-9 items-center justify-center rounded-full active:opacity-50">
                                <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} tintColor={MUTED} size={15} />
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                      </>
                    ) : (
                      <Thinking />
                    )}
                  </View>
                </View>
              )
            }
          />
        )}

        {off ? null : (
          <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: keyboardOpen ? 8 : insets.bottom + 8, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
            {/* One rounded box: the words on the left, send inside it on the right. */}
            <View className="flex-row items-end" style={{ minHeight: 54, borderRadius: 27, paddingLeft: 18, paddingRight: 7, paddingVertical: 7, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: text ? 'rgba(61,220,104,0.35)' : 'rgba(255,255,255,0.06)' }}>
              <TextInput
                value={text}
                onChangeText={setText}
                multiline
                maxLength={MAX_LENGTH}
                accessibilityLabel="Ask L5 Coach"
                placeholder={busy ? 'L5 Coach is answering…' : 'Ask anything'}
                placeholderTextColor={MUTED}
                selectionColor={BRAND}
                cursorColor={BRAND}
                maxFontSizeMultiplier={1.3}
                className="flex-1"
                style={{ color: '#ffffff', fontSize: 16, lineHeight: 22, maxHeight: 120, paddingTop: Platform.OS === 'ios' ? 9 : 6, paddingBottom: Platform.OS === 'ios' ? 9 : 6 }}
              />
              <Pressable
                onPress={() => submit()}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send"
                accessibilityState={{ disabled: !canSend }}
                className="items-center justify-center active:opacity-80"
                style={{ width: 40, height: 40, borderRadius: 20, marginLeft: 8, backgroundColor: canSend ? BRAND : 'rgba(255,255,255,0.08)' }}>
                <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} tintColor={canSend ? INK : MUTED} size={18} />
              </Pressable>
            </View>
            {keyboardOpen ? null : (
              <Text {...COMPACT_TEXT} className="mt-2 text-center text-[11px] text-muted">
                L5 Coach is an AI and can be wrong. For medical questions, ask a doctor.
              </Text>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
