/** The AI coach (L5Fitness-api: /ai/status and /ai/chat). The key lives on the server, never in the app. */
import { api } from '@/lib/http';

/** One turn of the conversation, as the server wants it. */
export type AiTurn = { role: 'user' | 'assistant'; content: string };

/** Whether the coach is switched on (the server has its key). */
export const getAiStatus = () => api<{ enabled: boolean; name: string }>('/ai/status');

/**
 * Asks the coach. The whole conversation so far is sent each time (the server keeps nothing), ending with
 * the new question. `requestId` names this question: while the answer is being written its pieces arrive
 * over the live connection as `ai:delta` events with the same id, and the full answer is what this returns.
 * `day` is the member's own calendar day (YYYY-MM-DD), so "today's plan" is the right day in any time zone.
 */
export const askCoach = (messages: AiTurn[], requestId: string, day: string) =>
  api<{ reply: string }>('/ai/chat', { method: 'POST', body: { messages, requestId, day }, timeoutMs: 120_000 });
