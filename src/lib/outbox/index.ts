import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError, api, NetworkError } from '@/lib/http';
import { tr } from '@/lib/i18n';
import { createOutbox, type Outbox, type OutboxItem, type SendResult } from './core';
import { createCipher } from './secure';

type Cipher = { encrypt: (s: string) => Promise<string>; decrypt: (s: string) => Promise<string> };

/**
 * The phone's tools for the outbox. expo-secure-store and expo-crypto are native, so an app build made before
 * they were added does not have them: then the queue still works, but its text is stored as plain text there.
 */
function nativeTools() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store') as typeof import('expo-secure-store');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Crypto = require('expo-crypto') as typeof import('expo-crypto');
    return { SecureStore, Crypto };
  } catch {
    return null;
  }
}

function makeCipher(): Cipher {
  const tools = nativeTools();
  if (!tools) return { encrypt: async (s) => `plain:${s}`, decrypt: async (s) => s.replace(/^plain:/, '') };
  const { SecureStore, Crypto } = tools;
  const real = createCipher(
    { get: () => SecureStore.getItemAsync('l5-outbox-key'), set: (v) => SecureStore.setItemAsync('l5-outbox-key', v) },
    (n) => Crypto.getRandomBytes(n)
  );
  return { encrypt: real.encrypt, decrypt: (s) => (s.startsWith('plain:') ? Promise.resolve(s.slice(6)) : real.decrypt(s)) };
}

const newId = () => {
  const tools = nativeTools();
  if (tools) return tools.Crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/** Which answers mean "try again later" (no signal, the server busy) and which mean "no" for good. */
function classify(error: unknown): SendResult {
  if (error instanceof NetworkError) return 'retry';
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 408 || error.status === 409 || error.status === 429 || error.status >= 500) return 'retry';
    return 'rejected';
  }
  return 'retry';
}

async function sendItem(item: OutboxItem): Promise<SendResult> {
  try {
    await api(item.path, { method: item.method, body: item.body, headers: { 'Idempotency-Key': item.id } }); // i18n-ignore
    return 'sent';
  } catch (e) {
    return classify(e);
  }
}

let current: { userId: string; outbox: Outbox } | null = null;

/** The outbox of this signed-in member (made on first use, one per person on the phone). */
export function startOutbox(userId: string): Outbox {
  if (current?.userId === userId) return current.outbox;
  const cipher = makeCipher();
  const storeKey = `l5-outbox:${userId}`;
  const outbox = createOutbox({
    load: () => AsyncStorage.getItem(storeKey),
    save: (text) => AsyncStorage.setItem(storeKey, text),
    ...cipher,
    send: sendItem,
    newId,
    now: () => new Date(),
  });
  current = { userId, outbox };
  return outbox;
}

export function stopOutbox() {
  current = null;
}

export type Sent<T> = { queued: false; data: T } | { queued: true };

/**
 * Sends a request that creates something. If there is no signal it is kept on the phone (encrypted) and sent
 * later with the same key, so it is saved exactly once. A real "no" from the server is thrown as usual.
 */
export async function sendOrQueue<T>(request: { kind: string; method: 'POST' | 'PUT'; path: string; body: unknown }): Promise<Sent<T>> {
  const id = newId();
  try {
    const data = await api<T>(request.path, { method: request.method, body: request.body, headers: { 'Idempotency-Key': id } }); // i18n-ignore
    return { queued: false, data };
  } catch (e) {
    if (classify(e) !== 'retry' || !current) throw e;
    if (!(await current.outbox.enqueue({ ...request, id }))) throw new NetworkError(tr('acc.outboxFull'));
    return { queued: true };
  }
}
