#!/usr/bin/env node
// 一日の進行（src/day.mjs）を Node 単体で流して確かめる。DOM に触れない。問題があれば終了コード 1。
//   - 一日目の朝 → 6件 → 昼休み（カツ丼）→ リンゴ屋の判決の直後に鏡の場面 → 夜 → 二日目の朝（ニュース・差し戻しの幕間）→ 再審
//   - 一日の質問回数・同じ質問は数えない・線香が尽きたら強制判決・10秒を超えたら残業代・1分でランダム送り
//   - 同じシードならランダム送りの行き先が同じ
// 使い方：node scripts/check-day.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGame, DAY1_CASE_ORDER } from '../src/day.mjs';
import { REMAND } from '../src/rules.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const cases = readdirSync(join(root, 'data/cases')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => readJson(`data/cases/${f}`));
const data = {
  cases,
  interludes: readJson('data/interludes.json').interludes,
  questions: readJson('data/questions.json').questions,
  params: readJson('data/params.json'),
};

const errors = [];
let checks = 0;
function expect(cond, msg) {
  checks += 1;
  if (!cond) errors.push(msg);
}
function expectThrow(fn, msg) {
  checks += 1;
  try { fn(); errors.push(`${msg}（例外にならなかった）`); } catch { /* ok */ }
}

// --- 1. 一日目を普通に流す：差し戻し2件（隠居・元営業マン）、ほかは六道
{
  const g = createGame({ ...data, seed: 1 });
  const s = g.state;
  const P = g.params;
  expect(s.day === 1 && s.phase === 'morning', '一日目の朝から始まる');
  expect(s.morning.items.length === 1 && s.morning.items[0].type === 'greeting', '一日目の朝は篁のあいさつだけ');
  g.advance();
  expect(s.phase === 'trial' && s.current.caseId === DAY1_CASE_ORDER[0], '朝のあとは一件目の裁判');
  expect(s.current.log[0].kind === 'plea', '裁判の最初に弁明');

  // 質問：一日の回数から引く。同じ質問は数えない
  g.ask('kimono');
  g.ask('kimono');
  g.ask('wealth');
  expect(s.asksUsed === 2, `同じ質問は数えない（asksUsed=${s.asksUsed}）`);
  expect(g.dailyRemaining() === P.questionsPerDay - 2, '残りは 30-2');

  // 線香：裁判パートの間だけ燃える。3分で1減る
  g.tick(P.incenseSecondsPerQuestion - 1);
  expect(g.dailyRemaining() === P.questionsPerDay - 2, '3分たつまでは減らない');
  g.tick(1);
  expect(g.dailyRemaining() === P.questionsPerDay - 3, '3分で1減る');

  const destinations = {
    'inkyo-setomonoya': REMAND, 'moto-eigyoman': REMAND, chikusan: 'hell',
    migatte: 'hungryGhost', 'keibajo-nushi': 'animal', ringoya: 'heaven',
  };
  const seenNoon = [];
  const seenAfter = [];
  while (s.phase !== 'night') {
    if (s.phase === 'trial') {
      expectThrow(() => g.decide('jizo'), '通常の件で地蔵へは選べない');
      g.decide(destinations[s.current.caseId]);
      continue;
    }
    if (s.phase === 'verdict') {
      const burned = s.incenseBurned;
      g.tick(1000);
      expect(s.incenseBurned === burned, '判決の画面では線香が燃えない');
      seenAfter.push(...s.verdict.interludes.map((i) => i.interludeId));
    }
    if (s.phase === 'noon') {
      expect(s.caseIndex === 3, `昼休みは3件のあと（${s.caseIndex}）`);
      seenNoon.push(...s.noon.interludes.map((i) => i.interludeId));
    }
    g.advance();
  }
  expect(seenNoon.join() === 'katsudon-chikusan', `昼休みにカツ丼（${seenNoon}）`);
  expect(seenAfter.join() === 'mirror-ringoya', `判決の直後は鏡の場面だけ（${seenAfter}）`);
  expect(s.night.records.length === 6, '夜：その日の判決が6件');
  expect(s.night.processed === 4, '夜：差し戻しは処理件数に含めない');
  expect(s.night.earnings === 4 * P.earningsPerCase, '夜：稼ぎ＝処理件数×earningsPerCase');
  expect(s.money === 4 * P.earningsPerCase, '所持金');
  expect(s.records.every((r) => r.forced === false && r.random === false), '強制判決なし');

  // 二日目の朝：ニュース4本（差し戻しは出さない）、差し戻しの幕間2本（件ごとの上書き）
  g.advance();
  expect(s.day === 2 && s.phase === 'morning', '二日目の朝');
  const news = s.morning.items.filter((i) => i.type === 'news');
  const inter = s.morning.items.filter((i) => i.type === 'interlude').map((i) => i.interludeId);
  expect(news.length === 4, `二日目の朝のニュースは4本（${news.length}）`);
  expect(news.every((n) => n.destination !== REMAND), '差し戻しのニュースは出さない');
  expect(inter.join() === 'remand-inkyo-setomonoya,remand-moto-eigyoman', `差し戻しの幕間（${inter}）`);
  const firstInterlude = s.morning.items.findIndex((i) => i.type === 'interlude');
  expect(s.morning.items.slice(firstInterlude).every((i) => i.type === 'interlude'), 'ニュースのあとに幕間');
  expect(s.dayCaseIds.join() === 'inkyo-setomonoya,moto-eigyoman', '二日目は差し戻した2件の再審');
  g.advance();
  expect(s.phase === 'trial' && s.current.caseId === 'inkyo-setomonoya', '再審の一件目');
  expect(s.asksUsed === 0 && s.incenseBurned === 0, '一日の回数と線香は日ごとに戻る');
  g.decide('human');
  g.advance();
  g.decide('human');
  g.advance();
  expect(s.phase === 'night' && s.night.processed === 2, '二日目の夜');
  g.advance();
  expect(s.day === 3 && s.morning.items.filter((i) => i.type === 'news').length === 2, '三日目の朝にニュース2本');
  g.advance();
  expect(s.phase === 'end', '再審する件がなければ終わり');
}

// --- 2. 質問を使い切ると、その場で強制判決。残りの件も強制判決
{
  const g = createGame({ ...data, seed: 1 });
  const s = g.state;
  const P = g.params;
  g.advance();
  let n = 0;
  outer: while (true) {
    for (const q of g.questions) {
      if (s.current.forced) break outer;
      if (g.canAskNow(q.id)) { g.ask(q.id); n += 1; }
    }
    if (s.current.forced) break;
    g.decide('human');
    g.advance();
    if (s.phase === 'noon') g.advance();
  }
  expect(n === P.questionsPerDay, `質問は一日 ${P.questionsPerDay} 回まで（${n}）`);
  expect(s.current.forced, '使い切ったら強制判決');
  expect(!g.canAskNow('kimono'), '強制判決のあいだは質問できない');
  expectThrow(() => g.ask('kimono'), '強制判決のあいだは ask が例外');

  // 10秒までは残業代なし。超えた分だけ1秒ごとに減る
  const money0 = s.money;
  g.tick(P.forcedVerdictGraceSeconds);
  expect(s.money === money0, '持ち時間の内は残業代なし');
  g.tick(5);
  expect(s.money === money0 - 5 * P.overtimePayPerSecond, `5秒超えで残業代5（${money0 - s.money}）`);
  const rec = g.decide('hell');
  expect(rec.forced === true && rec.random === false, '強制判決の記録は forced');
  g.advance();
  if (s.phase === 'noon') g.advance();
  expect(s.phase === 'trial' && s.current.forced, '次の件も最初から強制判決');
  // 1分でランダム送り。残業代は最大 (60-10) 秒ぶん
  const money1 = s.money;
  g.tick(P.forcedVerdictRandomSeconds + 30);
  expect(s.phase === 'verdict', '1分でランダムに送られる');
  const r = s.verdict.record;
  expect(r.forced && r.random, 'ランダム送りの記録は forced かつ random');
  expect(money1 - s.money === (P.forcedVerdictRandomSeconds - P.forcedVerdictGraceSeconds) * P.overtimePayPerSecond,
    `残業代は1分ぶんで止まる（${money1 - s.money}）`);
}

// --- 3. 線香が燃え尽きても強制判決。同じシードならランダム送りの行き先が同じ
function randomRun(seed) {
  const g = createGame({ ...data, seed });
  const s = g.state;
  g.advance();
  g.tick(g.params.questionsPerDay * g.params.incenseSecondsPerQuestion);
  const out = [];
  while (s.phase !== 'night') {
    if (s.phase === 'trial') {
      if (!s.current.forced) return null;
      g.tick(g.params.forcedVerdictRandomSeconds);
      out.push(s.verdict.record.destination);
    }
    g.advance();
  }
  return out;
}
{
  const a = randomRun(42);
  const b = randomRun(42);
  expect(a && a.length === 6, '線香が燃え尽きたら6件とも強制判決');
  expect(a && b && a.join() === b.join(), `同じシードなら同じ行き先（${a} / ${b}）`);
  const variety = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => randomRun(seed).join()));
  expect(variety.size > 1, 'シードが違えば行き先も変わる');
}

if (errors.length) {
  console.log(`check-day：失敗 ${errors.length} 件（確認 ${checks} 件）`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`check-day：すべて通過（確認 ${checks} 件）`);
