#!/usr/bin/env node
// JG-002 のモックを HTML 一枚に組む：dist/jigoku-mock.html
//   - data/ の JSON を埋め込む（外部ファイル・通信なし）
//   - src/rng.mjs・src/rules.mjs・src/day.mjs の import/export を外して一つのスクリプトに連結し、mock/ui.js を続ける
//     （判定は src/rules.mjs をそのまま使う。画面側に判定を書かない）
//   - 同じ入力なら同じ出力（入力のハッシュを画面の隅に出す）
// 使い方：node scripts/build-mock.mjs

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const readJson = (p) => JSON.parse(read(p));

// --- データ
const caseFiles = readdirSync(join(root, 'data/cases')).filter((f) => f.endsWith('.json')).sort();
const DATA = {
  cases: caseFiles.map((f) => readJson(`data/cases/${f}`)),
  interludes: readJson('data/interludes.json').interludes,
  questions: readJson('data/questions.json').questions,
  params: readJson('data/params.json'),
};

// --- モジュールを一つのスクリプトに（並びは依存の順）
const MODULES = ['src/rng.mjs', 'src/rules.mjs', 'src/day.mjs'];
function stripModule(path) {
  const src = read(path)
    .replace(/^import\s[\s\S]*?\sfrom\s+['"][^'"]+['"];[ \t]*$/gm, '')
    .replace(/^export\s+(?=(const|let|function|class)\s)/gm, '');
  const left = src.match(/^\s*(import|export)\b.*$/m);
  if (left) throw new Error(`${path}：外せなかった import/export がある → ${left[0]}`);
  return `// ---- ${path}\n${src}`;
}
const modules = MODULES.map(stripModule).join('\n');
const ui = read('mock/ui.js');

// 埋め込む JSON の中の </script> を壊さない
const dataJs = `const DATA = ${JSON.stringify(DATA).replace(/</g, '\\u003c')};`;
const script = `(function () {\n'use strict';\n${dataJs}\n${modules}\n// ---- mock/ui.js\n${ui}\n})();`;

// 構文の確認（実行はしない）
new vm.Script(script, { filename: 'jigoku-mock.js' });

const hash = createHash('sha256').update(script).update(read('mock/style.css')).update(read('mock/index.html'))
  .digest('hex').slice(0, 8);
const html = read('mock/index.html')
  .replace('/*__STYLE__*/', () => read('mock/style.css'))
  .replace('/*__SCRIPT__*/', () => script)
  .replace('/*__BUILD__*/', () => `build ${hash}`);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/jigoku-mock.html'), html);
console.log(`dist/jigoku-mock.html（${(html.length / 1024).toFixed(1)} KB、build ${hash}、件 ${DATA.cases.length}、幕間 ${DATA.interludes.length}）`);
