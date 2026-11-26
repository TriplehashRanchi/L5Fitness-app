/**
 * Every screen in src/app must be listed in src/app/_layout.tsx. Expo Router shows a screen that is not
 * listed to everyone, so a logged-out member could land on it and have no way to the login screen.
 *
 *   node scripts/check-routes.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('../src/app/', import.meta.url);
const listed = new Set([...readFileSync(new URL('_layout.tsx', root), 'utf8').matchAll(/<Stack\.Screen name="([^"]+)"/g)].map((m) => m[1]));

const screens = new Set(
  readdirSync(root, { recursive: true })
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => /\.tsx?$/.test(file) && !/(^|\/)[_+]/.test(file))
    // A folder like (tabs) has its own navigator, so the root lists the folder, not the files in it.
    .map((file) => (file.startsWith('(') ? file.split('/')[0] : file.replace(/\.tsx?$/, '')))
);

const open = [...screens].filter((name) => !listed.has(name));
if (open.length) {
  console.error(`Screens missing from src/app/_layout.tsx (anyone can open them): ${open.join(', ')}`);
  process.exit(1);
}
console.log(`Routes: all ${screens.size} screens are listed in the root layout.`);
