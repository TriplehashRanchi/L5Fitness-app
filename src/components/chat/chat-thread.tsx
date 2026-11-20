import { useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { useDeviceClock } from '@/hooks/use-device-clock';
import { useForegroundReload } from '@/hooks/use-foreground-reload';
import type { ChatMessage, ChatPage } from '@/lib/chat-api';
import { dayLabel, formatTime, getZonedParts, toDayKey } from '@/lib/datetime';
import { messageFrom } from '@/lib/http';
import { acquireSocket, releaseSocket } from '@/lib/realtime';

const BRAND = '#3ddc68';
const INK = '#050a07';
const MUTED = '#8fa396';
const COMPACT_TEXT = { maxFontSizeMultiplier: 1.3 } as const;
const MAX_LENGTH = 2000;
const PEER_AVATAR = 30;
/** How often an open chat asks the API for new messages: rarely while the live connection is up, often while it is down. */
const POLL_LIVE_MS = 30_000;
const POLL_OFFLINE_MS = 4000;

/** Whose chat this is: the member's own, or (for a dietitian) one client's. */
export type ChatSide = { side: 'member' } | { side: 'staff'; memberId: string };
type LiveMessage = { memberId: string; message: { id: string; body: string; createdAt: string; readAt: string | null; fromMember: boolean } };

/** A message on screen: one from the server, or one of mine that is still being sent (or failed). */
type Shown = ChatMessage & { state?: 'sending' | 'failed' };

/**
 * One conversation: messages newest at the bottom, a box to write in, and a send button.
 * Used by the member (with their dietitian) and by the dietitian (with a client); `load` and `send` say which.
 * New messages, "seen" and "typing" arrive at once over the live connection; if that is down, the screen
 * asks the API every few seconds instead, so the chat keeps working either way.
 */
export function ChatThread({
  header,
  thread,
  peer,
  load,
  send,
  bottomInset,
  emptyTitle,
  emptyText,
}: {
  /** Stays at the top, above the messages. */
  header: ReactNode;
  thread: ChatSide;
  /** The other person: their picture (for example from their Google account) sits beside what they write. */
  peer?: { name: string; image: string | null } | null;
  /** Everything (no argument) or only what came after a time. */
  load: (after?: string) => Promise<ChatPage>;
  send: (body: string) => Promise<{ message: ChatMessage }>;
  /** Room to leave under the writing box while the keyboard is closed (the tab bar, the home indicator). */
  bottomInset: number;
  emptyTitle: string;
  emptyText: string;
}) {
  const { now, format } = useDeviceClock();
  const todayKey = toDayKey(getZonedParts(now, format.timeZone));
  const [messages, setMessages] = useState<Shown[] | null>(null);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const newest = useRef<string | undefined>(undefined);
  const busy = useRef(false);
  const tempId = useRef(0);
  /** The live connection is up (and, for a dietitian, has been let into this client's chat). */
  const [live, setLive] = useState(false);
  const [theyType, setTheyType] = useState(false);
  const focused = useRef(false);
  const emit = useRef<(event: string, payload: unknown) => void>(() => {});
  const typingSent = useRef(0);
  const typingStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const side = thread.side;
  const clientId = thread.side === 'staff' ? thread.memberId : undefined;

  /** Adds what the server sent, without ever showing a message twice. */
  const merge = useCallback((incoming: ChatMessage[], replace = false) => {
    setMessages((prev) => {
      const pending = (prev ?? []).filter((m) => m.state);
      const kept = replace ? [] : (prev ?? []).filter((m) => !m.state);
      const ids = new Set(kept.map((m) => m.id));
      // By time: a message of mine can already be here when an earlier one of theirs arrives.
      const all = [...kept, ...incoming.filter((m) => !ids.has(m.id))].sort((x, y) => (x.createdAt < y.createdAt ? -1 : x.createdAt > y.createdAt ? 1 : 0));
      // Only what a check brought back moves the mark, never a message I just sent (see `deliver`).
      const last = incoming[incoming.length - 1];
      if (last && (!newest.current || last.createdAt > newest.current)) newest.current = last.createdAt;
      return [...all, ...pending];
    });
  }, []);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const page = await load(newest.current);
      merge(page.messages, !newest.current);
      setSeenAt(page.seenAt);
      setError(null);
    } catch (e) {
      // Say so only when there is nothing to show; an open chat just tries again in a moment.
      setMessages((prev) => {
        if (prev === null) setError(messageFrom(e));
        return prev;
      });
    } finally {
      busy.current = false;
    }
  }, [load, merge]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      refresh();
      const id = setInterval(refresh, live ? POLL_LIVE_MS : POLL_OFFLINE_MS);
      return () => {
        focused.current = false;
        clearInterval(id);
      };
    }, [refresh, live])
  );

  // The live connection: new messages, "seen" and "typing" as they happen.
  useEffect(() => {
    const socket = acquireSocket();
    let typingClear: ReturnType<typeof setTimeout> | null = null;
    const here = (p: { memberId: string }) => !clientId || p.memberId === clientId;
    emit.current = (event, payload) => {
      if (socket.connected) socket.emit(event, payload);
    };

    const onConnect = () => {
      // Anything missed while the connection was down.
      refresh();
      if (!clientId) return setLive(true);
      socket.emit('chat:join', clientId, (res?: { ok?: boolean }) => setLive(!!res?.ok));
    };
    const onDisconnect = () => {
      setLive(false);
      setTheyType(false);
    };
    const onMessage = (p: LiveMessage) => {
      if (!here(p)) return;
      const mine = p.message.fromMember === (side === 'member');
      const { fromMember: _from, ...rest } = p.message;
      setMessages((prev) => {
        const list = prev ?? [];
        if (list.some((m) => m.id === rest.id)) return list;
        // My own message coming back: the answer to my send puts it in place, so it is not added twice.
        if (mine && list.some((m) => m.state === 'sending' && m.body === rest.body)) return list;
        const sent = [...list.filter((m) => !m.state), { ...rest, mine }].sort((x, y) => (x.createdAt < y.createdAt ? -1 : x.createdAt > y.createdAt ? 1 : 0));
        return [...sent, ...list.filter((m) => m.state)];
      });
      if (!mine) {
        setTheyType(false);
        // The chat is open in front of me, so it has been seen.
        if (focused.current) socket.emit('chat:read', { memberId: p.memberId });
      }
    };
    const onRead = (p: { memberId: string; by: 'member' | 'staff'; at: string }) => {
      if (here(p) && p.by !== side) setSeenAt(p.at);
    };
    const onTyping = (p: { memberId: string; from: 'member' | 'staff'; typing: boolean }) => {
      if (!here(p) || p.from === side) return;
      setTheyType(p.typing);
      if (typingClear) clearTimeout(typingClear);
      // In case the "stopped" signal never arrives.
      if (p.typing) typingClear = setTimeout(() => setTheyType(false), 6000);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('chat:message', onMessage);
    socket.on('chat:read', onRead);
    socket.on('chat:typing', onTyping);
    if (socket.connected) onConnect();
    return () => {
      if (typingClear) clearTimeout(typingClear);
      if (typingStop.current) clearTimeout(typingStop.current);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('chat:message', onMessage);
      socket.off('chat:read', onRead);
      socket.off('chat:typing', onTyping);
      if (clientId && socket.connected) socket.emit('chat:leave', clientId);
      emit.current = () => {};
      releaseSocket();
    };
  }, [side, clientId, refresh]);

  /** Tells the other side I am writing: at most every 2.5 s, and "stopped" after a pause. */
  const typing = (value: string) => {
    setText(value);
    const payload = { memberId: clientId };
    if (typingStop.current) clearTimeout(typingStop.current);
    if (!value.trim()) {
      if (typingSent.current) emit.current('chat:typing', { ...payload, typing: false });
      typingSent.current = 0;
      return;
    }
    if (Date.now() - typingSent.current > 2500) {
      typingSent.current = Date.now();
      emit.current('chat:typing', { ...payload, typing: true });
    }
    typingStop.current = setTimeout(() => {
      typingSent.current = 0;
      emit.current('chat:typing', { ...payload, typing: false });
    }, 3500);
  };
  useForegroundReload(refresh);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const deliver = async (id: string, body: string) => {
    try {
      const { message } = await send(body);
      setMessages((prev) => {
        const rest = (prev ?? []).filter((m) => m.id !== id && m.id !== message.id);
        const sent = rest.filter((m) => !m.state);
        const pending = rest.filter((m) => m.state);
        return [...sent, message, ...pending];
      });
      // `newest` is left alone on purpose: the next check must still ask for anything they wrote just before this.
    } catch (e) {
      setMessages((prev) => (prev ?? []).map((m) => (m.id === id ? { ...m, state: 'failed' } : m)));
      setError(messageFrom(e));
    }
  };

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    const id = `local-${++tempId.current}`;
    typing('');
    setError(null);
    // Shown at once; it is confirmed (or marked as not sent) when the server answers.
    setMessages((prev) => [...(prev ?? []), { id, body, mine: true, createdAt: new Date().toISOString(), readAt: null, state: 'sending' }]);
    void deliver(id, body);
  };

  const retry = (m: Shown) => {
    setError(null);
    setMessages((prev) => (prev ?? []).map((x) => (x.id === m.id ? { ...x, state: 'sending' } : x)));
    void deliver(m.id, m.body);
  };

  // Newest first, because the list is drawn upside down so that it starts at the bottom.
  const rows = useMemo(() => [...(messages ?? [])].reverse(), [messages]);
  const dayOf = (iso: string) => toDayKey(getZonedParts(new Date(iso), format.timeZone));
  const lastMineId = rows.find((m) => m.mine && !m.state)?.id;
  const canSend = text.trim().length > 0;

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}

      {messages === null ? (
        <View className="flex-1 items-center justify-center px-8">
          {error ? (
            <>
              <Text {...COMPACT_TEXT} className="text-center text-base font-bold text-white">
                {error}
              </Text>
              <Pressable onPress={refresh} accessibilityRole="button" className="mt-4 min-h-11 justify-center rounded-full bg-brand px-6 active:opacity-80">
                <Text {...COMPACT_TEXT} className="text-sm font-bold text-ink">
                  Try again
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
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, width: '100%', maxWidth: 840, alignSelf: 'center' }}
          renderItem={({ item, index }) => {
            const older = rows[index + 1];
            const newer = rows[index - 1];
            const day = dayOf(item.createdAt);
            const startsDay = !older || dayOf(older.createdAt) !== day;
            // Messages from the same side sit closer together; the time shows on the last of a run.
            const endsRun = !newer || newer.mine !== item.mine || dayOf(newer.createdAt) !== day;
            const seen = item.id === lastMineId && !!seenAt && seenAt >= item.createdAt;
            return (
              <View>
                {startsDay ? (
                  <Text {...COMPACT_TEXT} className="my-3 text-center text-[11px] font-bold uppercase tracking-widest text-muted">
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
                    accessibilityLabel={`${item.mine ? 'You' : 'They'} wrote: ${item.body}`}
                    style={{
                      maxWidth: '82%',
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 20,
                      borderBottomRightRadius: item.mine && endsRun ? 6 : 20,
                      borderBottomLeftRadius: !item.mine && endsRun ? 6 : 20,
                      backgroundColor: item.mine ? BRAND : 'rgba(255,255,255,0.09)',
                      opacity: item.state === 'sending' ? 0.6 : 1,
                    }}>
                    <Text selectable {...COMPACT_TEXT} style={{ fontSize: 16, lineHeight: 22, color: item.mine ? INK : '#ffffff' }}>
                      {item.body}
                    </Text>
                  </View>
                  {item.state === 'failed' ? (
                    <Pressable onPress={() => retry(item)} accessibilityRole="button" accessibilityLabel="Not sent. Try again" className="min-h-8 justify-center active:opacity-60">
                      <Text {...COMPACT_TEXT} className="text-xs font-bold" style={{ color: '#ff7a7a' }}>
                        Not sent · Tap to try again
                      </Text>
                    </Pressable>
                  ) : endsRun ? (
                    <Text {...COMPACT_TEXT} className="mt-1 text-[11px] text-muted" style={{ marginHorizontal: 6 }}>
                      {item.state === 'sending' ? 'Sending…' : `${formatTime(new Date(item.createdAt), format)}${seen ? ' · Seen' : ''}`}
                    </Text>
                  ) : null}
                </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {theyType ? (
        <Text {...COMPACT_TEXT} accessibilityLiveRegion="polite" className="px-5 pb-1 text-xs font-semibold text-brand" style={{ width: '100%', maxWidth: 840, alignSelf: 'center' }}>
          Typing…
        </Text>
      ) : null}

      {error && messages !== null ? (
        <Text {...COMPACT_TEXT} accessibilityRole="alert" className="px-5 pb-1 text-center text-xs font-semibold" style={{ color: '#ff7a7a' }}>
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
              accessibilityLabel="Message"
              placeholder="Message"
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
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend }}
            className="items-center justify-center active:opacity-80"
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: canSend ? BRAND : 'rgba(255,255,255,0.08)' }}>
            <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} tintColor={canSend ? INK : MUTED} size={20} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
