// JG-002 の画面。状態（src/day.mjs の game.state）を読んで描くだけ。判定はここに書かない。
// ビルド（scripts/build-mock.mjs）で src/*.mjs とデータを前に連結し、HTML 一枚に埋め込む。
// ここで使う名前：DATA（埋め込んだデータ）、createGame（src/day.mjs）

/* global DATA, createGame */

// --- 表示名（画面の文言。判定には使わない）
const DEST_LABEL = {
  heaven: '天道', human: '人道', asura: '修羅道', animal: '畜生道',
  hungryGhost: '餓鬼道', hell: '地獄道', remand: '差し戻し', jizo: '地蔵へ',
};
const GAUGE_LABEL = { kill: '殺', steal: '盗', sexual: '邪', lie: '妄', intoxicant: '酒' };
const LEVELS = ['none', 'nearlyNone', 'light', 'lightToMedium', 'medium', 'heavy', 'extreme'];
const LEVEL_LABEL = {
  none: 'なし', nearlyNone: 'ほぼ空', light: '軽', lightToMedium: '軽〜中',
  medium: '中', heavy: '重い', extreme: '桁違い',
};
// 左のアイコン：四人の王（担当の戒をその王の報告と一緒に出す）・罪人・証人
const KINGS = [
  { id: 'shinko', name: '秦広王', icon: '秦', gauges: ['kill'] },
  { id: 'shoko', name: '初江王', icon: '初', gauges: ['steal'] },
  { id: 'sotei', name: '宋帝王', icon: '宋', gauges: ['sexual'] },
  { id: 'gokan', name: '五官王', icon: '五', gauges: ['lie', 'intoxicant'] },
];
const VIEWS = [...KINGS.map((k) => ({ id: k.id, icon: k.icon, label: k.name })),
  { id: 'sinner', icon: '罪', label: '罪人' }, { id: 'witness', icon: '証', label: '証人' }];
const SPEAKER_LABEL = {
  case: '亡者', enma: 'エンマ', takamura: '篁', jailer: '獄吏（声）', witness: '証人（火の玉）', direction: '',
};
// Notion「線香と時間切れ」の台詞
const FORCED_LINE = '時間がねぇ！強制判決じゃい！';
const GREETING_PLACEHOLDER = '［仮］篁のあいさつ（文面は Notion にまだない）';

// --- シードと時間の速さ
const url = new URL(location.href);
const seedParam = url.searchParams.get('seed');
const seed = seedParam !== null && /^\d+$/.test(seedParam) ? Number(seedParam) : Math.floor(Math.random() * 1e6);
let speed = 1;

const game = createGame({ ...DATA, seed });
const s = game.state;
const caseNo = (i) => `${i + 1}人目`;

// --- 画面だけの状態
const ui = { view: 'sinner', armed: null, lastKey: '' };

// --- 小さな部品
function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.append(c);
  return n;
}
const $ = (id) => document.getElementById(id);
// 子を入れ替える（配列は平らにする。native の replaceChildren は配列を文字列にしてしまう）
const put = (node, ...kids) => node.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));

function lineNode(l, caseName = SPEAKER_LABEL.case) {
  if (l.speaker === 'direction') return el('p', { class: 'line direction', text: l.text });
  const who = l.speaker === 'case' ? caseName : SPEAKER_LABEL[l.speaker] ?? l.speaker;
  return el('p', { class: `line sp-${l.speaker} k-${l.kind ?? ''}` }, el('b', { text: who }), el('span', { text: l.text }));
}

function interludeNodes(list) {
  return list.map((i) => el('div', { class: 'interlude' },
    el('div', { class: 'tag', text: `幕間${i.provisional ? '（仮）' : ''}` }),
    i.lines.map((l) => lineNode(l))));
}

// --- 描画
function render() {
  ui.lastKey = stateKey();
  renderStatus();
  renderCourt();
  renderQuestions();
  renderDestinations();
  renderOverlay();
}

function stateKey() {
  return [s.phase, s.day, s.caseIndex, s.current?.forced, s.current?.log.length].join('|');
}

function renderStatus() {
  const total = s.dayCaseIds.length;
  const no = s.phase === 'trial' ? s.current.index + 1 : Math.min(s.caseIndex, total);
  $('st-day').textContent = `${s.day}日目`;
  $('st-case').textContent = total ? `亡者 ${no}／${total}` : '亡者 —';
  updateClock();
}

// 毎フレーム更新する数字（線香・質問回数・所持金・強制判決の時計）
function updateClock() {
  const f = game.incenseFraction();
  $('incense-fill').style.width = `${(f * 100).toFixed(1)}%`;
  $('st-left').textContent = `残り ${game.dailyRemaining()} 回`;
  $('st-asked').textContent = `質問 ${s.asksUsed}／${game.params.questionsPerDay}`;
  $('st-money').textContent = `所持金 ${s.money}`;
  const clock = game.forcedClock();
  const banner = $('forced');
  if (s.phase === 'trial' && clock) {
    banner.hidden = false;
    $('forced-clock').textContent = clock.graceLeft > 0
      ? `持ち時間 あと ${Math.ceil(clock.graceLeft)} 秒`
      : `残業中（残業代 −${s.current.overtimeSeconds * game.params.overtimePayPerSecond}）　ランダム送りまで ${Math.ceil(clock.randomLeft)} 秒`;
  } else banner.hidden = true;
}

function renderCourt() {
  const c = game.currentCase();
  const trial = s.phase === 'trial';
  // 左のアイコン列
  const icons = $('icons');
  put(icons, ...VIEWS.map((v) => el('button', {
    class: `icon${ui.view === v.id ? ' on' : ''}`, 'aria-label': v.label, title: v.label,
    onclick: () => { ui.view = v.id; renderCourt(); },
  }, el('span', { text: v.icon }), el('small', { text: v.label }))));
  // 中央のエンマ
  $('enma').classList.toggle('forced', !!s.current?.forced && trial);
  // 視点の枠
  const view = $('view');
  if (!c) { put(view); put($("thought")); put($("speech")); return; }
  const king = KINGS.find((k) => k.id === ui.view);
  if (king) {
    const lines = c.upstream?.[king.id] ?? [];
    put(view,
      el('h3', { text: `${king.name}の報告` }),
      lines.length ? lines.map((t) => el('p', { class: 'report', text: t })) : el('p', { class: 'report empty', text: '（記載なし）' }),
      el('h4', { text: '計器' }),
      king.gauges.map((g) => gaugeNode(g, c.gauges[g])),
    );
  } else if (ui.view === 'sinner') {
    put(view, el('h3', { text: '罪人' }), el('div', { class: 'back' }, el('div', { class: 'head' }), el('div', { class: 'body' })),
      el('p', { class: 'hint', text: '（後ろ姿）' }));
  } else {
    put(view, el('h3', { text: '証人' }),
      el('div', { class: 'witnesses' }, (c.witnesses ?? []).map((w, i) => el('button', {
        class: `wit t-${w.type}${w.swarm ? ' swarm' : ''}`, 'aria-label': `証人${i + 1}`,
        onclick: () => { game.hearWitness(i); renderCourt(); },
      }, (w.swarm ? [0, 1, 2, 3, 4, 5, 6] : [0]).map((k) => el('i', { class: 'ball', style: `--k:${k}` }))))),
      el('p', { class: 'hint', text: '火の玉をタップすると証言' }));
  }
  // 右上：エンマの心の声（観察）
  put($('thought'), el('div', { class: 'label', text: 'エンマの心の声' }), el('p', { text: c.observation }));
  // 右下：言葉の枠
  const speech = $('speech');
  put(speech, ...s.current.log.map((l) => lineNode(l)));
  speech.scrollTop = speech.scrollHeight;
}

function gaugeNode(key, g) {
  const idx = LEVELS.indexOf(g?.level);
  return el('div', { class: 'gauge' },
    el('span', { class: 'g-name', text: GAUGE_LABEL[key] }),
    el('span', { class: 'g-bar' }, LEVELS.slice(1).map((_, i) => el('i', { class: i < idx ? 'on' : '' }))),
    el('span', { class: 'g-level', text: idx >= 0 ? LEVEL_LABEL[g.level] : '（段階の記載なし）' }),
    g?.note ? el('div', { class: 'g-note', text: g.note }) : null);
}

function renderQuestions() {
  const trial = s.phase === 'trial';
  const asked = s.current?.asked ?? [];
  put($('questions'), ...game.questions.map((q) => el('button', {
    class: `q${asked.includes(q.id) ? ' asked' : ''}`, title: q.text,
    disabled: !(trial && game.canAskNow(q.id)),
    onclick: () => { ui.armed = null; game.ask(q.id); render(); },
  }, el('span', { class: 'qn', text: String(q.order) }), q.heading)));
}

function renderDestinations() {
  const trial = s.phase === 'trial';
  put($('dests'), ...(trial ? game.selectable() : Object.keys(DEST_LABEL).slice(0, 7)).map((d) => el('button', {
    class: `dest d-${d}${ui.armed === d ? ' armed' : ''}`, disabled: !trial,
    onclick: () => {
      if (ui.armed !== d) { ui.armed = d; renderDestinations(); return; }
      ui.armed = null;
      game.decide(d);
      render();
    },
  }, ui.armed === d ? `${DEST_LABEL[d]}で確定` : DEST_LABEL[d])));
}

function pleaOf(caseId) {
  const c = game.caseOf(caseId);
  return c.kind === 'mourning' ? '' : `「${c.plea}」`;
}

function renderOverlay() {
  const ov = $('overlay');
  const next = (label) => el('button', { class: 'next', onclick: () => { game.advance(); ui.armed = null; ui.view = 'sinner'; render(); } }, label);
  let body = null;
  if (s.phase === 'morning') {
    const items = s.morning.items;
    const news = items.filter((i) => i.type === 'news');
    body = [
      el('h2', { text: `${s.day}日目の朝` }),
      items.some((i) => i.type === 'greeting') ? el('div', { class: 'interlude' }, lineNode({ speaker: 'takamura', text: GREETING_PLACEHOLDER })) : null,
      s.day > 1 ? el('h3', { text: '通勤ラッシュのニュース' }) : null,
      s.day > 1 ? (news.length ? el('ul', { class: 'news' }, news.map((n) => el('li', { text: n.text }))) : el('p', { class: 'hint', text: '（ニュースなし）' })) : null,
      interludeNodes(items.filter((i) => i.type === 'interlude')),
      next(s.dayCaseIds.length ? `裁判へ（本日の亡者 ${s.dayCaseIds.length}人）` : '本日の亡者なし'),
    ];
  } else if (s.phase === 'verdict') {
    const r = s.verdict.record;
    body = [
      el('h2', { text: `判決：${DEST_LABEL[r.destination]}` }),
      r.random ? el('p', { class: 'mark', text: '時間切れでランダム送り' }) : r.forced ? el('p', { class: 'mark', text: '強制判決' }) : null,
      interludeNodes(s.verdict.interludes),
      next('次へ'),
    ];
  } else if (s.phase === 'noon') {
    body = [el('h2', { text: '昼休み' }), interludeNodes(s.noon.interludes), next('午後の裁判へ')];
  } else if (s.phase === 'night') {
    const n = s.night;
    body = [
      el('h2', { text: `${s.day}日目の夜` }),
      el('ol', { class: 'verdicts' }, n.records.map((r, i) => el('li', {},
        el('span', { class: 'who', text: `${caseNo(i)}${pleaOf(r.caseId)}` }),
        el('b', { text: ` → ${DEST_LABEL[r.destination]}` }),
        r.random ? el('em', { text: '（ランダム送り）' }) : r.forced ? el('em', { text: '（強制判決）' }) : null))),
      el('p', { class: 'tally', text: `処理件数 ${n.processed}件（差し戻しは含めない）　稼ぎ +${n.earnings}　残業代 −${n.overtime}　所持金 ${s.money}` }),
      next('翌朝へ'),
    ];
  } else if (s.phase === 'end') {
    body = [
      el('h2', { text: 'モックはここまで' }),
      el('p', { text: `所持金 ${s.money}` }),
      el('button', { class: 'next', onclick: () => restart(seed) }, '同じシードで最初から'),
      el('button', { class: 'next', onclick: () => restart(Math.floor(Math.random() * 1e6)) }, '新しいシードで最初から'),
    ];
  }
  ov.hidden = !body;
  if (body) put(ov, el('div', { class: 'sheet' }, body));
}

function restart(newSeed) {
  url.searchParams.set('seed', String(newSeed));
  location.href = url.toString();
}

// --- 隅：シードと時間の速さ
function renderCorner() {
  $('seed').textContent = `seed ${seed}`;
  put($('speed'), el('span', { text: '時間の速さ' }), ...[1, 10].map((v) => el('button', {
    class: speed === v ? 'on' : '', onclick: () => { speed = v; renderCorner(); },
  }, `×${v}`)));
}

// --- 時間を進める。線香が燃えるのは裁判パートの間だけ（day.mjs の tick が決める）
let last = null;
function frame(now) {
  if (last !== null) {
    const dt = Math.min(1, (now - last) / 1000); // 裏に回っていた分は進めない
    game.tick(dt * speed);
    if (stateKey() !== ui.lastKey) render();
    else updateClock();
  }
  last = now;
  requestAnimationFrame(frame);
}

$('forced-line').textContent = FORCED_LINE;
renderCorner();
render();
requestAnimationFrame(frame);
