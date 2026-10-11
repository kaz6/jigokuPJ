# 指示文の点検（jigokuPJ）

> 実施：2026-10-11 22:55 JST ／ HEAD `49946ad`（origin/main と一致、左右とも0）
> 道具：Claude Code 2.1.296 の同梱スキル `claude-api` の `prompt-audit`（`shared/prompt-audit.md` の手順）。手本は guild-log-mock の `docs/audit/2026-10-11-prompt-audit-diff.md`。
> 扱い：**事実の訂正だけ当てる**。書き方・強調・重複は、仕組みの棚卸しの①発火実績と②要否のあとに決める（作者の指示 2026-10-11）。

## 0. 前提

- 範囲：このリポジトリの指示文は `CLAUDE.md`（31行）だけ。スキル・サブエージェント・コマンド・AGENTS.md・規則ファイルは無い（`git ls-files` で確認）。`.claude/settings.json` は読んでいない。
- 対象モデル：Sonnet 5.5（`.claude/settings.json` の `model: sonnet` で、2026-10-11 からこのリポジトリのセッションが使う）。
- 企画の判断には触れない（`CLAUDE.md:12`）。Notion の企画ページは読めることを確認した（63,286文字）。

## 1. 実際に試したこと

| コマンド | 結果 |
|---|---|
| `npm run check-data` | すべて通過（注意2件＝仮の値）。**使い捨ての worktree で実行** |
| 「全部のデータを見ているか」 | `data/cases/*.json` は6件、`check-data` は `readdirSync` で6件すべてを読む。`questions.json`・`params.json`・`interludes.json` も読む。**穴なし** |
| 失敗時の終了コード | 件の台本が欠けたデータを渡すと exit 1、実データは exit 0。**穴なし** |
| `npm run check-day`／`npm run build` | 通過（53件／件6・幕間5）。ビルド後に `git status` が空＝コミット済みの `dist/jigoku-mock.html` と一致 |
| 参照先の存在 | `docs/ARCHITECTURE_PRINCIPLES.md`・`docs/DATA_FORMAT.md`・`docs/DECISION_LOG.md`・`docs/SESSION_STATE.md`・`src/rules.mjs`・`src/rng.mjs`・`data/params.json` すべてある |
| 引用された決定番号 | D-042（main に直接 push しない）・D-043（R-xxx の報告の仕方）・D-046（PR の運用）はいずれも DECISION_LOG にあり、書かれた内容と合っている |
| 「判定のロジックは DOM に触れない」 | `src/` に `document`・`window`・`localStorage`・`Math.random` は無い |

## 2. 指摘

| # | 場所 | 指摘 | 種別 | 確度 | 扱い |
|---|---|---|---|---|---|
| J1 | `CLAUDE.md:8` と `:14` | 8行目は `docs/DECISION_LOG.md` を Notion の「ミラー。食い違ったら Notion が正しい」とし、14行目は実装上の判断（R-xxx）を同じファイルの末尾に書かせる。R-xxx（R-001〜R-033）は実際にこのファイルにしか無い | 規則どうしの食い違い | 高 | **当てない**（どちらを正とするかは作者の裁定。下の質問Q1） |
| J2 | `CLAUDE.md:25-28` | 「作り」の節が `check-data` だけを挙げる。`package.json` には `check-day`・`build` もあり、公開の workflow（`.github/workflows/pages.yml`）は3つとも回す。`dist/` は追跡されている | 書き足し（記述が足りない） | 低 | **当てない**（訂正ではなく追記） |

事実の訂正（古いパス、実物と合わない件数や引数、動かないコマンド）は **0件**。

## 3. 当てたもの

なし。**CLAUDE.md は変えていない**（点検の記録だけを置く）。

## 4. 作者に聞くこと

- Q1（J1）：`docs/DECISION_LOG.md` は Notion のミラーか、R-xxx を書く正本か。実際の運用は「D-xxx は作者の裁定の記録、R-xxx はこのリポジトリだけにある」。
