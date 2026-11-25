/**
 * Chat (L5Fitness-api). Two kinds of conversation, each between two sides:
 *   a member and their dietitian   /chat  and  /dietitian/clients/:id/chat
 *   a dietitian and the admin      /dietitian/admin-chat
 */
import type { CoachingStatus } from '@/lib/fitness-api';
import { api } from '@/lib/http';

export type ChatMessage = {
  id: string;
  body: string;
  /** Written by the person looking at the screen. */
  mine: boolean;
  createdAt: string;
  readAt: string | null;
  /** The id the sender's app gave it, so a message sent twice is stored once. */
  clientId?: string | null;
};

/**
 * One page of a conversation, oldest first.
 * `threadId` names the conversation for the live connection; `seenAt` is when the other side last read
 * one of my messages; `hasMore` says older messages exist (not given when asking for "after").
 */
export type ChatPage = { threadId: string | null; messages: ChatMessage[]; seenAt: string | null; hasMore?: boolean };
export type MyChat = ChatPage & { coaching: CoachingStatus; dietitian: { name: string; image: string | null } | null };

/** Which part to load: the newest page (nothing), what came after a time, or the page before a time. */
export type ChatWindow = { after?: string; before?: string };
export type LoadChat = (window?: ChatWindow) => Promise<ChatPage>;
export type SendChat = (body: string, clientId: string) => Promise<{ message: ChatMessage }>;

const part = (w?: ChatWindow) => (w?.after ? `?after=${encodeURIComponent(w.after)}` : w?.before ? `?before=${encodeURIComponent(w.before)}` : '');
const post = (path: string, body: string, clientId: string) => api<{ message: ChatMessage }>(path, { method: 'POST', body: { body, clientId } });

// Member
export const getMyChat = (w?: ChatWindow) => api<MyChat>(`/chat${part(w)}`);
export const sendMyMessage: SendChat = (body, clientId) => post('/chat', body, clientId);

// Dietitian ↔ a client
const clientPath = (id: string) => `/dietitian/clients/${encodeURIComponent(id)}/chat`;
export const getClientChat = (id: string, w?: ChatWindow) => api<ChatPage>(`${clientPath(id)}${part(w)}`);
export const sendClientMessage = (id: string, body: string, clientId: string) => post(clientPath(id), body, clientId);

// Dietitian ↔ the admin
export const getAdminChat = (w?: ChatWindow) => api<ChatPage>(`/dietitian/admin-chat${part(w)}`);
export const sendAdminMessage: SendChat = (body, clientId) => post('/dietitian/admin-chat', body, clientId);

/** Unread messages: from each client, and from the admin. */
export const getUnreadChats = () => api<{ clients: { memberId: string; unread: number; lastAt: string }[]; admin: number }>('/dietitian/chat/unread');

/** An id for a message made on this phone (the shape of a UUID; it only has to be unique for this sender). */
export function newMessageId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
