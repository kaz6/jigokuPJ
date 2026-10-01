// 判定まわりの選び方（コード側）。文面はデータ側に置く。DOM には触れない。

export const FORMAT_VERSION = 2;

// 行き先：六道6つ＋差し戻し
export const REALMS = ['heaven', 'human', 'asura', 'animal', 'hungryGhost', 'hell'];
export const REMAND = 'remand';
export const DESTINATIONS = [...REALMS, REMAND];

// 評価：六道は proper / wrongful / lenient、差し戻しは retrial / proper（水木のような件）
export const REALM_VERDICTS = ['proper', 'wrongful', 'lenient'];
export const REMAND_VERDICTS = ['retrial', 'proper'];
export const VERDICTS = [...new Set([...REALM_VERDICTS, ...REMAND_VERDICTS])];

export const GAUGE_KEYS = ['kill', 'steal', 'sexual', 'lie', 'intoxicant'];
export const GAUGE_LEVELS = ['none', 'nearlyNone', 'light', 'lightToMedium', 'medium', 'heavy', 'extreme'];

// 上流の4人の王（画面左の4アイコン）。秦広王・初江王・宋帝王・五官王
export const UPSTREAM_KINGS = ['shinko', 'shoko', 'sotei', 'gokan'];

export const WITNESS_TYPES = ['mosquito', 'human', 'pet', 'horse', 'pig', 'bird'];
export const CASE_KINDS = ['baseline', 'variant'];

// 幕間：出るタイミングと、台詞の話し手
export const INTERLUDE_TIMINGS = ['nextMorning', 'noon'];
export const INTERLUDE_SPEAKERS = ['takamura', 'enma', 'case', 'direction'];

// 「ニュースなし」の印。わざと何も起きない結果。空欄や書き忘れとは別物
export const isNoNews = (v) => v !== null && typeof v === 'object' && v.none === true;
const isNewsText = (v) => typeof v === 'string' && v.trim() !== '';

// ある亡者をある行き先に送ったときの翌朝のニュースを一本に決める。
// 行き先ごとの上書きが最優先、なければその行き先の評価の既定ニュース。
// 差し戻しは上書きだけを見る（評価の既定は六道に送った結果の文面なので流用しない）。
//   { text, from }         ニュースが出る
//   { none: true, from }   わざと何も起きない（「ニュースなし」の印）
//   null                   決まらない（書き忘れ。差し戻しは幕間で受けるので null でよい）
export function resolveNews(caseData, destination) {
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
  'moto-eigyoman': 'remand-moto-eigyoman',
};

// 判決に関係なく、その件を裁いた日に出る幕間
const CASE_INTERLUDES = {
  chikusan: ['katsudon-chikusan'],
};

// 出しどころが未確定の幕間（データはあるが、まだどこにも出さない）
export const UNSCHEDULED_INTERLUDES = ['mirror-ringoya'];

export function remandInterludeId(caseId) {
  return REMAND_INTERLUDE_BY_CASE[caseId] ?? REMAND_INTERLUDE_DEFAULT;
}

// 判決の記録（DATA_FORMAT「判決の記録」）から、出す幕間の id を並べる。
//   day 日目に裁いた件 → その日の幕間（例：昼のカツ丼）
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
