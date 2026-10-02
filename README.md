# jigokuPJ

「地獄極楽六道縁途（エンド） 〜新米閻魔と割れた浄玻璃〜」のモック用リポジトリ。

- `docs/` 設計原則・決定記録・データ形式・進捗（正本は Notion。CLAUDE.md 参照）
- `data/` 質問・数値・一件の台本・幕間
- `src/rules.mjs` 判定まわりの選び方（DOM なし）
- `src/day.mjs` 一日の進行（線香・強制判決・幕間の順番。DOM なし）／`src/rng.mjs` シード固定の乱数
- `mock/` モックの画面。`npm run build` で `dist/jigoku-mock.html`（HTML 一枚）に組む
- 公開：https://kaz6.github.io/jigokuPJ/ （main へのマージで自動更新）
- `scripts/check-data.mjs` データ検査：`npm run check-data`
- `scripts/check-day.mjs` 一日の進行の検査：`npm run check-day`
