import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { EmergencySheet } from '@/components/emergency-sheet';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { useForegroundReload } from '@/hooks/use-foreground-reload';
import { newMessageId, type ChatMessage, type LoadChat, type SendChat } from '@/lib/chat-api';
import { urgencyOf, type Urgency } from '@/lib/emergency';
import { dayLabel, formatTime, getZonedParts, toDayKey } from '@/lib/datetime';
import { ApiError, messageFrom } from '@/lib/http';
import type { Translate } from '@/lib/i18n';
import { acquireSocket, releaseSocket } from '@/lib/realtime';
import { useLanguage } from '@/providers/language-provider';

const BRAND = '#3ddc68';
const INK = '#050a07';
const MUTED = '#8fa396';
const WARN = '#ffc857';
const BAD = '#ff7a7a';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const MAX_LENGTH = 2000;
const PEER_AVATAR = 30;
/** How often an open chat asks the API for new messages: rarely while the live connection is up, often while it is down. */
const POLL_LIVE_MS = 45_000;
const POLL_OFFLINE_MS = 4000;
/** A message that could not be sent is tried again by itself after these waits, then left for a tap. */
const RETRY_AFTER_MS = [1500, 4000, 10_000, 20_000];

/** The role the person holding the phone speaks with in this conversation. */
export type ChatRole = 'member' | 'dietitian';

/** What the top of the screen can say about the other person and the connection. */
export type ChatStatus = {
  /** The live connection is up and has been let into this conversation. */
  live: boolean;
  /** The other person is in the app (or the console) right now. */
  online: boolean;
  lastSeenAt: string | null;
  typing: boolean;
};

type LiveMessage = { threadId: string; message: Omit<ChatMessage, 'mine'> & { from: 'member' | 'dietitian' | 'admin' } };
type Presence = { id: string; online: boolean; lastSeenAt: string | null };
/** A message of mine that the server does not have yet. */
type Pending = { clientId: string; body: string; createdAt: string; state: 'sending' | 'waiting' | 'failed'; reason?: unknown };
/** A message on screen: one from the server, or one of mine on its way. */
type Shown = ChatMessage & { state?: Pending['state']; reason?: unknown };

const byTime = (x: ChatMessage, y: ChatMessage) => (x.createdAt < y.createdAt ? -1 : x.createdAt > y.createdAt ? 1 : 0);
/** Worth trying again by itself: no network, a busy server, or "slow down". */
const passing = (e: unknown) => !(e instanceof ApiError) || e.status >= 500 || e.status === 429;

/** "Online", "typing…", "Last seen 5 min ago", or what the screen says when it knows nothing. */
export function statusLine(status: ChatStatus, fallback: string, t: Translate) {
  if (status.typing) return t('care.chatTypingNow');
  if (status.online) return t('care.chatOnline');
  if (!status.lastSeenAt) return fallback;
  const minutes = Math.max(0, (Date.now() - new Date(status.lastSeenAt).getTime()) / 60_000);
  if (minutes < 1.5) return t('care.chatLastSeenNow');
  if (minutes < 60) return t('care.chatLastSeenMin', { n: Math.round(minutes) });
  if (minutes < 60 * 24) return t('care.chatLastSeenHour', { n: Math.round(minutes / 60) });
  const days = Math.round(minutes / 1440);
  return t(days === 1 ? 'care.chatLastSeenDay' : 'care.chatLastSeenDays', { n: days });
}

/**
 * One conversation: messages newest at the bottom, a box to write in, and a send button.
 * Used by the member (with their dietitian) and by the dietitian (with a client, or with the admin);
 * `load` and `send` say which.
 *
 * Messages are SAVED through the API with an id made on this phone, so a retry can never store one
 * twice: what is written without a connection waits and goes out by itself when the way is back.
 * New messages, "seen", "typing" and "online" arrive at once over the live connection; if that is
 * down, the screen asks the API every few seconds instead, so the chat keeps working either way.
 */
export function ChatThread({
  header,
  role,
  peer,
  load,
  send,
  bottomInset,
  emptyTitle,
  emptyText,
  watchUrgent = false,
}: {
  /** Stays at the top, above the messages. It is told whether the other person is online or writing. */
  header: (status: ChatStatus) => ReactNode;
  role: ChatRole;
  /** The other person: their picture (for example from their Google account) sits beside what they write. */
  peer?: { name: string; image: string | null } | null;
  load: LoadChat;
  send: SendChat;
  /** Room to leave under the writing box while the keyboard is closed (the tab bar, the home indicator). */
  bottomInset: number;
  emptyTitle: string;
  emptyText: string;
  /** A member writing to their dietitian: urgent words open the emergency box, because nobody may read it in time. */
  watchUrgent?: boolean;
}) {
  const { now, format } = useDeviceClock();
  const { t, language } = useLanguage();
  const todayKey = toDayKey(getZonedParts(now, format.timeZone));
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urgent, setUrgent] = useState<Urgency | null>(null);
  const [text, setText] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  /** The live connection is up and has been let into this conversation. */
  const [live, setLive] = useState(false);
  /** Said only after a few seconds without a connection, never during a normal start. */
  const [lost, setLost] = useState(false);
  const [presence, setPresence] = useState<Presence | null>(null);
  const [theyType, setTheyType] = useState(false);

  const newest = useRef<string | undefined>(undefined);
  const busy = useRef(false);
  const mounted = useRef(true);
  const focused = useRef(false);
  const emit = useRef<(event: string, payload: unknown) => void>(() => {});
  const joinRef = useRef<() => void>(() => {});
  const typingSent = useRef(0);
  const typingStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingRef = useRef<Pending[]>([]);
  const threadRef = useRef<string | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
    threadRef.current = threadId;
  });

  useEffect(() => {
    mounted.current = true;
    const waiting = timers.current;
    return () => {
      mounted.current = false;
      for (const t of waiting.values()) clearTimeout(t);
      waiting.clear();
    };
  }, []);

  /** Adds what the server sent, without ever showing a message twice. */
  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const ids = new Set((prev ?? []).map((m) => m.id));
      const fresh = incoming.filter((m) => !ids.has(m.id));
      // By time: a message of mine can already be here when an earlier one of theirs arrives.
      return fresh.length || prev === null ? [...(prev ?? []), ...fresh].sort(byTime) : prev;
    });
    // A message of mine that the server now has is no longer "being sent".
    const done = new Set(incoming.map((m) => m.clientId).filter(Boolean));
    if (done.size) setPending((list) => (list.some((p) => done.has(p.clientId)) ? list.filter((p) => !done.has(p.clientId)) : list));
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const after = newest.current;
      const page = await load(after ? { after } : undefined);
      if (!mounted.current) return;
      if (!after) {
        setMessages((prev) => prev ?? []);
        setHasMore(!!page.hasMore);
      }
      merge(page.messages);
      // Only what a check brought back moves the mark, never a message I just sent.
      const last = page.messages[page.messages.length - 1];
      if (last && (!newest.current || last.createdAt > newest.current)) newest.current = last.createdAt;
      setSeenAt(page.seenAt);
      setThreadId(page.threadId ?? null);
      setError(null);
    } catch (e) {
      // Say so only when there is nothing to show; an open chat just tries again in a moment.
      if (mounted.current) setMessages((prev) => {
        if (prev === null) setError(messageFrom(e));
        return prev;
      });
    } finally {
      busy.current = false;
    }
  }, [load, merge]);

  const deliver = useCallback(
    async (item: Pending, attempt = 0) => {
      timers.current.delete(item.clientId);
      try {
        const { message } = await send(item.body, item.clientId);
        if (mounted.current) merge([message]);
      } catch (e) {
        if (!mounted.current) return;
        const again = passing(e) && attempt < RETRY_AFTER_MS.length;
        setPending((list) => list.map((p) => (p.clientId === item.clientId ? { ...p, state: again ? 'waiting' : 'failed', reason: e } : p)));
        if (again) timers.current.set(item.clientId, setTimeout(() => void deliver(item, attempt + 1), RETRY_AFTER_MS[attempt]));
      }
    },
    [send, merge]
  );

  /** Everything still unsent goes out again now (the connection is back, or the app was reopened). */
  const flush = useCallback(() => {
    for (const p of pendingRef.current) {
      if (p.state === 'sending') continue;
      if (p.state === 'failed' && !passing(p.reason)) continue;
      const timer = timers.current.get(p.clientId);
      if (timer) clearTimeout(timer);
      setPending((list) => list.map((x) => (x.clientId === p.clientId ? { ...x, state: 'sending' } : x)));
      void deliver(p, 1);
    }
  }, [deliver]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void refresh();
      const id = setInterval(refresh, live ? POLL_LIVE_MS : POLL_OFFLINE_MS);
      return () => {
        focused.current = false;
        clearInterval(id);
      };
    }, [refresh, live])
  );

  // The live connection: new messages, "seen", "typing" and "online" as they happen.
  useEffect(() => {
    const socket = acquireSocket();
    let typingClear: ReturnType<typeof setTimeout> | null = null;
    const here = (p?: { threadId?: string }) => !!p && !!threadRef.current && p.threadId === threadRef.current;
    /** In front of the person: this screen is the one shown, and the app is open. */
    const watching = () => focused.current && AppState.currentState === 'active';
    emit.current = (event, payload) => {
      if (socket.connected) socket.emit(event, payload);
    };

    const join = () => {
      const id = threadRef.current;
      if (!id || !socket.connected) return;
      socket.emit('chat:join', id, (res?: { ok?: boolean; peer?: Presence }) => {
        if (threadRef.current !== id) return;
        setLive(!!res?.ok);
        if (res?.ok) setPresence(res.peer ?? null);
      });
    };
    joinRef.current = join;

    const onConnect = () => {
      setConnected(true);
      // Anything missed while the connection was down, and anything written meanwhile.
      void refresh();
      flush();
      join();
    };
    const onDisconnect = () => {
      setConnected(false);
      setLive(false);
      setTheyType(false);
    };
    const onMessage = (p: LiveMessage) => {
      if (!here(p)) return;
      const { from, ...rest } = p.message;
      const mine = from === role;
      merge([{ ...rest, mine }]);
      if (!mine) {
        setTheyType(false);
        // The chat is open in front of me, so it has been seen.
        if (watching()) socket.emit('chat:read', { threadId: p.threadId });
      }
    };
    const onRead = (p: { threadId: string; by: string; at: string }) => {
      if (here(p) && p.by !== role) setSeenAt(p.at);
    };
    const onTyping = (p: { threadId: string; from: string; typing: boolean }) => {
      if (!here(p) || p.from === role) return;
      setTheyType(p.typing);
      if (typingClear) clearTimeout(typingClear);
      // In case the "stopped" signal never arrives.
      if (p.typing) typingClear = setTimeout(() => setTheyType(false), 6000);
    };
    const onPresence = (p: Presence) => setPresence((prev) => (prev && p?.id === prev.id ? p : prev));
    // The server emptied the room (my dietitian changed, sharing was switched off): ask again.
    const onReset = (p: { threadId: string }) => {
      if (!here(p)) return;
      setLive(false);
      setPresence(null);
      void refresh().then(join);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('chat:message', onMessage);
    socket.on('chat:read', onRead);
    socket.on('chat:typing', onTyping);
    socket.on('chat:presence', onPresence);
    socket.on('chat:reset', onReset);
    if (socket.connected) onConnect();
    return () => {
      if (typingClear) clearTimeout(typingClear);
      if (typingStop.current) clearTimeout(typingStop.current);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('chat:message', onMessage);
      socket.off('chat:read', onRead);
      socket.off('chat:typing', onTyping);
      socket.off('chat:presence', onPresence);
      socket.off('chat:reset', onReset);
      if (socket.connected && threadRef.current) socket.emit('chat:leave', threadRef.current);
      emit.current = () => {};
      joinRef.current = () => {};
      releaseSocket();
    };
  }, [role, refresh, merge, flush]);

  // The first answer from the API says which conversation this is: only then can its room be joined.
  useEffect(() => {
    if (threadId) joinRef.current();
  }, [threadId]);

  useEffect(() => {
    if (connected) return;
    const id = setTimeout(() => setLost(true), 4000);
    return () => {
      clearTimeout(id);
      setLost(false);
    };
  }, [connected]);

  /** Tells the other side I am writing: at most every 2.5 s, and "stopped" after a pause. */
  const typing = (value: string) => {
    setText(value);
    const id = threadRef.current;
    if (typingStop.current) clearTimeout(typingStop.current);
    if (!id) return;
    if (!value.trim()) {
      if (typingSent.current) emit.current('chat:typing', { threadId: id, typing: false });
      typingSent.current = 0;
      return;
    }
    if (Date.now() - typingSent.current > 2500) {
      typingSent.current = Date.now();
      emit.current('chat:typing', { threadId: id, typing: true });
    }
    typingStop.current = setTimeout(() => {
      typingSent.current = 0;
      emit.current('chat:typing', { threadId: id, typing: false });
    }, 3500);
  };

  // Back in the app: catch up, and send what was waiting.
  useForegroundReload(() => {
    void refresh();
    flush();
  });

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    if (watchUrgent) setUrgent(urgencyOf(body));
    const item: Pending = { clientId: newMessageId(), body, createdAt: new Date().toISOString(), state: 'sending' };
    typing('');
    setError(null);
    // Shown at once; it is confirmed (or marked as not sent) when the server answers.
    setPending((list) => [...list, item]);
    void deliver(item);
  };

  const retry = (clientId: string) => {
    const item = pendingRef.current.find((p) => p.clientId === clientId);
    if (!item) return;
    const timer = timers.current.get(clientId);
    if (timer) clearTimeout(timer);
    setPending((list) => list.map((p) => (p.clientId === clientId ? { ...p, state: 'sending' } : p)));
    void deliver(item);
  };

  /** The page before the oldest message on screen (the list calls this when it is scrolled to the top). */
  const loadOlder = async () => {
    const first = messages?.[0];
    if (!first || !hasMore || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await load({ before: first.createdAt });
      if (!mounted.current) return;
      merge(page.messages);
      setHasMore(!!page.hasMore);
    } catch {
      // Left as it is: scrolling up again tries once more.
    } finally {
      if (mounted.current) setLoadingOlder(false);
    }
  };

  // Newest first, because the list is drawn upside down so that it starts at the bottom.
  const rows = useMemo<Shown[]>(
    () => [...(messages ?? []), ...pending.map((p) => ({ id: p.clientId, body: p.body, createdAt: p.createdAt, readAt: null, mine: true, state: p.state, reason: p.reason }))].reverse(),
    [messages, pending]
  );
  const dayOf = (iso: string) => toDayKey(getZonedParts(new Date(iso), format.timeZone));
  const canSend = text.trim().length > 0;
  const status: ChatStatus = { live, online: !!presence?.online, lastSeenAt: presence?.lastSeenAt ?? null, typing: theyType };

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header(status)}

      {lost && messages !== null ? (
        <Text {...COMPACT_TEXT} accessibilityLiveRegion="polite" className="px-5 py-2 text-center text-xs font-semibold" style={{ color: WARN, backgroundColor: 'rgba(255,200,87,0.1)' }}>
          {t('care.chatNoConnection')}
        </Text>
      ) : null}

      {messages === null ? (
        <View className="flex-1 items-center justify-center px-8">
          {error ? (
            <>
              <Text {...COMPACT_TEXT} className="text-center text-base font-bold text-white">
                {error}
              </Text>
              <Pressable onPress={refresh} accessibilityRole="button" className="mt-4 min-h-11 justify-center rounded-full bg-brand px-6 active:opacity-80">
                <Text {...COMPACT_TEXT} className="text-sm font-bold text-ink">
                  {t('common.tryAgain')}
                </Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={BRAND} size="large" />
          )}
        </View>
      ) : rows.length === 0 ? (
        <Pressable className="flex-1 items-center justify-center px-10" onPress={Keyboard.dismiss} accessible={false}>
          {peer ? (
            <Avatar name={peer.name} image={peer.image} size={88} />
          ) : (
            <View className="items-center justify-center" style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(61,220,104,0.12)' }}>
              <SymbolView name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }} tintColor={BRAND} size={30} />
            </View>
          )}
          <Text {...COMPACT_TEXT} className="mt-4 text-center text-xl font-bold text-white">
            {emptyTitle}
          </Text>
          <Text {...COMPACT_TEXT} className="mt-1.5 text-center text-[15px] leading-6 text-muted">
            {emptyText}
          </Text>
        </Pressable>
      ) : (
        <FlatList
          data={rows}
          inverted
          keyExtractor={(m) => m.id}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          // Upside down: the "end" is the oldest message, and the "header" sits under the newest.
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingOlder ? <ActivityIndicator color={BRAND} style={{ marginVertical: 12 }} /> : undefined}
          ListHeaderComponent={
            theyType ? (
              <View accessible accessibilityLiveRegion="polite" accessibilityLabel={peer ? t('care.chatNameTyping', { name: peer.name }) : t('care.chatTheyTyping')} className="flex-row items-end" style={{ gap: 8, marginBottom: 10 }}>
                {peer ? <Avatar name={peer.name} image={peer.image} size={PEER_AVATAR} /> : null}
                <View style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderBottomLeftRadius: 6, backgroundColor: 'rgba(255,255,255,0.09)' }}>
                  <Text {...COMPACT_TEXT} style={{ fontSize: 15, lineHeight: 22, color: MUTED, fontStyle: 'italic' }}>
                    {t('care.chatTypingNow')}
                  </Text>
                </View>
              </View>
            ) : undefined
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, width: '100%', maxWidth: 840, alignSelf: 'center' }}
          renderItem={({ item, index }) => {
            const older = rows[index + 1];
            const newer = rows[index - 1];
            const day = dayOf(item.createdAt);
            const startsDay = !older || dayOf(older.createdAt) !== day;
            // Messages from the same side sit closer together; the time shows on the last of a run.
            const endsRun = !newer || newer.mine !== item.mine || dayOf(newer.createdAt) !== day || !!newer.state !== !!item.state;
            const seen = item.mine && !item.state && !!seenAt && seenAt >= item.createdAt;
            const refused = item.state === 'failed' && !passing(item.reason);
            return (
              <View>
                {startsDay ? (
                  <Text {...COMPACT_TEXT} className={`my-3 text-center text-[11px] font-bold uppercase text-muted ${language === 'en' ? 'tracking-widest' : ''}`}>
                    {dayLabel(day, todayKey, format.locale)}
                  </Text>
                ) : null}
                <View className="flex-row items-end" style={{ gap: 8, marginBottom: endsRun ? 10 : 3 }}>
                  {/* Their picture, beside the last message of each run; the same room is kept on the others so the bubbles line up. */}
                  {!item.mine && peer ? (
                    <View style={{ width: PEER_AVATAR, marginBottom: endsRun ? 18 : 0 }}>{endsRun ? <Avatar name={peer.name} image={peer.image} size={PEER_AVATAR} /> : null}</View>
                  ) : null}
                  <View className={`flex-1 ${item.mine ? 'items-end' : 'items-start'}`}>
                    <View
                      accessible
                      accessibilityLabel={t(item.mine ? 'care.chatYouWrote' : 'care.chatTheyWrote', { text: item.body })}
                      style={{
                        maxWidth: '82%',
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: 20,
                        borderBottomRightRadius: item.mine && endsRun ? 6 : 20,
                        borderBottomLeftRadius: !item.mine && endsRun ? 6 : 20,
                        backgroundColor: item.mine ? BRAND : 'rgba(255,255,255,0.09)',
                        opacity: item.state ? 0.6 : 1,
                      }}>
                      <Text selectable {...COMPACT_TEXT} style={{ fontSize: 16, lineHeight: 22, color: item.mine ? INK : '#ffffff' }}>
                        {item.body}
                      </Text>
                    </View>
                    {item.state === 'failed' ? (
                      <Pressable onPress={() => retry(item.id)} accessibilityRole="button" accessibilityLabel={t('care.chatNotSentA11y')} className="min-h-8 justify-center active:opacity-60">
                        <Text {...COMPACT_TEXT} className="text-xs font-bold" style={{ color: BAD }}>
                          {refused ? t('care.chatRefused', { reason: messageFrom(item.reason) }) : t('care.chatNotSent')}
                        </Text>
                      </Pressable>
                    ) : endsRun ? (
                      <Text {...COMPACT_TEXT} className="mt-1 text-[11px] text-muted" style={{ marginHorizontal: 6 }}>
                        {item.state === 'waiting' ? t('care.chatWaiting') : item.state === 'sending' ? t('care.chatSending') : formatTime(new Date(item.createdAt), format)}
                        {item.mine && !item.state ? <Text style={{ color: seen ? BRAND : MUTED, fontWeight: seen ? '700' : '400' }}>{` · ${seen ? t('care.chatSeen') : t('care.chatSent')}`}</Text> : null}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {error && messages !== null ? (
        <Text {...COMPACT_TEXT} accessibilityRole="alert" className="px-5 pb-1 text-center text-xs font-semibold" style={{ color: BAD }}>
          {error}
        </Text>
      ) : null}

      <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: keyboardOpen ? 8 : bottomInset + 8, width: '100%', maxWidth: 840, alignSelf: 'center' }}>
        <View className="flex-row items-end" style={{ gap: 8 }}>
          <View className="flex-1 justify-center" style={{ minHeight: 48, borderRadius: 24, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <TextInput
              value={text}
              onChangeText={typing}
              multiline
              maxLength={MAX_LENGTH}
              accessibilityLabel={t('care.chatMessage')}
              placeholder={t('care.chatMessage')}
              placeholderTextColor={MUTED}
              selectionColor={BRAND}
              cursorColor={BRAND}
              maxFontSizeMultiplier={1.3}
              style={{ color: '#ffffff', fontSize: 16, lineHeight: 22, maxHeight: 120, paddingTop: Platform.OS === 'ios' ? 12 : 8, paddingBottom: Platform.OS === 'ios' ? 12 : 8 }}
            />
          </View>
          <Pressable
            onPress={submit}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('care.send')}
            accessibilityState={{ disabled: !canSend }}
            className="items-center justify-center active:opacity-80"
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: canSend ? BRAND : 'rgba(255,255,255,0.08)' }}>
            <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} tintColor={canSend ? INK : MUTED} size={20} />
          </Pressable>
        </View>
      </View>
      <EmergencySheet kind={urgent} onClose={() => setUrgent(null)} />
    </KeyboardAvoidingView>
  );
}
