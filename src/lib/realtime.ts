/**
 * The live connection to L5Fitness-api (Socket.IO, same address as the API).
 *
 * It only RECEIVES news (a new chat message, "seen", "typing", "online") and sends small signals back.
 * Messages themselves are saved through the normal API, so nothing is lost if this connection drops:
 * the chat screen falls back to asking the API every few seconds until it is back.
 *
 * One connection is shared by every screen that needs it and closed when none does.
 */
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

import { API_URL, getToken } from '@/lib/http';

let socket: Socket | null = null;
let users = 0;
let retry: ReturnType<typeof setTimeout> | null = null;

function create(): Socket {
  const s = io(API_URL, {
    // React Native has real WebSockets; skipping the long-polling warm-up connects faster.
    transports: ['websocket'],
    // Asked for again on every (re)connection, so an hour-old Firebase token is never reused.
    auth: (cb) => {
      getToken()
        .then((token) => cb({ token: token ?? '' }))
        .catch(() => cb({ token: '' }));
    },
    // Socket.IO waits longer after each failed try, with some randomness, up to this.
    reconnectionDelayMax: 15_000,
  });
  // The server refusing the sign-in is final for Socket.IO: it does not try again by itself.
  // Try again a little later (the token may simply not have been ready yet).
  s.on('connect_error', () => {
    if (s.active || retry) return;
    retry = setTimeout(() => {
      retry = null;
      if (socket === s && users > 0) s.connect();
    }, 8000);
  });
  return s;
}

/** Use the shared connection. Every call must be matched by one `releaseSocket()`. */
export function acquireSocket(): Socket {
  users += 1;
  if (!socket) socket = create();
  return socket;
}

export function releaseSocket() {
  users = Math.max(0, users - 1);
  if (users > 0 || !socket) return;
  if (retry) clearTimeout(retry);
  retry = null;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

/** What the server says when someone writes to the signed-in person, wherever in the app they are. */
export type ChatNudge = {
  threadId: string;
  kind: 'client' | 'staff';
  memberId: string | null;
  dietitianId: string;
  from: 'member' | 'dietitian' | 'admin';
  senderName: string | null;
  preview: string;
  at: string;
};

/** Runs `onNew` whenever someone writes to the signed-in person (for unread badges). */
export function useNewChatMessages(onNew: (nudge: ChatNudge) => void) {
  const latest = useRef(onNew);
  useEffect(() => {
    latest.current = onNew;
  });
  useEffect(() => {
    const s = acquireSocket();
    const handler = (p: ChatNudge) => p && latest.current(p);
    s.on('chat:new', handler);
    return () => {
      s.off('chat:new', handler);
      releaseSocket();
    };
  }, []);
}
