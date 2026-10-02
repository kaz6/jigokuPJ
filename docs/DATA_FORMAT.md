# DATA_FORMAT（formatVersion 3）

> 版の履歴：1＝JG-001。2＝JG-001b（上流の報告を王ごとの欄に／証人に正体・群れ／書き手用の注記／「ニュースなし」の印／差し戻しの評価に proper／幕間データ）。JG-001c（2026-10-01）は版を上げていない：幕間の話し手に `jailer`、タイミングに `afterVerdict` を足しただけで、既存のデータはそのまま読める（R-015）。3＝JG-001d（2026-10-02）：上流の報告の `unsorted` を廃止／幕間の話し手と timing を必須（null は失敗）／件の種類に `mourning`（弔い）／行き先に `jizo`（地蔵へ）。JG-001e（2026-10-03）は版を上げていない：一件の台本に篁の語り `narration` を足し、弔いの件では弁明と8問の答えを書かなくした。弔いの件のデータはまだ一件もなく、既存のデータはそのまま読める（R-019）。DECISION_LOG の D-037・D-040・D-044・D-045・D-047・R-006〜 を参照

> データ形式の説明。**一件の台本の形式と判決の記録の形式は不可逆の芯**（ARCHITECTURE_PRINCIPLES 参照）。勝手に変えない。変えるときは formatVersion を上げ、DECISION_LOG に記録する。
> 選び方（「この評価ならこのニュース」）はコード側（`src/rules.mjs`）、文面はデータ側。条件式を JSON に書かない。

## ファイル一覧

| パス | 中身 |
|---|---|
| `data/questions.json` | 共通の質問8問 |
| `data/params.json` | 調整する数値 |
| `data/cases/<id>.json` | 一件の台本（亡者ひとりぶん）。ファイル名＝id |
| `data/interludes.json` | 幕間（アドベンチャーパートの短い場面） |

すべてのファイルの最上位に `"formatVersion": 3` を持つ。

## 共通の値（コード側の定数 `src/rules.mjs`）

### 行き先（8つ）
| id | 意味 |
|---|---|
| `heaven` | 天道 |
| `human` | 人道 |
| `asura` | 修羅道 |
| `animal` | 畜生道 |
| `hungryGhost` | 餓鬼道 |
| `hell` | 地獄道 |
| `remand` | 差し戻し（常に机にある印） |
| `jizo` | 地蔵へ（弔いの件だけに出る特殊裁定欄。エンマは裁かず地蔵菩薩に託す） |

どの件でどの行き先を選べるかは件の種類で決まる（コード側 `selectableDestinations`。下の「件の種類」）。

### 評価
| 値 | 意味 | 使える行き先 |
|---|---|---|
| `proper` | 妥当 | 六道 |
| `wrongful` | 冤罪（重すぎる） | 六道 |
| `lenient` | 見逃し（軽すぎる） | 六道 |
| `retrial` | 翌日に再審（誤った差し戻し） | 差し戻し |
| `proper` | 妥当 | 差し戻しにも使える（水木のような「差し戻しだけが妥当」の件） |
| `proper` | 妥当 | 地蔵へ（これだけ。R-017） |

評価はプレイヤーに見せない（作者裁定）。翌朝のニュースの味を決めるためだけに使う。

### 件の種類（`kind`）と、種類で決まる振る舞い
振る舞いは JSON に書かず、コード側（`src/rules.mjs`）が種類から決める（D-045）。

| id | 意味 | 選べる行き先 | 線香 | ニュース | 質問 | 答えと弁明 | 篁の語り |
|---|---|---|---|---|---|---|---|
| `baseline` | 平常の亡者（ベースライン用） | 六道＋差し戻し | 減る | 出す | 一日の回数の内で | 台本の `answers`・`plea` | 出さない |
| `variant` | 変わり種 | 六道＋差し戻し | 減る | 出す | 一日の回数の内で | 台本の `answers`・`plea` | 出さない |
| `mourning` | 弔い（水子など） | 地蔵へ だけ | 減らさない | 出さない | **2回まで**。一日の回数から引かない | すべて「あー」（コード側の定数） | 2回目の質問のあと（台本の `narration`） |

- 通常の件（`baseline`／`variant`）で「地蔵へ」は選べない。弔いの件で六道・差し戻しは選べない。コード（`assertSelectable`・`makeVerdictRecord`・`resolveNews` が例外を出す）と check-data の両方で保証する
- 強制判決のランダム送りも、選べる行き先の中から選ぶ（弔いの件なら「地蔵へ」だけ）
- 質問の流れ（D-047）：`askQuestion` が答え・一日の回数から引く数・その質問のあとに出す篁の語りを返す。弔いの件の3回目は例外（同じ質問の聞き直しも1回に数える）。「あー」（`MOURNING_UTTERANCE`）と上限2（`MOURNING_QUESTION_LIMIT`）はコード側の定数で、台本には書かない（R-021）
- 弔いの件の台本で必須にするもの：観察・上流の報告・証人（先祖1人）・篁の語り。弁明と8問の答えは書かない（書けば失敗）。計器・真相・注記・評価は通常の件と同じく必須（R-022）

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

### 上流の王（4人。画面左の4アイコン）
| id | 王 | 主な報告 |
|---|---|---|
| `shinko` | 秦広王（初七日） | 殺生 |
| `shoko` | 初江王（二七日） | 衣領樹（三途の川）・盗み |
| `sotei` | 宋帝王（三七日） | 邪淫 |
| `gokan` | 五官王（四七日） | 業秤（妄語・飲酒と総量） |

- 「主な報告」は Notion その10 の下調べと上流の報告の叩き台（D-040）から。王ごとに担当の戒を見せる画面案は未裁定（JG-002 で試す）
- 獄吏がエンマの前まで連れてくるのは毎回同じなので、「案内人」はデータに持たない。三途の川の案内が普通でない件（社長など）だけ、初江王の欄に書く（D-040）

### 幕間の出るタイミング
| id | 意味 |
|---|---|
| `nextMorning` | 翌朝 |
| `noon` | その日の昼 |
| `afterVerdict` | その件の判決の直後（行き先に関係なく） |

### 幕間の話し手
| id | 意味 |
|---|---|
| `takamura` | 小野篁 |
| `enma` | エンマ |
| `case` | その幕間の対象の亡者（`caseId`） |
| `jailer` | 獄吏（声だけ） |
| `direction` | ト書き（台詞ではない地の文） |

話し手と出るタイミングは**必須**。`null` や上の表にない値は check-data が失敗にする（D-044）

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
  "formatVersion": 3,
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
{ "formatVersion": 3,
  "params": { "questionsPerDay": { "value": 30, "unit": "回", "provisional": false, "note": "…" } } }
```
- `provisional: true` は仮の値（check-data が注意として出す）
- 時間は秒で持つ（3分 → 180）

## 一件の台本（data/cases/<id>.json）

```json
{
  "formatVersion": 3,
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
  "upstream": {
    "shinko": ["（欄外）※本人ノ手ニヨルモノノミ計上"],
    "shoko": ["衣領樹の枝はほとんどしならない"],
    "sotei": [], "gokan": []
  },
  "observation": "爪がきれいじゃのう。…",
  "plea": "虫一匹、この手で殺したことのない人間です",
  "witnesses": [
    { "type": "mosquito", "identity": "蚊", "swarm": true, "lines": ["コイツジャナイ　ヤッタノハ　オテツダイ"] }
  ],
  "answers": { "kimono": "…", "rokumon": "…", "wealth": "…", "beloved": "…",
               "lastMeal": "…", "creatures": "…", "record": "…", "memorial": "…" },
  "truth": ["嘘はついていない。…"],
  "writerNotes": { "notOnGauges": [], "misc": [] },
  "verdicts": { "heaven": "lenient", "human": "lenient", "asura": "lenient",
                "animal": "proper", "hungryGhost": "proper", "hell": "wrongful", "remand": "retrial" },
  "news": {
    "defaults": { "proper": "…", "wrongful": "…", "lenient": "…" },
    "overrides": { "animal": "…", "heaven": { "none": true } }
  }
}
```

| 項目 | 型 | 説明 |
|---|---|---|
| `id` | string | 安定した id（ローマ字のスラッグ）。判決の記録が参照する。**一度付けたら変えない** |
| `name` | string | 作中の通称 |
| `kind` | `baseline` / `variant` / `mourning` | 平常の亡者（ベースライン用）／変わり種／弔い。振る舞いは上の「件の種類」 |
| `gauges` | object | 五戒の5欄すべて必須。`level`（上の段階 or `null`）＋`note`（短い注記。なければ空文字） |
| `upstream` | object | 上流の報告。王ごとの欄 `shinko`／`shoko`／`sotei`／`gokan`（各 string[]）。4欄すべて必須、記載がなければ空配列。ほかの欄（旧 `unsorted` など）は失敗。上流の報告の文はすべて、どれかの王に入れる（D-044） |
| `observation` | string | エンマの観察（見た目）。**正確な情報**として扱う |
| `plea` | string | 亡者の弁明。嘘かもしれない。**弔いの件では書かない**（「あー」をコード側が出す） |
| `witnesses` | object[] | 証人の火の玉。`type`（伝え方の型）＋`identity`（正体：猫・メダカなど。**画面に出さない内部用**）＋`swarm`（群れなら true）＋`lines`（台詞。1つ以上）。すべて必須。**弔いの件は1人だけで、`type: "human"`・`identity: "先祖"`**（R-020） |
| `answers` | object | 質問 id → 答え。**8問すべて必須**。**弔いの件では書かない**（「あー」をコード側が出す） |
| `narration` | object[] | 篁の語り。`{ speaker, text }` の並び（1行以上）。話し手は `takamura` だけ。**弔いの件では必須、ほかの件では書かない**。出すタイミング（弔いの件は2回目の質問のあと）はコード側が決める（R-020） |
| `truth` | string[] | 真相（プレイヤーには直接見せない） |
| `writerNotes.notOnGauges` | string[] | 書き手用：計器に出ないもの（五戒に入らないので数えられない悪さ）。画面に出さない |
| `writerNotes.misc` | string[] | 書き手用：そのほかの注記（演出・作者向けの注記など）。画面に出さない |
| `verdicts` | object | **その件で選べる行き先すべてに必須**、選べない行き先は書かない。通常の件：六道（proper/wrongful/lenient）＋差し戻し（retrial/proper）の7つ。弔いの件：`{ "jizo": "proper" }` だけ（R-017） |
| `news.defaults` | object | 評価 → 既定のニュース（最大3本）。値は文面か「ニュースなし」の印。弔いの件は空 `{}`（R-017） |
| `news.overrides` | object | 行き先 → そのニュースで上書き。値は文面か「ニュースなし」の印。選べない行き先には書かない。弔いの件は空 `{}` |

### 弔いの件の台本（`kind: "mourning"`）
通常の件との違いだけ。文面は仮。

```json
{
  "kind": "mourning",
  "observation": "…",
  "upstream": { "shinko": ["…"], "shoko": ["…"], "sotei": [], "gokan": ["…"] },
  "witnesses": [ { "type": "human", "identity": "先祖", "swarm": false, "lines": ["…"] } ],
  "narration": [ { "speaker": "takamura", "text": "この方は……" } ],
  "verdicts": { "jizo": "proper" },
  "news": { "defaults": {}, "overrides": {} }
}
```
- `plea` と `answers` は書かない。計器・真相・注記は通常の件と同じく書く

### 「ニュースなし」の印
- わざと何も起きない結果は `{ "none": true }` と書く。`defaults` のどの評価にも、`overrides` のどの行き先にも置ける（妥当専用にしない）
- 空文字 `""`・`null`・ほかの値は**書き忘れ**として check-data が失敗にする。項目そのものがなく、ニュースが決まらない行き先も失敗
- 注意（Notion その9）：印が特定の評価に偏ると、静けさが答え合わせになる。どの評価でも起こりうるように使う

### ニュースの選び方（コード側 `resolveNews`）
1. `news.overrides[行き先]` があればそれ（文面、または「ニュースなし」）
2. なければ `news.defaults[verdicts[行き先]]`。ただし**差し戻しは 2 を見ない**（評価の既定は六道に送った結果の文面なので流用しない）
3. どちらもなければ「決まらない」。六道ならデータの不備（check-data が失敗にする）。差し戻しは翌朝の幕間で受けるので、決まらなくてよい
- 弔いの件は 1〜3 を見ず、常に「ニュースなし」（`{ none: true, from: "kind.mourning" }`）
- その件で選べない行き先を渡すと例外

## 幕間（data/interludes.json）

```json
{
  "formatVersion": 3,
  "interludes": [
    { "id": "remand-default", "timing": "nextMorning", "caseId": null, "provisional": false,
      "lines": [ { "speaker": "takamura", "text": "昨日の方が、また並んでおられます" } ] }
  ]
}
```

| 項目 | 型 | 説明 |
|---|---|---|
| `id` | string | 安定した id。コード（`src/rules.mjs`）が名指しする。**一度付けたら変えない** |
| `timing` | string | 出るタイミング（上の表）。必須（`null` は失敗） |
| `caseId` | string / null | 対象の亡者の id。共通の幕間は `null` |
| `provisional` | boolean | 仮の文なら true（check-data は注意） |
| `lines` | object[] | 台詞の並び。`speaker`（上の表。必須、`null` は失敗）＋`text` |

### 幕間の出し方（コード側。JSON に条件は書かない）
- `interludesFor(判決の記録の並び, 台本)` が出す幕間 id を返す
- 差し戻し（評価 `retrial`）した件 → 翌日の朝に、件ごとの上書き（`REMAND_INTERLUDE_BY_CASE`）か、なければ共通の既定 `remand-default`
- 差し戻しが妥当（評価 `proper`）なら再審の幕間は出さない
- 判決に関係なく、その件を裁いた日に出す幕間（`CASE_INTERLUDES`）。例：家畜産業の人 → 昼のカツ丼／リンゴ屋 → 判決の直後に鏡の場面。日の中のどこで出すかは幕間の `timing`
- 出しどころ未定（`UNSCHEDULED_INTERLUDES`）：今はなし
- check-data は、コードが名指しする id がデータにあること、データの幕間がコードのどこかから出されることを見る

## 判決の記録（定義のみ。実装は JG-002）

一回の判決につき一つ。翌朝のニュース・翌日の再審・数日後のニュースはすべてこれを読む。

```json
{
  "formatVersion": 3,
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
| `destination` | string | 行き先 id（8つのどれか。ただしその件で選べるものだけ。弔いの件は `jizo`） |
| `forced` | boolean | 線香が燃え尽きたあとの強制判決だったか |
| `random` | boolean | 強制判決で1分を過ぎ、ランダムに送られたか（`true` なら `forced` も `true`） |

- 記録には評価もニュースも入れない。どちらも台本（`caseId`）と行き先から引ける
- 差し戻し（`remand`）された亡者は、翌日に同じ `caseId` で二つ目の記録ができる
- 記録はコード側の `makeVerdictRecord` で作る。その件で選べない行き先や、強制判決でないランダム送りは例外になる

## Notion の台本のうち、formatVersion 1 で入らなかった記述の行き先

formatVersion 1 では JSON に入れていなかった記述を、2 で次のように入れた（文言は Notion の写し。手直ししていない）。

| 亡者 | 記述 | 2 での置き場 |
|---|---|---|
| 瀬戸物屋の隠居 | 証人は「ペット＝猫。先に死んでいる」 | `witnesses[0].identity`＝猫。全文は `writerNotes.misc` |
| 元営業マン | 証人は「擦り寄るつもりの火の玉（ペット＝メダカ。口をぱくぱくさせて寄ってくる）」 | `witnesses[0].identity`＝メダカ。全文は `writerNotes.misc` |
| 家畜産業の人 | 証人は「火の玉の群れ」 | `witnesses[0].swarm`＝true |
| 家畜産業の人 | 幕間のオチ「その日の昼、エンマの机にカツ丼」 | `data/interludes.json` の `katsudon-chikusan` |
| 競馬場の主 | 計器に出ないもの「客の破産・一家離散。…」 | `writerNotes.notOnGauges` |
| 競馬場の主 | エンマの観察の注記「（エンマは常連客）」 | `writerNotes.misc` |
| リンゴ屋 | 計器に出ないもの「部下を怒鳴ったこと。…」 | `writerNotes.notOnGauges` |
| リンゴ屋 | 弁明の演出「聞いているうちに法廷がプレゼン会場になる」 | `writerNotes.misc` |
| リンゴ屋 | 鏡の場面（幕間） | `data/interludes.json` の `mirror-ringoya`（判決の直後。D-040） |
| 元営業マン | 差し戻し（翌朝の幕間）「昨日の営業の方、また並んでます」「慣れたもんじゃろ。」 | `news.overrides.remand` から `data/interludes.json` の `remand-moto-eigyoman` へ移した。話し手は獄吏（声だけ）とエンマ（D-040） |
| 瀬戸物屋の隠居 | 差し戻しのニュース「差し戻された隠居、窓口に再び並ぶ…」 | ニュースから外し、作者裁定の文で `data/interludes.json` の `remand-inkyo-setomonoya` に（D-040） |
| 全件 | 「書いてみて分かったこと」「見どころ」「懸念」 | 入れない。設計メモとして Notion に残す |
