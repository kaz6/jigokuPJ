# CLAUDE.md（jigokuPJ）

企画「地獄極楽六道縁途（エンド） 〜新米閻魔と割れた浄玻璃〜」のモック用リポジトリ。

## 正本は Notion。docs/ はミラー
- 企画ページ（作者裁定・台本の正本）：https://app.notion.com/p/3e6a8a5dfd458108821ed0030dd778af
- 設計原則（末尾の「判定：地獄極楽六道縁途」節）：https://app.notion.com/p/3a2a8a5dfd4581a6a47afb422b7efe94
- docs/ARCHITECTURE_PRINCIPLES.md・docs/DECISION_LOG.md は上のミラー。食い違ったら Notion が正しい
- data/ の台本の文言も Notion の写し。文言の手直しはしない

## 判断は持ち込まず、報告する
- 企画上の判断（行き先の評価、ニュースの文面、台本の中身、未確定項目の答え）はしない。迷ったら作業を止めずに、どこで何に迷ったかを報告する
- Notion を読めないときは、作業を始めずに止まって報告する
- 実装上の判断をしたら docs/DECISION_LOG.md の末尾（R-xxx）に、何を／なぜ／却下した案と理由 を残す。作者の確認待ちとして扱う
- 作業の区切りで docs/SESSION_STATE.md（現在の進捗／次にやること／未確定項目）を更新する

## 不可逆の芯（勝手に変えない）
- 一件の台本の形式と、判決の記録の形式（docs/DATA_FORMAT.md）。変えるなら formatVersion を上げ、DECISION_LOG に記録する
- データの id（一件の id、質問 id、行き先 id）は一度付けたら変えない
- 条件式を JSON に持ち込まない。「この評価ならこのニュース」の選び方はコード（src/rules.mjs）、文面はデータ

## 作り
- 判定のロジックは DOM に触れない（Node 単体で動く）。画面は状態を読むだけ
- 数値は data/params.json に出す。乱数はシードを固定できる作りにする
- データを触ったら `npm run check-data` を回す

## タスク番号
JG-xxx（JG-001：立ち上げ、JG-002：最小の HTML モック）
