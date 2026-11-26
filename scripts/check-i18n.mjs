// Every translation must cover every English key and keep the same {placeholders} and {hl} markers.
// The words are the core files (src/lib/i18n/<language>.ts) plus one file per area in src/lib/i18n/parts.
import { readdirSync } from 'node:fs';

const LANGS = ['ml', 'ta', 'kn', 'te'];
const root = new URL('../src/lib/i18n/', import.meta.url);
const core = {};
for (const lang of ['en', ...LANGS]) core[lang] = (await import(new URL(`${lang}.ts`, root)))[lang];
const groups = [['core', core]];
for (const file of readdirSync(new URL('parts/', root)).filter((f) => f.endsWith('.ts')).sort()) {
  const name = file.replace(/\.ts$/, '');
  groups.push([name, (await import(new URL(`parts/${file}`, root)))[name]]);
}

const marks = (s) => [...s.matchAll(/\{(\w+|\/hl)\}/g)].map((m) => m[1]).sort().join(',');
let problems = 0;
let total = 0;
const seen = new Map();
const fail = (text) => { console.log(text); problems += 1; };
for (const [group, tables] of groups) {
  const { en } = tables;
  for (const k of Object.keys(en)) {
    if (seen.has(k)) fail(`${k} is in both ${seen.get(k)} and ${group}`);
    seen.set(k, group);
    total += 1;
  }
  for (const name of LANGS) {
    const table = tables[name];
    const missing = Object.keys(en).filter((k) => !table[k]);
    const unknown = Object.keys(table).filter((k) => !(k in en));
    if (missing.length) fail(`${group}.${name}: ${missing.length} missing, for example ${missing.slice(0, 3).join(', ')}`);
    if (unknown.length) fail(`${group}.${name}: unknown keys ${unknown.join(', ')}`);
    for (const k of Object.keys(table)) {
      if (en[k] && marks(en[k]) !== marks(table[k])) fail(`${group}.${name}: ${k} does not keep the placeholders of the English`);
    }
  }
}
console.log(problems ? `i18n: ${problems} problem(s)` : `i18n: ${total} texts, all four languages complete and consistent`);
process.exit(problems ? 1 : 0);
