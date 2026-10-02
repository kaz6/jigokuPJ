#!/usr/bin/env node
// data/ の検査。DOM に触れない。問題があれば終了コード 1。
//   - 全件に共通8問の答えがある（弔いの件は答えと弁明を書かない。どちらも「あー」でコード側が決める）
//   - 弔いの件：証人は先祖1人、篁の語り（narration）が必須。ほかの件に narration は書かない
//   - コード側の保証（弔いの件の質問は2回まで・答えは「あー」・2回目のあとに篁の語り）が効いていること
//   - その件で選べる行き先すべてに評価があり、選べない行き先は書かれていない
//     （通常の件：六道＋差し戻しの7つ。弔いの件：地蔵へ だけ。src/rules.mjs の selectableDestinations）
//   - 六道のどの行き先を選んでもニュースが1本に決まる（「ニュースなし」の印も可）
//     差し戻しは翌朝の幕間で受けるので、ニュースを求めない。弔いの件はニュースを出さない
//   - コード側の保証（選べない行き先を判決の記録にできない）が効いていること
//   - 幕間（data/interludes.json）の形と、コードが名指しする幕間 id がそろっている
// ほかに形式の基本（formatVersion、id、種別、計器、上流の報告、証人、注記）も見る。
//
// 使い方：node scripts/check-data.mjs [データのディレクトリ]（省略時は data/）

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORMAT_VERSION, REMAND, JIZO, MOURNING, DESTINATIONS, VERDICTS, verdictsAllowedFor,
  GAUGE_KEYS, GAUGE_LEVELS, UPSTREAM_KINGS, WITNESS_TYPES, CASE_KINDS,
  INTERLUDE_TIMINGS, INTERLUDE_SPEAKERS, REFERENCED_INTERLUDES, isNoNews, resolveNews,
  selectableDestinations, makeVerdictRecord,
  MOURNING_QUESTION_LIMIT, MOURNING_UTTERANCE, MOURNING_WITNESS, NARRATION_SPEAKERS,
  usesNarration, askQuestion, pleaFor,
} from '../src/rules.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(process.argv[2] ?? join(repoRoot, 'data'));
const root = dirname(dataDir);

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
const isTextList = (v) => Array.isArray(v) && v.every(isText);

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
  const where = `${basename(dataDir)}/cases/${file}`;
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

  // 上流の報告：王ごとの4欄。ほかの欄（旧 unsorted など）は失敗
  const upstreamKeys = UPSTREAM_KINGS;
  if (!c.upstream || typeof c.upstream !== 'object' || Array.isArray(c.upstream)) err(where, 'upstream が王ごとの欄になっていない');
  else {
    for (const key of upstreamKeys) {
      if (!isTextList(c.upstream[key])) err(where, `upstream.${key} が文字列の配列ではない`);
    }
    for (const key of Object.keys(c.upstream)) {
      if (!upstreamKeys.includes(key)) err(where, `upstream に未知の欄（${key}）`);
    }
    if (UPSTREAM_KINGS.every((k) => (c.upstream[k] ?? []).length === 0)) warn(where, 'upstream（上流の報告）がどの王の欄も空');
  }

  const mourning = c.kind === MOURNING;

  // 観察・弁明・真相（弔いの件の弁明は「あー」でコード側が決めるので書かない）
  if (!isText(c.observation)) err(where, 'observation がない');
  if (mourning) {
    if (c.plea !== undefined) err(where, `弔いの件の弁明は「${MOURNING_UTTERANCE}」でコード側が決めるので plea は書かない`);
  } else if (!isText(c.plea)) err(where, 'plea がない');
  if (!Array.isArray(c.truth) || !c.truth.every(isText) || c.truth.length === 0) err(where, 'truth がない');

  // 証人（弔いの件は先祖1人）
  if (!Array.isArray(c.witnesses) || c.witnesses.length === 0) err(where, 'witnesses がない');
  else if (mourning) {
    if (c.witnesses.length !== 1) err(where, `弔いの件の証人は1人だけ（${c.witnesses.length}人）`);
    const w = c.witnesses[0];
    if (w.type !== MOURNING_WITNESS.type || w.identity !== MOURNING_WITNESS.identity) {
      err(where, `弔いの件の証人は ${MOURNING_WITNESS.identity}（type ${MOURNING_WITNESS.type}）（いまは ${w.identity}・${w.type}）`);
    }
  }
  for (const [i, w] of (c.witnesses ?? []).entries()) {
    if (!WITNESS_TYPES.includes(w.type)) err(where, `witnesses[${i}].type が不正（${w.type}）`);
    if (!isText(w.identity)) err(where, `witnesses[${i}].identity（正体）がない`);
    if (typeof w.swarm !== 'boolean') err(where, `witnesses[${i}].swarm（群れかどうか）が true/false ではない`);
    if (!Array.isArray(w.lines) || w.lines.length === 0 || !w.lines.every(isText)) err(where, `witnesses[${i}].lines がない`);
  }

  // 書き手用の注記（画面には出さない）
  for (const key of ['notOnGauges', 'misc']) {
    if (!isTextList(c.writerNotes?.[key])) err(where, `writerNotes.${key} が文字列の配列ではない`);
  }
  for (const key of Object.keys(c.writerNotes ?? {})) {
    if (!['notOnGauges', 'misc'].includes(key)) err(where, `writerNotes に未知の欄（${key}）`);
  }

  // 篁の語り：弔いの件では必須（話し手は takamura）。ほかの件では出しどころがないので書かない
  if (usesNarration(c)) {
    if (!Array.isArray(c.narration) || c.narration.length === 0) err(where, 'narration（篁の語り）がない');
    for (const [j, l] of (c.narration ?? []).entries()) {
      if (!NARRATION_SPEAKERS.includes(l?.speaker)) err(where, `narration[${j}].speaker が不正（${l?.speaker}。${NARRATION_SPEAKERS.join('・')} だけ）`);
      if (!isText(l?.text)) err(where, `narration[${j}].text がない`);
    }
  } else if (c.narration !== undefined && CASE_KINDS.includes(c.kind)) {
    err(where, `kind ${c.kind} の件では篁の語りを出さないので narration は書かない`);
  }

  // 検査1：8問すべてに答え（弔いの件は書かない）
  if (mourning) {
    if (c.answers !== undefined) err(where, `弔いの件の答えは「${MOURNING_UTTERANCE}」でコード側が決めるので answers は書かない`);
  } else {
    for (const qid of questionIds) {
      if (!isText(c.answers?.[qid])) err(where, `質問 ${qid} の答えがない`);
    }
  }
  for (const qid of Object.keys(c.answers ?? {})) {
    if (!questionIds.includes(qid)) err(where, `未知の質問 id への答え（${qid}）`);
  }

  // コード側の保証：弔いの件の質問の流れ（2回まで・「あー」・一日の回数から引かない・2回目のあとに篁の語り）
  if (mourning && questionIds.length > 0) {
    const fail = (msg) => err(where, `コード側の保証が効いていない：${msg}`);
    if (pleaFor(c) !== MOURNING_UTTERANCE) fail(`弁明が「${MOURNING_UTTERANCE}」にならない`);
    let asked = [];
    for (let i = 1; i <= MOURNING_QUESTION_LIMIT + 1; i++) {
      const questionId = questionIds[(i - 1) % questionIds.length];
      let step = null;
      try { step = askQuestion({ caseData: c, asked, questionId, dailyRemaining: 0 }); } catch { /* 聞けない */ }
      if (i > MOURNING_QUESTION_LIMIT) { if (step) fail(`${i}回目の質問を受け付けてしまう`); break; }
      if (!step) { fail(`${i}回目の質問を受け付けない`); break; }
      if (step.answer !== MOURNING_UTTERANCE) fail(`${i}回目の答えが「${MOURNING_UTTERANCE}」にならない`);
      if (step.dailyCost !== 0) fail(`${i}回目の質問が一日の回数から引かれる`);
      if ((i === MOURNING_QUESTION_LIMIT) !== (step.narration === c.narration && step.narration != null)) {
        fail(`${i}回目の質問のあとの篁の語りが${step.narration ? '出てしまう' : '出ない'}`);
      }
      asked = step.asked;
    }
  }

  // 検査2：その件で選べる行き先すべてに評価。選べない行き先の評価は失敗
  const selectable = CASE_KINDS.includes(c.kind) ? selectableDestinations(c) : [];
  for (const dest of selectable) {
    const v = c.verdicts?.[dest];
    if (v === undefined) err(where, `行き先 ${dest} の評価がない`);
    else if (!verdictsAllowedFor(dest).includes(v)) err(where, `行き先 ${dest} の評価が不正（${v}）`);
  }
  for (const dest of Object.keys(c.verdicts ?? {})) {
    if (!DESTINATIONS.includes(dest)) err(where, `未知の行き先（${dest}）`);
    else if (CASE_KINDS.includes(c.kind) && !selectable.includes(dest)) err(where, `kind ${c.kind} の件では行き先 ${dest} を選べないのに評価がある`);
  }

  // コード側の保証：選べない行き先は判決の記録にできない（例外になる）こと
  for (const dest of DESTINATIONS) {
    let ok = true;
    try { makeVerdictRecord({ day: 1, caseData: c, destination: dest }); } catch { ok = false; }
    if (ok !== selectable.includes(dest)) err(where, `コード側の保証が効いていない：行き先 ${dest} の記録が${ok ? '作れてしまう' : '作れない'}`);
  }

  // ニュースの一本一本：文面か「ニュースなし」の印。空欄・null などは書き忘れとして失敗
  for (const [part, keys] of [['defaults', VERDICTS], ['overrides', selectable]]) {
    for (const [key, v] of Object.entries(c.news?.[part] ?? {})) {
      if (c.kind === MOURNING) { err(where, `弔いの件はニュースを出さないので news.${part}.${key} は書かない`); continue; }
      if (!keys.includes(key)) err(where, `news.${part} に未知の、またはこの件で選べない${part === 'defaults' ? '評価' : '行き先'}（${key}）`);
      if (!isText(v) && !isNoNews(v)) err(where, `news.${part}.${key} が空欄か不正（文面か { "none": true } を書く）`);
    }
  }

  // 検査3：六道のどの行き先でもニュースが1本に決まる（差し戻しは幕間で受ける。弔いの件は出さない）
  const row = { id: c.id };
  for (const dest of DESTINATIONS) {
    if (!selectable.includes(dest)) { row[dest] = '（選べない）'; continue; }
    const news = resolveNews(c, dest);
    row[dest] = !news ? (dest === REMAND ? '（幕間）' : '—') : news.none ? `${news.from}（なし）` : news.from;
    if (dest === REMAND) {
      if (news && !news.none) warn(where, `差し戻しにニュースがある（${news.from}）。差し戻しは幕間で受けるので、出すかは未確定`);
      continue;
    }
    if (!news) err(where, `行き先 ${dest}（評価 ${c.verdicts?.[dest]}）のニュースが決まらない`);
  }
  newsTable.push(row);
}

// --- 幕間
const interludes = load(join(dataDir, 'interludes.json'));
const interludeIds = new Set();
for (const [i, it] of (interludes?.interludes ?? []).entries()) {
  const where = `${basename(dataDir)}/interludes.json[${i}]`;
  if (!isText(it.id)) err(where, 'id がない');
  else if (interludeIds.has(it.id)) err(where, `id（${it.id}）が重複している`);
  else interludeIds.add(it.id);
  if (!INTERLUDE_TIMINGS.includes(it.timing)) err(where, `timing が未記入か不正（${it.timing}）`);
  if (it.caseId !== null && !seenIds.has(it.caseId)) err(where, `caseId（${it.caseId}）の台本がない`);
  if (typeof it.provisional !== 'boolean') err(where, 'provisional が true/false ではない');
  else if (it.provisional) warn(where, `${it.id} は仮の文`);
  if (!Array.isArray(it.lines) || it.lines.length === 0) err(where, 'lines がない');
  for (const [j, l] of (it.lines ?? []).entries()) {
    if (!isText(l.text)) err(where, `lines[${j}].text がない`);
    if (!INTERLUDE_SPEAKERS.includes(l.speaker)) err(where, `lines[${j}].speaker が未記入か不正（${l.speaker}）`);
  }
}
for (const id of REFERENCED_INTERLUDES) {
  if (!interludeIds.has(id)) err('data/interludes.json', `コード（src/rules.mjs）が名指しする幕間 ${id} がない`);
}
for (const id of interludeIds) {
  if (!REFERENCED_INTERLUDES.includes(id)) warn('data/interludes.json', `幕間 ${id} はコードのどこからも出されない`);
}

// --- 結果
console.log(`check-data（${dataDir}）: 質問 ${questionIds.length} 問、亡者 ${files.length} 件、幕間 ${interludeIds.size} 本\n`);
console.log('ニュースの決まり方（行き先 → 出どころ。— は決まらない、（なし）はニュースなしの印、（幕間）は差し戻しの幕間で受ける）');
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
