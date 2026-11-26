/**
 * Finds English written straight into a screen, which would not change with the app's language.
 * Words belong in src/lib/i18n and are shown with t('key').
 *
 *   node scripts/check-text.mjs                    every file
 *   node scripts/check-text.mjs src/app/week.tsx   only these
 *
 * A line that is right as it is (a brand name, a value the server expects) gets a comment: // i18n-ignore
 */
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ts = createRequire(import.meta.url)('typescript');
const base = fileURLToPath(new URL('..', import.meta.url));
const given = process.argv.slice(2);
const all = readdirSync(join(base, 'src'), { recursive: true })
  .map((f) => join('src', f).replaceAll('\\', '/'))
  .filter((f) => /\.tsx?$/.test(f) && !f.startsWith('src/lib/i18n/'));
const files = given.length ? given.map((f) => relative(base, join(process.cwd(), f))) : all;

/** Props and object fields whose text people read. */
const SHOWN = /^(title|label|placeholder|hint|subtitle|message|confirmLabel|cancelLabel|accessibilityLabel|accessibilityHint|detail|text|caption|empty|heading|description|cta|sub|body|unit|name|how|line|short|long)$/;
/** Names that are the same in every language. */
const SAME = /\b(L5 Fitness|L5 FITNESS|L5 Coach|L5|Google Play|Google|Apple Health|Apple|Health Connect|WhatsApp|UPI|IFSC|BMI|HbA1c|LDL|HDL|BP|mg\/dL|mmHg|kcal|km|kg|cm|ml|PR|PDF)\b/g;
const STYLE = /(^|\s)(flex|items-|justify-|self-|text-(white|muted|ink|brand|center|left|right|xs|sm|base|lg|xl|\d|\[)|bg-|p[xytrbl]?-\d|m[xytrbl]?-\d|rounded|border|gap-|w-|h-|font-|opacity-|absolute|active:|tracking-|leading-|overflow-|shrink|grow|uppercase)/;
const words = (s) => /[A-Za-z]{2,}/.test(s.replace(/\$\{[^}]*\}/g, '').replace(SAME, ''));
const sentence = (s) => {
  const plain = s.replace(/\$\{[^}]*\}/g, ' ').trim();
  if (!words(plain) || STYLE.test(plain)) return false;
  if (/^(M |https?:|\/|\.\/|@\/|#|rgba?\()/.test(plain)) return false;
  return /^[A-Z][a-z]+([ ,.'’!?:-]|$)/.test(plain) || /[a-z]{3,}[,.]? [a-z]{2,} [a-z]{2,}/.test(plain);
};

let found = 0;
for (const file of files) {
  const code = readFileSync(join(base, file), 'utf8');
  const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lines = code.split('\n');
  const report = (node, text) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line;
    // The comment may sit on the same line or the one above.
    if (lines[line].includes('i18n-ignore') || lines[line - 1]?.includes('i18n-ignore')) return;
    console.log(`${file}:${line + 1}  ${text.replace(/\s+/g, ' ').trim().slice(0, 90)}`);
    found += 1;
  };
  /** True inside console.*, throw new Error (a developer's message), types and imports. */
  const forDevelopers = (node) => {
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p)) return true;
      if (ts.isCallExpression(p) && /^console\./.test(p.expression.getText())) return true;
      if (ts.isNewExpression(p) && p.expression.getText() === 'Error') return true;
    }
    return false;
  };
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      if (words(node.text)) report(node, node.text);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const text = ts.isTemplateExpression(node) ? node.getText().slice(1, -1) : node.text;
      const parent = node.parent;
      const prop = ts.isJsxAttribute(parent) || ts.isPropertyAssignment(parent) ? parent.name.getText() : null;
      if (!forDevelopers(node)) {
        if (ts.isJsxAttribute(parent)) {
          if (SHOWN.test(prop) && words(text)) report(node, text);
        } else if (prop && /^(ios|android|web|fontFamily|className|icon|kind|type|id|key|code|metric|status|screen|role)$/.test(prop)) {
          // a name the code uses, not words
        } else if (ts.isJsxExpression(parent) && words(text) && !(ts.isJsxAttribute(parent.parent) && !SHOWN.test(parent.parent.name.getText()))) {
          report(node, text);
        } else if (sentence(text)) report(node, text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
console.log(found ? `text: ${found} piece(s) of English written into the code` : `text: no English written into ${files.length} file(s)`);
process.exit(found ? 1 : 0);
