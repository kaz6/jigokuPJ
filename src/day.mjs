// 一日の進行（朝 → 裁判 → 夜 → 翌朝）。DOM に触れない。画面はこの状態を読むだけ。
// 判定（選べる行き先・質問の答え・判決の記録・ニュース・幕間の選び方）は src/rules.mjs をそのまま呼ぶ。
// ここで持つのは時間の進み方（線香・強制判決・ランダム送り・残業代）と、画面の順番だけ。
// 時間は tick(秒) で外から進める（実時間かどうか、速さ何倍かは画面側の都合）。

import {
  REMAND, selectableDestinations, canAsk, askQuestion, pleaFor, makeVerdictRecord,
  resolveNews, interludesFor, consumesIncense,
} from './rules.mjs';
import { createRng, normalizeSeed } from './rng.mjs';

// 一日目の件の並び。平常の亡者（ベースライン）を先に、昼休みの前に家畜産業の人（昼のカツ丼）、
// 最後にリンゴ屋（判決の直後に鏡の場面）。R-023
export const DAY1_CASE_ORDER = [
  'inkyo-setomonoya', 'moto-eigyoman', 'chikusan',
  'migatte', 'keibajo-nushi', 'ringoya',
];

// 昼休みは、その日の件の半分（切り上げ）を裁いたあと。R-024
export const noonAfter = (caseCount) => Math.ceil(caseCount / 2);

export const PHASES = ['morning', 'trial', 'verdict', 'noon', 'night', 'end'];

const PARAM_KEYS = [
  'questionsPerDay', 'incenseSecondsPerQuestion', 'forcedVerdictGraceSeconds',
  'forcedVerdictRandomSeconds', 'overtimePayPerSecond', 'earningsPerCase',
];

export function readParams(paramsJson) {
  const out = {};
  for (const k of PARAM_KEYS) {
    const v = paramsJson?.params?.[k]?.value;
    if (typeof v !== 'number') throw new Error(`params.json に ${k} の数値がない`);
    out[k] = v;
  }
  return out;
}

// cases：一件の台本の並び／interludes：data/interludes.json の interludes／questions：data/questions.json の questions
export function createGame({ cases, interludes, questions, params, seed, order = DAY1_CASE_ORDER }) {
  const P = readParams(params);
  const casesById = Object.fromEntries(cases.map((c) => [c.id, c]));
  const interludesById = Object.fromEntries(interludes.map((i) => [i.id, i]));
  const questionsById = Object.fromEntries(questions.map((q) => [q.id, q]));
  for (const id of order) if (!casesById[id]) throw new Error(`一日目の並びに台本のない件がある：${id}`);
  const rng = createRng(seed);

  const s = {
    seed: normalizeSeed(seed),
    params: P,
    day: 0,
    phase: 'morning',
    money: 0,
    records: [],
    morning: null,    // { items: [{ type: 'greeting' } | { type: 'news', caseId, text } | { type: 'interlude', ... }] }
    dayCaseIds: [],
    caseIndex: 0,
    noonDone: false,
    asksUsed: 0,      // 一日の質問回数から引いた数（同じ質問の聞き直しと、引かない件は入らない）
    incenseBurned: 0, // 線香が燃えた秒数（裁判パートの間だけ）
    dayOvertime: 0,   // その日の残業代（所持金から引いた額）
    pendingNoon: [],
    current: null,    // { caseId, asked, log, forced, forcedElapsed, overtimeSeconds }
    verdict: null,    // { record, interludes }
    noon: null,       // { interludes }
    night: null,      // { records, processed, earnings, overtime }
  };

  const caseOf = (id) => casesById[id];
  const currentCase = () => (s.current ? caseOf(s.current.caseId) : null);
  const interludeEntry = (e) => ({ type: 'interlude', ...e, ...pickInterlude(e.interludeId) });
  function pickInterlude(id) {
    const i = interludesById[id];
    if (!i) throw new Error(`幕間 ${id} がデータにない`);
    return { timing: i.timing, lines: i.lines, provisional: i.provisional };
  }

  // 一日の質問回数の残り（整数）。線香は incenseSecondsPerQuestion 秒ごとに 1 減らす
  const dailyRemaining = () =>
    P.questionsPerDay - s.asksUsed - Math.floor(s.incenseBurned / P.incenseSecondsPerQuestion);
  // 線香の長さ（0〜1）。燃えている途中の分も含めて連続に減る
  const incenseFraction = () => Math.max(0, Math.min(1,
    (P.questionsPerDay - s.asksUsed - s.incenseBurned / P.incenseSecondsPerQuestion) / P.questionsPerDay));
  const incenseOut = () => dailyRemaining() <= 0;

  function startMorning() {
    s.day += 1;
    const prev = s.records.filter((r) => r.day === s.day - 1);
    const items = [];
    if (s.day === 1) items.push({ type: 'greeting' });
    // 前日の判決のニュース（差し戻しは幕間で受けるので出さない。「ニュースなし」も出さない）
    for (const r of prev) {
      if (r.destination === REMAND) continue;
      const news = resolveNews(caseOf(r.caseId), r.destination);
      if (news?.text) items.push({ type: 'news', caseId: r.caseId, destination: r.destination, text: news.text });
    }
    // 翌朝の幕間：差し戻しの幕間（day が今日）と、前日に裁いた件の nextMorning の幕間
    const seen = new Set();
    for (const e of interludesFor(prev, casesById)) {
      const { timing } = pickInterlude(e.interludeId);
      const today = e.day === s.day || (e.day === s.day - 1 && timing === 'nextMorning');
      const key = `${e.interludeId}/${e.caseId}`;
      if (!today || timing !== 'nextMorning' || seen.has(key)) continue;
      seen.add(key);
      items.push(interludeEntry(e));
    }
    s.morning = { items };
    // 一日目は決まった並び。二日目からは前日に差し戻した件（再審）
    s.dayCaseIds = s.day === 1 ? [...order] : [...new Set(prev.filter((r) => r.destination === REMAND).map((r) => r.caseId))];
    s.caseIndex = 0;
    s.noonDone = false;
    s.asksUsed = 0;
    s.incenseBurned = 0;
    s.dayOvertime = 0;
    s.pendingNoon = [];
    s.current = null;
    s.verdict = null;
    s.noon = null;
    s.night = null;
    s.phase = 'morning';
  }

  function startCase() {
    const id = s.dayCaseIds[s.caseIndex];
    const c = caseOf(id);
    s.current = {
      caseId: id,
      index: s.caseIndex,
      asked: [],
      log: [{ kind: 'plea', speaker: 'case', text: pleaFor(c) }],
      forced: false,
      forcedElapsed: 0,
      overtimeSeconds: 0,
    };
    s.phase = 'trial';
    if (consumesIncense(c) && incenseOut()) startForced();
  }

  function startForced() {
    s.current.forced = true;
    s.current.forcedElapsed = 0;
    s.current.overtimeSeconds = 0;
  }

  function finishCase(record) {
    s.records.push(record);
    const shown = [];
    for (const e of interludesFor([record], casesById)) {
      if (e.day !== s.day) continue; // 翌朝の分は朝に records から引き直す
      const entry = interludeEntry(e);
      if (entry.timing === 'afterVerdict') shown.push(entry);
      // 昼の幕間：昼休みの前なら昼休みに、過ぎていたら判決の直後に出す（R-024）
      else if (entry.timing === 'noon') (s.noonDone ? shown : s.pendingNoon).push(entry);
    }
    s.verdict = { record, interludes: shown };
    s.caseIndex += 1;
    s.phase = 'verdict';
  }

  function nextCaseOrNight() {
    s.verdict = null;
    s.noon = null;
    if (s.caseIndex < s.dayCaseIds.length) return startCase();
    const today = s.records.filter((r) => r.day === s.day);
    const processed = today.filter((r) => r.destination !== REMAND).length; // 差し戻しは処理件数に含めない
    const earnings = processed * P.earningsPerCase;
    s.money += earnings;
    s.current = null;
    s.night = { records: today, processed, earnings, overtime: s.dayOvertime };
    s.phase = 'night';
  }

  const game = {
    state: s,
    params: P,
    caseOf,
    currentCase,
    question: (id) => questionsById[id],
    questions: [...questions].sort((a, b) => a.order - b.order),
    dailyRemaining: () => Math.max(0, dailyRemaining()),
    incenseFraction,
    incenseOut,
    // 強制判決の残り（ランダム送りまで・持ち時間まで）
    forcedClock() {
      if (!s.current?.forced) return null;
      const t = s.current.forcedElapsed;
      return {
        elapsed: t,
        graceLeft: Math.max(0, P.forcedVerdictGraceSeconds - t),
        randomLeft: Math.max(0, P.forcedVerdictRandomSeconds - t),
      };
    },
    selectable: () => (currentCase() ? selectableDestinations(currentCase()) : []),

    canAskNow(questionId) {
      if (s.phase !== 'trial' || s.current.forced) return false;
      return canAsk({ caseData: currentCase(), asked: s.current.asked, questionId, dailyRemaining: game.dailyRemaining() });
    },

    ask(questionId) {
      if (s.phase !== 'trial') throw new Error('裁判パートの外では質問できない');
      if (s.current.forced) throw new Error('強制判決のあいだは質問できない');
      const c = currentCase();
      const res = askQuestion({ caseData: c, asked: s.current.asked, questionId, dailyRemaining: game.dailyRemaining() });
      s.current.asked = res.asked;
      s.asksUsed += res.dailyCost;
      s.current.log.push({ kind: 'question', speaker: 'enma', text: questionsById[questionId].text, questionId });
      s.current.log.push({ kind: 'answer', speaker: 'case', text: res.answer, questionId });
      for (const l of res.narration ?? []) s.current.log.push({ kind: 'narration', speaker: l.speaker, text: l.text });
      // 最後の一回で線香が尽きたら、その場で強制判決
      if (consumesIncense(c) && incenseOut()) startForced();
      return res;
    },

    // 証人（火の玉）の台詞を聞く。判定には関わらない
    hearWitness(index) {
      if (s.phase !== 'trial') return;
      const w = currentCase().witnesses?.[index];
      if (!w) return;
      for (const text of w.lines) s.current.log.push({ kind: 'witness', speaker: 'witness', text, witnessIndex: index });
    },

    // プレイヤーが行き先を決める（強制判決中も同じ入口。記録の forced に残る）
    decide(destination) {
      if (s.phase !== 'trial') throw new Error('裁判パートの外では判決できない');
      const record = makeVerdictRecord({ day: s.day, caseData: currentCase(), destination, forced: s.current.forced, random: false });
      finishCase(record);
      return record;
    },

    // 時間を進める（秒）。線香は裁判パートの間だけ燃える。強制判決中は持ち時間を数える
    tick(seconds) {
      if (s.phase !== 'trial' || !(seconds > 0)) return;
      const c = currentCase();
      if (!s.current.forced) {
        if (!consumesIncense(c)) return;
        s.incenseBurned += seconds;
        if (incenseOut()) startForced();
        return;
      }
      const cur = s.current;
      cur.forcedElapsed += seconds;
      const over = Math.floor(Math.max(0, Math.min(cur.forcedElapsed, P.forcedVerdictRandomSeconds) - P.forcedVerdictGraceSeconds));
      if (over > cur.overtimeSeconds) {
        const pay = (over - cur.overtimeSeconds) * P.overtimePayPerSecond;
        s.money -= pay; // 所持金はフレーバー。マイナスになっても止めない
        s.dayOvertime += pay;
        cur.overtimeSeconds = over;
      }
      if (cur.forcedElapsed >= P.forcedVerdictRandomSeconds) {
        const destination = rng.pick(selectableDestinations(c));
        finishCase(makeVerdictRecord({ day: s.day, caseData: c, destination, forced: true, random: true }));
      }
    },

    // 画面を一つ進める（朝 → 裁判、判決 → 昼休み／次の件／夜、夜 → 翌朝）
    advance() {
      switch (s.phase) {
        case 'morning':
          if (s.dayCaseIds.length === 0) { s.phase = 'end'; return; }
          return startCase();
        case 'verdict':
          if (!s.noonDone && s.caseIndex >= noonAfter(s.dayCaseIds.length)) {
            s.noonDone = true;
            if (s.pendingNoon.length) {
              s.verdict = null;
              s.noon = { interludes: s.pendingNoon };
              s.pendingNoon = [];
              s.phase = 'noon';
              return;
            }
          }
          return nextCaseOrNight();
        case 'noon':
          return nextCaseOrNight();
        case 'night':
          return startMorning();
        default:
          return;
      }
    },
  };

  startMorning();
  return game;
}
