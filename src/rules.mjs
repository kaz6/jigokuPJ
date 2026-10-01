// 判定まわりの選び方（コード側）。文面はデータ側に置く。DOM には触れない。

export const FORMAT_VERSION = 1;

// 行き先：六道6つ＋差し戻し
export const REALMS = ['heaven', 'human', 'asura', 'animal', 'hungryGhost', 'hell'];
export const REMAND = 'remand';
export const DESTINATIONS = [...REALMS, REMAND];

// 評価：六道は proper / wrongful / lenient、差し戻しは retrial
export const REALM_VERDICTS = ['proper', 'wrongful', 'lenient'];
export const REMAND_VERDICTS = ['retrial'];

export const GAUGE_KEYS = ['kill', 'steal', 'sexual', 'lie', 'intoxicant'];
export const GAUGE_LEVELS = ['none', 'nearlyNone', 'light', 'lightToMedium', 'medium', 'heavy', 'extreme'];

export const WITNESS_TYPES = ['mosquito', 'human', 'pet', 'horse', 'pig', 'bird'];
export const CASE_KINDS = ['baseline', 'variant'];

// ある亡者をある行き先に送ったときの翌朝のニュースを一本に決める。
// 行き先ごとの上書きが最優先、なければその行き先の評価の既定ニュース。
// 決まらなければ null。
export function resolveNews(caseData, destination) {
  const override = caseData.news?.overrides?.[destination];
  if (override) return { text: override, from: `overrides.${destination}` };
  const verdict = caseData.verdicts?.[destination];
  const fallback = verdict && caseData.news?.defaults?.[verdict];
  if (fallback) return { text: fallback, from: `defaults.${verdict}` };
  return null;
}
