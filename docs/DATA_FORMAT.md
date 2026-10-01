# DATA_FORMAT（formatVersion 1）

> データ形式の説明。**一件の台本の形式と判決の記録の形式は不可逆の芯**（ARCHITECTURE_PRINCIPLES 参照）。勝手に変えない。変えるときは formatVersion を上げ、DECISION_LOG に記録する。
> 選び方（「この評価ならこのニュース」）はコード側（`src/rules.mjs`）、文面はデータ側。条件式を JSON に書かない。

## ファイル一覧

| パス | 中身 |
|---|---|
| `data/questions.json` | 共通の質問8問 |
| `data/params.json` | 調整する数値 |
| `data/cases/<id>.json` | 一件の台本（亡者ひとりぶん）。ファイル名＝id |

すべてのファイルの最上位に `"formatVersion": 1` を持つ。

## 共通の値（コード側の定数 `src/rules.mjs`）

### 行き先（7つ）
| id | 意味 |
|---|---|
| `heaven` | 天道 |
| `human` | 人道 |
| `asura` | 修羅道 |
| `animal` | 畜生道 |
| `hungryGhost` | 餓鬼道 |
| `hell` | 地獄道 |
| `remand` | 差し戻し（常に机にある印） |

### 評価
| 値 | 意味 | 使える行き先 |
|---|---|---|
| `proper` | 妥当 | 六道 |
| `wrongful` | 冤罪（重すぎる） | 六道 |
| `lenient` | 見逃し（軽すぎる） | 六道 |
| `retrial` | 翌日に再審（誤った差し戻し） | 差し戻し |

評価はプレイヤーに見せない（作者裁定）。翌朝のニュースの味を決めるためだけに使う。

### 計器の欄（五戒）
| id | 戒 |
|---|---|
| `kill` | 殺（不殺生） |
| `steal` | 盗（不偸盗） |
| `sexual` | 邪（不邪淫） |
| `lie` | 妄（不妄語） |
| `intoxicant` | 酒（不飲酒） |

### 計器の重さの段階（軽い順）
| 値 | Notion での書き方 |
|---|---|
| `none` | なし |
| `nearlyNone` | ほぼ空 |
| `light` | 軽 |
| `lightToMedium` | 軽〜中 |
| `medium` | 中 |
| `heavy` | 重い |
| `extreme` | 桁違い |
| `null` | 台本に段階の記載がない（注記だけある）。check-data は注意として出す |

### 証人の伝え方の型（6種で確定）
| id | 伝え方 |
|---|---|
| `mosquito` | 蚊：群れて文字を組む |
| `human` | 人：しゃべる |
| `pet` | ペット（犬・猫）：擦り寄る |
| `horse` | 馬：駆け回る |
| `pig` | 豚：鼻を押し付ける |
| `bird` | 鳥：高いところで輪を描いて旋回する |

## questions.json

```json
{
  "formatVersion": 1,
  "questions": [
    { "id": "record", "order": 7, "heading": "罪の記録",
      "text": "これらおぬしの罪の記録に、覚えのないものはあるか？",
      "targets": ["妄"], "origin": "…" }
  ]
}
```
- `id`：安定した id。一件の `answers` のキーになる。**変えない**
- `heading`：タグの見出し（短い）。`text`：聞いたときに出す全文
- `targets`：主に刺さる戒（企画ページの【】をそのまま）。`origin`：元にした原典・習俗（資料用）

## params.json

```json
{ "formatVersion": 1,
  "params": { "questionsPerDay": { "value": 30, "unit": "回", "provisional": false, "note": "…" } } }
```
- `provisional: true` は仮の値（check-data が注意として出す）
- 時間は秒で持つ（3分 → 180）

## 一件の台本（data/cases/<id>.json）

```json
{
  "formatVersion": 1,
  "id": "migatte",
  "name": "身勝手な人",
  "kind": "variant",
  "gauges": {
    "kill": { "level": "nearlyNone", "note": "本人の手によるものは0" },
    "steal": { "level": "light", "note": "" },
    "sexual": { "level": "none", "note": "" },
    "lie": { "level": "light", "note": "" },
    "intoxicant": { "level": "light", "note": "" }
  },
  "upstream": ["衣領樹の枝はほとんどしならない", "…"],
  "observation": "爪がきれいじゃのう。…",
  "plea": "虫一匹、この手で殺したことのない人間です",
  "witnesses": [ { "type": "mosquito", "lines": ["コイツジャナイ　ヤッタノハ　オテツダイ"] } ],
  "answers": { "kimono": "…", "rokumon": "…", "wealth": "…", "beloved": "…",
               "lastMeal": "…", "creatures": "…", "record": "…", "memorial": "…" },
  "truth": ["嘘はついていない。…"],
  "verdicts": { "heaven": "lenient", "human": "lenient", "asura": "lenient",
                "animal": "proper", "hungryGhost": "proper", "hell": "wrongful", "remand": "retrial" },
  "news": {
    "defaults": { "proper": "…", "wrongful": "…", "lenient": "…" },
    "overrides": { "hell": "…" }
  }
}
```

| 項目 | 型 | 説明 |
|---|---|---|
| `id` | string | 安定した id（ローマ字のスラッグ）。判決の記録が参照する。**一度付けたら変えない** |
| `name` | string | 作中の通称 |
| `kind` | `baseline` / `variant` | 平常の亡者（ベースライン用）／変わり種 |
| `gauges` | object | 五戒の5欄すべて必須。`level`（上の段階 or `null`）＋`note`（短い注記。なければ空文字） |
| `upstream` | string[] | 上流の王たちの報告（衣領樹・業秤・案内人など）。台本に記載がなければ空配列 |
| `observation` | string | エンマの観察（見た目）。**正確な情報**として扱う |
| `plea` | string | 亡者の弁明。嘘かもしれない |
| `witnesses` | object[] | 証人の火の玉。`type`（伝え方の型）＋`lines`（台詞。1つ以上） |
| `answers` | object | 質問 id → 答え。**8問すべて必須** |
| `truth` | string[] | 真相（プレイヤーには直接見せない） |
| `verdicts` | object | **7つの行き先すべて必須**。六道は proper/wrongful/lenient、差し戻しは retrial |
| `news.defaults` | object | 評価 → 既定のニュース（最大3本） |
| `news.overrides` | object | 行き先 → そのニュースで上書き |

### ニュースの選び方（コード側 `resolveNews`）
1. `news.overrides[行き先]` があればそれ
2. なければ `news.defaults[verdicts[行き先]]`
3. どちらもなければ「決まらない」＝データの不備（check-data が失敗にする）

## 判決の記録（定義のみ。実装は JG-002）

一回の判決につき一つ。翌朝のニュース・翌日の再審・数日後のニュースはすべてこれを読む。

```json
{
  "formatVersion": 1,
  "day": 1,
  "caseId": "migatte",
  "destination": "hungryGhost",
  "forced": false,
  "random": false
}
```

| 項目 | 型 | 説明 |
|---|---|---|
| `formatVersion` | number | この記録の形式の版 |
| `day` | number | 何日目の判決か（1始まり） |
| `caseId` | string | 一件の台本の `id` |
| `destination` | string | 行き先 id（7つのどれか） |
| `forced` | boolean | 線香が燃え尽きたあとの強制判決だったか |
| `random` | boolean | 強制判決で1分を過ぎ、ランダムに送られたか（`true` なら `forced` も `true`） |

- 記録には評価もニュースも入れない。どちらも台本（`caseId`）と行き先から引ける
- 差し戻し（`remand`）された亡者は、翌日に同じ `caseId` で二つ目の記録ができる

## Notion の台本のうち、この形式に入らなかった記述

形式は勝手に変えない方針なので、以下は JSON に入れていない（台本の文言は Notion の正本に残っている）。扱いは SESSION_STATE の未確定項目を参照。

| 亡者 | 記述 | 入らなかった理由 |
|---|---|---|
| 瀬戸物屋の隠居 | 証人は「ペット＝猫。先に死んでいる」 | `witnesses` は型＋台詞のみ。正体（猫）は持てない |
| 元営業マン | 証人は「擦り寄るつもりの火の玉（ペット＝メダカ。口をぱくぱくさせて寄ってくる）」 | 同上。メダカの動きは「擦り寄る」と違う |
| 家畜産業の人 | 証人は「火の玉の群れ」 | 群れかどうかを持つ欄がない（身勝手な人の豚は単体） |
| 家畜産業の人 | 幕間のオチ「その日の昼、エンマの机にカツ丼」 | 幕間は別データ（未定義） |
| 競馬場の主 | 計器に出ないもの「客の破産・一家離散。賭け事は五戒に入っていないので数えられない」 | 欄がない |
| 競馬場の主 | エンマの観察の注記「（エンマは常連客）」 | 観察の台詞ではなく作者向けの注記なので外した |
| リンゴ屋 | 計器に出ないもの「部下を怒鳴ったこと。悪口は五戒に入っていない」 | 欄がない |
| リンゴ屋 | 弁明の演出「聞いているうちに法廷がプレゼン会場になる」 | 弁明の台詞ではない |
| リンゴ屋 | 鏡の場面（幕間）「代わりの鏡を作りましょう…黒い板」 | 幕間は別データ（未定義） |
| 全件 | 「書いてみて分かったこと」「見どころ」「懸念」 | 設計メモ。Notion に残す |
