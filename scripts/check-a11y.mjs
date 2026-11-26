// Every tappable thing should tell a screen reader what it is: a <Pressable> needs an accessibilityRole or an accessibilityLabel.
// This reads the source (it does not run the app), so it finds the ones that were forgotten.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src', import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) files.push(p);
  }
})(root);

/** The text of the opening tag that starts at `i` (up to its closing `>`, ignoring `=>` and anything in braces or quotes). */
function openingTag(src, i) {
  let depth = 0;
  let quote = null;
  for (let j = i; j < src.length; j += 1) {
    const c = src[j];
    if (quote) { if (c === quote && src[j - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0 && src[j - 1] !== '=') return src.slice(i, j + 1);
  }
  return src.slice(i, i + 400);
}

const missing = [];
let total = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  for (let i = src.indexOf('<Pressable'); i !== -1; i = src.indexOf('<Pressable', i + 1)) {
    total += 1;
    const tag = openingTag(src, i);
    if (!/accessibilityRole|accessibilityLabel|role=|accessible=\{false\}/.test(tag)) {
      const line = src.slice(0, i).split('\n').length;
      missing.push(`${file.replace(`${root}/`, 'src/')}:${line}`);
    }
  }
}
console.log(missing.length ? `a11y: ${missing.length} of ${total} buttons have no role or label:\n  ${missing.join('\n  ')}` : `a11y: all ${total} buttons have a role or a label`);
process.exit(missing.length ? 1 : 0);
