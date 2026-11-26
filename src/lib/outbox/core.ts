/**
 * The outbox: things the member logged that have not reached the server yet (no signal in a lift, a gym
 * basement, a village). Each one waits here with a key made on the phone, and is sent when the way is back.
 * The server remembers the key, so a request sent twice (the connection dropped after it was saved) saves once.
 *
 * This file has no phone-specific code: storage, encryption, the network call and the clock are passed in, so
 * it can be tested on a computer (npm run test:outbox).
 */

export type OutboxItem = {
  /** The idempotency key: a UUID made when the member logged it. */
  id: string;
  method: 'POST' | 'PUT';
  path: string;
  body: unknown;
  /** What it is, for the member: 'meal', 'water', 'check-in'... */
  kind: string;
  createdAt: string;
  attempts: number;
};

/** What happened when one item was sent: it arrived, it should be tried again later, or the server said no for good. */
export type SendResult = 'sent' | 'retry' | 'rejected';

export type Adapters = {
  /** The stored (already encrypted) text, or null. */
  load: () => Promise<string | null>;
  save: (text: string) => Promise<void>;
  encrypt: (plain: string) => Promise<string>;
  decrypt: (cipher: string) => Promise<string>;
  send: (item: OutboxItem) => Promise<SendResult>;
  newId: () => string;
  now: () => Date;
};

/** The most things kept at once, and how long: the server only accepts a meal from the last 2 days anyway. */
export const MAX_ITEMS = 200;
export const MAX_AGE_MS = 7 * 86_400_000;

export type FlushResult = { sent: number; rejected: OutboxItem[]; pending: number };

export function createOutbox(a: Adapters) {
  let items: OutboxItem[] | null = null;
  let flushing: Promise<FlushResult> | null = null;
  const listeners = new Set<(pending: number) => void>();

  const announce = () => listeners.forEach((l) => l(items?.length ?? 0));

  async function read(): Promise<OutboxItem[]> {
    if (items) return items;
    try {
      const raw = await a.load();
      items = raw ? (JSON.parse(await a.decrypt(raw)) as OutboxItem[]) : [];
      if (!Array.isArray(items)) items = [];
    } catch {
      // Unreadable (the key was lost, or the file is damaged): start empty rather than crash.
      items = [];
    }
    return items;
  }

  async function write() {
    await a.save(await a.encrypt(JSON.stringify(items ?? [])));
    announce();
  }

  return {
    /** Adds something to send later. Returns false when the outbox is full. */
    async enqueue(entry: Omit<OutboxItem, 'createdAt' | 'attempts' | 'id'> & { id?: string }): Promise<boolean> {
      const list = await read();
      if (list.length >= MAX_ITEMS) return false;
      const id = entry.id ?? a.newId();
      if (!list.some((i) => i.id === id)) list.push({ ...entry, id, createdAt: a.now().toISOString(), attempts: 0 });
      await write();
      return true;
    },

    /** Sends what is waiting, oldest first. Stops at the first one that must wait (the rest would fail too). */
    flush(): Promise<FlushResult> {
      if (flushing) return flushing;
      flushing = (async () => {
        const list = await read();
        const rejected: OutboxItem[] = [];
        let sent = 0;
        const cutoff = a.now().getTime() - MAX_AGE_MS;
        for (const item of [...list]) {
          if (new Date(item.createdAt).getTime() < cutoff) {
            list.splice(list.indexOf(item), 1);
            rejected.push(item);
            continue;
          }
          const result = await a.send(item);
          if (result === 'retry') {
            item.attempts += 1;
            break;
          }
          list.splice(list.indexOf(item), 1);
          if (result === 'sent') sent += 1;
          else rejected.push(item);
        }
        await write();
        return { sent, rejected, pending: list.length };
      })().finally(() => {
        flushing = null;
      });
      return flushing;
    },

    async list(): Promise<OutboxItem[]> {
      return [...(await read())];
    },
    async count(): Promise<number> {
      return (await read()).length;
    },
    async clear() {
      items = [];
      await write();
    },
    /** Called with the number waiting whenever it changes. Returns the way to stop listening. */
    onChange(listener: (pending: number) => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type Outbox = ReturnType<typeof createOutbox>;
