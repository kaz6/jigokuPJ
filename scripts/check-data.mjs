#!/usr/bin/env node
// data/ の検査。DOM に触れない。問題があれば終了コード 1。
//   - 全件に共通8問の答えがある
//   - 7つの行き先すべてに評価がある
//   - どの行き先を選んでもニュースが1本に決まる
// ほかに形式の基本（formatVersion、id、種別、計器、証人の型）も見る。

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORMAT_VERSION, REALMS, REMAND, DESTINATIONS, REALM_VERDICTS, REMAND_VERDICTS,
  GAUGE_KEYS, GAUGE_LEVELS, WITNESS_TYPES, CASE_KINDS, resolveNews,
} from '../src/rules.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

function load(path) {
  const where = path.slice(root.length + 1);
  try {
    const json = JSON.parse(readFileSync(path, 'utf8'));
    if (json.formatVersion !== FORMAT_VERSION) {
      err(where, `formatVersion が ${FORMAT_VERSION} ではない（${json.formatVersion}）`);
    }
    return json;
  } catch (e) {
    err(where, `読めない（${e.message}）`);
    return null;
  }
}

const isText = (v) => typeof v === 'string' && v.trim() !== '';

// --- 共通ファイル
const questions = load(join(dataDir, 'questions.json'));
const questionIds = (questions?.questions ?? []).map((q) => q.id);
if (questionIds.length !== 8) err('data/questions.json', `質問が8問ではない（${questionIds.length}問）`);
if (new Set(questionIds).size !== questionIds.length) err('data/questions.json', '質問の id が重複している');

const params = load(join(dataDir, 'params.json'));
for (const [key, p] of Object.entries(params?.params ?? {})) {
  if (typeof p.value !== 'number') err('data/params.json', `${key}.value が数値ではない`);
  if (p.provisional) warn('data/params.json', `${key} は仮の値（${p.value}）`);
}

// --- 一件ずつ
const casesDir = join(dataDir, 'cases');
const files = readdirSync(casesDir).filter((f) => f.endsWith('.json')).sort();
const seenIds = new Set();
const newsTable = [];

for (const file of files) {
  const where = `data/cases/${file}`;
  const c = load(join(casesDir, file));
  if (!c) continue;

  // id・名前・種別
  if (!isText(c.id)) err(where, 'id がない');
  else {
    if (c.id !== basename(file, '.json')) err(where, `id（${c.id}）とファイル名が一致しない`);
    if (seenIds.has(c.id)) err(where, `id（${c.id}）が重複している`);
    seenIds.add(c.id);
  }
  if (!isText(c.name)) err(where, 'name がない');
  if (!CASE_KINDS.includes(c.kind)) err(where, `kind が不正（${c.kind}）`);

  // 計器：五戒の5欄
  for (const key of GAUGE_KEYS) {
    const g = c.gauges?.[key];
    if (!g) { err(where, `gauges.${key} がない`); continue; }
    if (g.level === null) warn(where, `gauges.${key} の重さの段階が未記入（注記：${g.note || 'なし'}）`);
    else if (!GAUGE_LEVELS.includes(g.level)) err(where, `gauges.${key}.level が不正（${g.level}）`);
    if (typeof g.note !== 'string') err(where, `gauges.${key}.note が文字列ではない`);
  }
  for (const key of Object.keys(c.gauges ?? {})) {
    if (!GAUGE_KEYS.includes(key)) err(where, `gauges に未知の欄（${key}）`);
  }

  // 上流・観察・弁明・真相
  if (!Array.isArray(c.upstream)) err(where, 'upstream が配列ではない');
  else if (c.upstream.length === 0) warn(where, 'upstream（上流の報告）が空');
  if (!isText(c.observation)) err(where, 'observation がない');
  if (!isText(c.plea)) err(where, 'plea がない');
  if (!Array.isArray(c.truth) || !c.truth.every(isText) || c.truth.length === 0) err(where, 'truth がない');

  // 証人
  if (!Array.isArray(c.witnesses) || c.witnesses.length === 0) err(where, 'witnesses がない');
  for (const [i, w] of (c.witnesses ?? []).entries()) {
    if (!WITNESS_TYPES.includes(w.type)) err(where, `witnesses[${i}].type が不正（${w.type}）`);
    if (!Array.isArray(w.lines) || w.lines.length === 0 || !w.lines.every(isText)) err(where, `witnesses[${i}].lines がない`);
  }

  // 検査1：8問すべてに答え
  for (const qid of questionIds) {
    if (!isText(c.answers?.[qid])) err(where, `質問 ${qid} の答えがない`);
  }
  for (const qid of Object.keys(c.answers ?? {})) {
    if (!questionIds.includes(qid)) err(where, `未知の質問 id への答え（${qid}）`);
  }

  // 検査2：7つの行き先すべてに評価
  for (const dest of DESTINATIONS) {
    const v = c.verdicts?.[dest];
    const allowed = dest === REMAND ? REMAND_VERDICTS : REALM_VERDICTS;
    if (v === undefined) err(where, `行き先 ${dest} の評価がない`);
    else if (!allowed.includes(v)) err(where, `行き先 ${dest} の評価が不正（${v}）`);
  }
  for (const dest of Object.keys(c.verdicts ?? {})) {
    if (!DESTINATIONS.includes(dest)) err(where, `未知の行き先（${dest}）`);
  }

  // 検査3：どの行き先でもニュースが1本に決まる
  const row = { id: c.id };
  for (const dest of DESTINATIONS) {
    const news = resolveNews(c, dest);
    row[dest] = news ? news.from : '—';
    if (!news) err(where, `行き先 ${dest}（評価 ${c.verdicts?.[dest]}）のニュースが決まらない`);
  }
  newsTable.push(row);
  for (const key of Object.keys(c.news?.overrides ?? {})) {
    if (!DESTINATIONS.includes(key)) err(where, `news.overrides に未知の行き先（${key}）`);
  }
  for (const key of Object.keys(c.news?.defaults ?? {})) {
    if (!REALM_VERDICTS.includes(key) && !REMAND_VERDICTS.includes(key)) err(where, `news.defaults に未知の評価（${key}）`);
  }
}

// --- 結果
console.log(`check-data: 質問 ${questionIds.length} 問、亡者 ${files.length} 件\n`);
console.log('ニュースの決まり方（行き先 → 出どころ。— は決まらない）');
console.table(newsTable);
if (warnings.length) {
  console.log(`\n注意 ${warnings.length} 件（失敗ではない）`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.log(`\n失敗 ${errors.length} 件`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exitCode = 1;
} else {
  console.log('\nすべて通過');
}
