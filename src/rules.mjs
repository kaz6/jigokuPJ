// 判定まわりの選び方（コード側）。文面はデータ側に置く。DOM には触れない。

export const FORMAT_VERSION = 3;

// 行き先：六道6つ＋差し戻し＋地蔵へ（弔いの件だけ）
export const REALMS = ['heaven', 'human', 'asura', 'animal', 'hungryGhost', 'hell'];
export const REMAND = 'remand';
export const JIZO = 'jizo';
export const DESTINATIONS = [...REALMS, REMAND, JIZO];

// 評価：六道は proper / wrongful / lenient、差し戻しは retrial / proper（水木のような件）
export const REALM_VERDICTS = ['proper', 'wrongful', 'lenient'];
export const REMAND_VERDICTS = ['retrial', 'proper'];
// 地蔵へ：エンマは裁かず地蔵菩薩に託す。評価は proper だけ（妥当・冤罪・見逃しの外）
export const JIZO_VERDICTS = ['proper'];
export const VERDICTS = [...new Set([...REALM_VERDICTS, ...REMAND_VERDICTS, ...JIZO_VERDICTS])];
export const verdictsAllowedFor = (destination) =>
  destination === REMAND ? REMAND_VERDICTS : destination === JIZO ? JIZO_VERDICTS : REALM_VERDICTS;

export const GAUGE_KEYS = ['kill', 'steal', 'sexual', 'lie', 'intoxicant'];
export const GAUGE_LEVELS = ['none', 'nearlyNone', 'light', 'lightToMedium', 'medium', 'heavy', 'extreme'];

// 上流の4人の王（画面左の4アイコン）。秦広王・初江王・宋帝王・五官王
export const UPSTREAM_KINGS = ['shinko', 'shoko', 'sotei', 'gokan'];

export const WITNESS_TYPES = ['mosquito', 'human', 'pet', 'horse', 'pig', 'bird'];
// 件の種類：平常の亡者／変わり種／弔い（水子など。エンマは裁かず地蔵に託す）
export const MOURNING = 'mourning';
export const CASE_KINDS = ['baseline', 'variant', MOURNING];

// --- 件の種類で決まる振る舞い。JSON には書かず、ここで決める
const isMourning = (caseData) => caseData?.kind === MOURNING;

// 選べる行き先。弔いの件は「地蔵へ」だけ、それ以外は六道＋差し戻し（「地蔵へ」は出さない）
export function selectableDestinations(caseData) {
  return isMourning(caseData) ? [JIZO] : [...REALMS, REMAND];
}
export const canSelect = (caseData, destination) => selectableDestinations(caseData).includes(destination);
export function assertSelectable(caseData, destination) {
  if (!canSelect(caseData, destination)) {
    throw new Error(`${caseData?.id}（${caseData?.kind}）は行き先 ${destination} を選べない（選べるのは ${selectableDestinations(caseData).join('・')}）`);
  }
}

// 線香（質問回数の時間消費）を減らすか。弔いの件では減らさない
export const consumesIncense = (caseData) => !isMourning(caseData);

// ニュースを出す件か。弔いの件では出さない
export const producesNews = (caseData) => !isMourning(caseData);

// 判決の記録（DATA_FORMAT「判決の記録」）を一つ作る。選べない行き先は記録させない
export function makeVerdictRecord({ day, caseData, destination, forced = false, random = false }) {
  assertSelectable(caseData, destination);
  if (random && !forced) throw new Error('ランダム送りは強制判決のときだけ');
  return { formatVersion: FORMAT_VERSION, day, caseId: caseData.id, destination, forced, random };
}

// 幕間：出るタイミングと、台詞の話し手
//   nextMorning：翌朝／noon：その日の昼／afterVerdict：その件の判決の直後（行き先に関係なく）
//   jailer：獄吏（声だけ）
export const INTERLUDE_TIMINGS = ['nextMorning', 'noon', 'afterVerdict'];
export const INTERLUDE_SPEAKERS = ['takamura', 'enma', 'case', 'jailer', 'direction'];

// 「ニュースなし」の印。わざと何も起きない結果。空欄や書き忘れとは別物
export const isNoNews = (v) => v !== null && typeof v === 'object' && v.none === true;
const isNewsText = (v) => typeof v === 'string' && v.trim() !== '';

// ある亡者をある行き先に送ったときの翌朝のニュースを一本に決める。
// 行き先ごとの上書きが最優先、なければその行き先の評価の既定ニュース。
// 差し戻しは上書きだけを見る（評価の既定は六道に送った結果の文面なので流用しない）。
//   { text, from }         ニュースが出る
//   { none: true, from }   わざと何も起きない（「ニュースなし」の印）
//   null                   決まらない（書き忘れ。差し戻しは幕間で受けるので null でよい）
//   弔いの件は常に { none: true, from: 'kind.mourning' }。選べない行き先を渡すと例外
export function resolveNews(caseData, destination) {
  assertSelectable(caseData, destination);
  if (!producesNews(caseData)) return { none: true, from: `kind.${MOURNING}` };
  const pick = (v, from) => {
    if (isNoNews(v)) return { none: true, from };
    if (isNewsText(v)) return { text: v, from };
    return null;
  };
  const override = pick(caseData.news?.overrides?.[destination], `overrides.${destination}`);
  if (override || destination === REMAND) return override;
  const verdict = caseData.verdicts?.[destination];
  return (verdict && pick(caseData.news?.defaults?.[verdict], `defaults.${verdict}`)) || null;
}

// --- 幕間の選び方。JSON には条件を書かず、ここで決める

// 差し戻しの翌朝の幕間：件ごとの上書き → 共通の既定
export const REMAND_INTERLUDE_DEFAULT = 'remand-default';
const REMAND_INTERLUDE_BY_CASE = {
  'inkyo-setomonoya': 'remand-inkyo-setomonoya',
  'moto-eigyoman': 'remand-moto-eigyoman',
};

// 判決に関係なく、その件を裁いた日に出る幕間
const CASE_INTERLUDES = {
  chikusan: ['katsudon-chikusan'],
  ringoya: ['mirror-ringoya'],
};

// 出しどころが未確定の幕間（データはあるが、まだどこにも出さない）
export const UNSCHEDULED_INTERLUDES = [];

export function remandInterludeId(caseId) {
  return REMAND_INTERLUDE_BY_CASE[caseId] ?? REMAND_INTERLUDE_DEFAULT;
}

// 判決の記録（DATA_FORMAT「判決の記録」）から、出す幕間の id を並べる。
//   day 日目に裁いた件 → その日の幕間（例：昼のカツ丼、判決直後の鏡の場面）。いつ出すかは幕間の timing
//   day 日目に差し戻した件（評価 retrial）→ day+1 日目の朝の幕間
//   差し戻しが妥当（評価 proper。水木のような件）なら再審の幕間は出さない
// cases：caseId → 一件の台本。返り値：[{ day, interludeId, caseId }]。
// 並び順・重複の扱いは画面側（JG-002）で決める
export function interludesFor(records, cases) {
  const out = [];
  for (const r of records) {
    for (const id of CASE_INTERLUDES[r.caseId] ?? []) out.push({ day: r.day, interludeId: id, caseId: r.caseId });
    if (r.destination === REMAND && cases[r.caseId]?.verdicts?.[REMAND] === 'retrial') {
      out.push({ day: r.day + 1, interludeId: remandInterludeId(r.caseId), caseId: r.caseId });
    }
  }
  return out;
}

// コード側で名指ししている幕間 id（check-data が data/interludes.json との対応を見る）
export const REFERENCED_INTERLUDES = [
  REMAND_INTERLUDE_DEFAULT,
  ...Object.values(REMAND_INTERLUDE_BY_CASE),
  ...Object.values(CASE_INTERLUDES).flat(),
  ...UNSCHEDULED_INTERLUDES,
];
