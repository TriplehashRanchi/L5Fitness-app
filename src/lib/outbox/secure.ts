import { gcm } from '@noble/ciphers/aes.js';

/**
 * Encryption for what waits in the outbox: AES-256-GCM with a key made once on the phone and kept in the
 * phone's secure store (Keychain on iPhone, Keystore on Android). A lost phone's queue is unreadable without it.
 *
 * `random` and the key store are passed in so this can be tested on a computer.
 */

export type KeyStore = { get: () => Promise<string | null>; set: (value: string) => Promise<void> };
export type Random = (length: number) => Uint8Array;

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const utf8 = (text: string) => new TextEncoder().encode(text);

export function createCipher(store: KeyStore, random: Random) {
  let key: Uint8Array | null = null;
  async function getKey() {
    if (key) return key;
    const saved = await store.get();
    if (saved) return (key = fromBase64(saved));
    key = random(32);
    await store.set(toBase64(key));
    return key;
  }
  return {
    async encrypt(plain: string): Promise<string> {
      const nonce = random(12);
      const sealed = gcm(await getKey(), nonce).encrypt(utf8(plain));
      const out = new Uint8Array(nonce.length + sealed.length);
      out.set(nonce);
      out.set(sealed, nonce.length);
      return `v1:${toBase64(out)}`;
    },
    async decrypt(text: string): Promise<string> {
      if (!text.startsWith('v1:')) throw new Error('unknown format');
      const bytes = fromBase64(text.slice(3));
      const plain = gcm(await getKey(), bytes.slice(0, 12)).decrypt(bytes.slice(12));
      return new TextDecoder().decode(plain);
    },
  };
}
