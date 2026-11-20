/** Chat between a member and their dietitian (L5Fitness-api: /chat and /dietitian/clients/:id/chat). */
import type { CoachingStatus } from '@/lib/fitness-api';
import { api } from '@/lib/http';

export type ChatMessage = {
  id: string;
  body: string;
  /** Written by the person looking at the screen. */
  mine: boolean;
  createdAt: string;
  readAt: string | null;
};

/** `seenAt`: when the other side last read one of my messages. */
export type ChatPage = { messages: ChatMessage[]; seenAt: string | null };
export type MyChat = ChatPage & { coaching: CoachingStatus; dietitian: { name: string; image: string | null } | null };

const since = (after?: string) => (after ? `?after=${encodeURIComponent(after)}` : '');

// Member
export const getMyChat = (after?: string) => api<MyChat>(`/chat${since(after)}`);
export const sendMyMessage = (body: string) => api<{ message: ChatMessage }>('/chat', { method: 'POST', body: { body } });

// Dietitian
export const getClientChat = (id: string, after?: string) => api<ChatPage>(`/dietitian/clients/${encodeURIComponent(id)}/chat${since(after)}`);
export const sendClientMessage = (id: string, body: string) =>
  api<{ message: ChatMessage }>(`/dietitian/clients/${encodeURIComponent(id)}/chat`, { method: 'POST', body: { body } });
export const getUnreadChats = () => api<{ clients: { memberId: string; unread: number; lastAt: string }[] }>('/dietitian/chat/unread');
