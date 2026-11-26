// The outbox on a computer: order, retries, permanent refusals, no duplicates, and that what waits on the phone is encrypted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createOutbox, MAX_ITEMS } from '../src/lib/outbox/core.ts';
import { createCipher } from '../src/lib/outbox/secure.ts';

function make({ results = {}, now = () => new Date('2026-11-25T10:00:00Z'), store = { text: null }, keyStore = { value: null } } = {}) {
  const sent = [];
  const cipher = createCipher({ get: async () => keyStore.value, set: async (v) => { keyStore.value = v; } }, (n) => new Uint8Array(randomBytes(n)));
  const outbox = createOutbox({
    load: async () => store.text, save: async (t) => { store.text = t; },
    encrypt: cipher.encrypt, decrypt: cipher.decrypt,
    send: async (item) => { sent.push(item.id); return results[item.id] ?? 'sent'; },
    newId: randomUUID, now,
  });
  return { outbox, sent, store, keyStore };
}
const entry = (kind, extra = {}) => ({ kind, method: 'POST', path: `/${kind}`, body: { note: `secret ${kind}` }, ...extra });

test('things are sent oldest first, once, and the outbox empties', async () => {
  const { outbox, sent } = make();
  await outbox.enqueue(entry('meals', { id: 'a' }));
  await outbox.enqueue(entry('water', { id: 'b' }));
  const r = await outbox.flush();
  assert.deepEqual(sent, ['a', 'b']);
  assert.deepEqual([r.sent, r.pending], [2, 0]);
  assert.equal((await outbox.flush()).sent, 0);
});

test('a failed connection stops the run and keeps everything for next time', async () => {
  const { outbox, sent } = make({ results: { b: 'retry' } });
  for (const id of ['a', 'b', 'c']) await outbox.enqueue(entry('meals', { id }));
  const r = await outbox.flush();
  assert.deepEqual(sent, ['a', 'b'], 'c is not tried: it would fail the same way');
  assert.deepEqual([r.sent, r.pending], [1, 2]);
  assert.equal((await outbox.list())[0].attempts, 1);
});

test('something the server refuses for good is dropped and reported, not retried forever', async () => {
  const { outbox } = make({ results: { b: 'rejected' } });
  for (const id of ['a', 'b', 'c']) await outbox.enqueue(entry('meals', { id }));
  const r = await outbox.flush();
  assert.deepEqual([r.sent, r.rejected.map((i) => i.id), r.pending], [2, ['b'], 0]);
});

test('the same key is never queued twice, and two flushes at once share one run', async () => {
  const { outbox, sent } = make();
  await outbox.enqueue(entry('meals', { id: 'a' }));
  await outbox.enqueue(entry('meals', { id: 'a' }));
  assert.equal(await outbox.count(), 1);
  await Promise.all([outbox.flush(), outbox.flush()]);
  assert.deepEqual(sent, ['a']);
});

test('what waits on the phone is encrypted, survives a restart, and is unreadable with another key', async () => {
  const shared = make();
  await shared.outbox.enqueue(entry('meals', { id: 'a' }));
  assert.ok(!shared.store.text.includes('secret'), 'no readable text in storage');
  assert.ok(shared.store.text.startsWith('v1:'));

  const restarted = make({ store: shared.store, keyStore: shared.keyStore });
  assert.equal((await restarted.outbox.list())[0].body.note, 'secret meals');

  const stranger = make({ store: shared.store, keyStore: { value: null } });
  assert.equal(await stranger.outbox.count(), 0, 'without the key the queue is empty, not a crash');
});

test('it holds a limited amount, and drops what is too old to be accepted', async () => {
  const { outbox } = make();
  for (let i = 0; i < MAX_ITEMS; i += 1) assert.equal(await outbox.enqueue(entry('water', { id: `w${i}` })), true);
  assert.equal(await outbox.enqueue(entry('water', { id: 'one-too-many' })), false);

  let clock = new Date('2026-11-01T10:00:00Z');
  const aged = make({ now: () => clock });
  await aged.outbox.enqueue(entry('meals', { id: 'old' }));
  clock = new Date('2026-11-25T10:00:00Z');
  const r = await aged.outbox.flush();
  assert.deepEqual(r.rejected.map((i) => i.id), ['old']);
  assert.deepEqual(aged.sent, [], 'it was not even sent');
});
