# CLAUDE.md

このファイルはClaude Codeがこのリポジトリで作業する際のガイドです。初期の設計背景は `mojifuru-design-doc.md`、セットアップ手順は `README.md` を参照してください(このファイルには実装済みの現状と、変更してはいけない決定事項をまとめています)。

## プロジェクト概要

**もじふる**(全編ひらがな表記、漢字は使わない)は、上から降ってくるひらがな文字をタップして集め、制限時間内に単語を作ってスコアを競うWebゲーム。バックエンドサーバーは持たず、以下の構成で完結する。

- フロントエンド:React 19 + TypeScript + Vite 8(ルーティングは react-router-dom 7)
- ホスティング:GitHub Pages(`.github/workflows/deploy.yml` によるActionsデプロイ、`base: '/mojifuru/'`)
- リアルタイム同期・データ永続化:Firebase Realtime Database(Anonymous Auth)。**任意**で、未設定でも「ひとりで遊ぶ」は動作する
- PWA:`vite-plugin-pwa`(generateSW / `registerType: 'prompt'`)。辞書データも事前キャッシュしオフライン起動可能
- テスト:Vitest(jsdom)、Lint:oxlint
- サーバーサイドロジックは一切持たない(Cloud Functions等も使わない)

## 現在のステータス

**実装ほぼ完了**(`package.json` の version が現行リリース。ホーム画面フッターに `__APP_VERSION__` として表示される)。ソロプレイ・対戦モード・3種ランキング・単語一覧・ライセンス表記・効果音・PWA・自動デプロイまで動作している。以降の作業は既存実装の調整・バグ修正が中心。

## 技術的な絶対制約

- **バックエンドサーバーなし**。単語判定・得点計算などはすべてクライアント側の純粋関数で完結させること
- **辞書ファイルは静的アセット**として `public/` に同梱する(外部APIへの都度問い合わせはしない)。生成物 `public/dict.dawg` / `public/wordlist.json` は**リポジトリにコミット済み**(CIは既にある場合ビルドをスキップする)
- 対戦モードの同期はFirebase RTDBのみ(WebSocketサーバー等は構築しない)
- **効果音に音声ファイルは使わない**。Web Audio APIのオシレーターで合成する(`src/audio/sfx.ts`)。静的ホスティングとライセンス表記の都合による決定

## ディレクトリ構成

```
mojifuru/
├── src/
│   ├── game/                      # 純粋関数レイヤ(テストはこの層に集中させる)
│   │   ├── fallingLetters.ts      # 文字の生成・降下(シード付きrng・決定的)
│   │   ├── dawg.ts                # DAWGのランタイム表現と読み込み
│   │   ├── wordValidator.ts       # DAWG検索による単語判定
│   │   ├── scoring.ts             # 得点計算(指数カーブ + ダウンコンボ)
│   │   ├── nameGenerator.ts       # デフォルトプレイヤー名の生成
│   │   └── *.test.ts              # 各モジュールに隣接して配置
│   ├── firebase/
│   │   ├── config.ts              # 初期化・匿名認証・isFirebaseConfigured()
│   │   ├── room.ts                # ルーム作成/参加/開始/再戦/文字の排他取得
│   │   ├── leaderboard.ts         # スコア書き込み・取得(JST基準の期間キー)
│   │   └── wordCandidates.ts      # 未登録語の収集
│   ├── hooks/useGameSession.ts    # 上記の純粋関数をReactに配線するゲームループ
│   ├── context/GameContext.tsx    # 辞書読み込み状態・プレイヤー名・音設定・isPlaying
│   ├── audio/sfx.ts               # Web Audio合成の効果音
│   ├── workers/wordlistWorker.ts  # wordlist.jsonのfetch+parseをワーカーへ逃がす
│   ├── components/                # 各画面(下記ルート参照)
│   ├── index.css                  # 全画面分のスタイル(CSS変数でデザイントークン管理)
│   └── App.tsx
├── scripts/
│   ├── fetchDictSources.ts        # Mozc辞書・JMdictを scripts/.cache/ へ取得
│   ├── buildDict.ts               # フィルタ・クロスチェック・生成物出力
│   └── dawgBuilder.ts             # DAWG構築(最小化)アルゴリズム
├── public/                        # dict.dawg / wordlist.json / PWAアイコン / 404.html
├── .github/workflows/deploy.yml   # test → 辞書生成(必要時) → build → Pagesデプロイ
└── firebase.rules.json
```

## 画面構成(`src/App.tsx` のルート)

| パス | 画面 |
| --- | --- |
| `/` | タイトル(なまえ入力・ソロ開始・ルーム作成/参加・各種リンク・バージョン表示) |
| `/game` | ソロプレイ |
| `/result` | ソロの結果・ランキング送信 |
| `/leaderboard` | デイリー/マンスリー/全期間ランキング |
| `/wordlist` | 収録単語一覧(ワーカー経由で読み込み) |
| `/license` | ライセンス表記(**必須実装**) |
| `/room/:roomId` | 対戦ロビー(ルームコード共有・開始待ち) |
| `/room/:roomId/play` | 対戦プレイ |
| `/room/:roomId/result` | 対戦結果・再戦 |

`UpdateNotice` は全画面共通で、SW更新検知時に「今すぐ更新」を出す(プレイ中は `isPlaying` により表示を保留)。

## ゲームルールの仕様

- 降ってくる文字はひらがなのみ(漢字・カタカナは扱わない)。出現頻度は辞書内のかな頻度で重み付け(`DEFAULT_KANA_WEIGHTS`)
- 制限時間60秒。落下時間 `FALL_DURATION_MS = 6500`、出現間隔 `SPAWN_INTERVAL_MS = 650`
- 文字数2〜8文字の範囲で単語成立を判定する(`MIN_WORD_LENGTH` / `MAX_WORD_LENGTH`)
- 「つぎ」に降ってくる文字を3つ先読み表示する(`peekUpcomingChars` はrngを複製するため降下の決定性に影響しない)
- 辞書にない単語は「エラー」ではなく「未登録・0点」として処理し、プレイを止めない
- 未登録単語は `/wordCandidates/{word}` (RTDB) に収集し、後から辞書を育てる運用にする

### 得点(`src/game/scoring.ts`)

- 基礎点は**指数カーブ**:2文字=10点を基準に、1文字増えるごとに `GROWTH_RATE = 1.7` 倍
- **ダウンコンボ**:2〜3文字の短い単語を連発すると倍率が `0.75` ずつ減衰(下限 `0.25`)。4文字以上を挟むとリセット。「短い単語を連打するだけ」が最適戦略にならないようにするための仕組みで、**「短い単語を複数作ると加点」ではない**
- 5文字以上で `bonus`、7文字以上で `grand-bonus`(演出・集計に使う段階)
- 収集中の単語欄は文字数に応じて配色が変わり、ボーナスまでの距離を色で伝える

## 辞書データ

- 主データ:Mozc辞書(BSDライセンス)から読み・単語・品詞を抽出
- 補助データ:JMdict(CC BY-SA, jmdict-simplified 経由)でクロスチェックし、Mozc側に紛れる固有名詞・ブランド名・キャラクター名を除外
- 抽出対象:名詞(一般・サ変接続・形容動詞語幹・副詞可能)、形容詞・動詞の基本形(固有名詞・数詞・代名詞・専門用語は除外)
- 生成物2種(`npm run fetch-dict` → `npm run build-dict`):
  - 判定用:`public/dict.dawg`(**中身はJSON**。`{ start, states: { final, trans }[] }` 形式で、拡張子が `.dawg` なだけのテキスト。バイナリ形式ではない点に注意)
  - 一覧表示用:`public/wordlist.json`(`{word, kana, length}[]`)
- ライセンス表記ページ(`/license`)は必須。出典・ライセンス・改変内容を明記すること(`src/components/LicensePage.tsx`)

## RTDBスキーマ

```
/leaderboard
  ├─ allTime/{uid}: { name, bestScore, updatedAt }
  ├─ daily/{yyyy-mm-dd}/{uid}: { name, bestScore, updatedAt }
  └─ monthly/{yyyy-mm}/{uid}: { name, bestScore, updatedAt }

/rooms/{roomId}
  ├─ seed: <number>                 # 再戦のたびに更新
  ├─ startAt: <serverTimestamp|null>
  ├─ duration: 60
  ├─ playerCountAtStart: <number>   # ラウンド開始時に固定。文字の同時出現数のスケールに使う
  ├─ players/{uid}: { name, score, wordsFormed?: string[] }  # RTDBは空配列を保持しないためwordsFormedは省略されうる
  └─ takenLetters/{letterId}: uid

/wordCandidates/{word}: { count, firstSeenAt }
```

- ランキングはデイリー・マンスリー・全期間の3種類。日付/月の境界はJST(UTC+9)固定で計算する(タイムゾーンライブラリは使わない)
- 各期間ごとに独立して「自己ベストのみ更新」を行う(古いノードの掃除はバックエンドがないため行わない)
- 全員が退出して `players` が空になったら、購読中のクライアントがルームごと削除する。タブを閉じた場合は `onDisconnect` で自分のエントリが消える

## 対戦モードの同期方針(重要)

- 文字そのものは同期しない。**seedを共有して各端末が同じ乱数列から同じ降下パターンを再現**する。そのため `fallingLetters.ts` は `Date.now()` や副作用を内部で持たず、`elapsedMs` と `rng` だけで状態が決まる純粋関数でなければならない
- 対戦時の経過時間は `Date.now() - startAt`(サーバータイムスタンプ起点)で計算する
- seed が Firebase から届く前にrngを作ってしまうと降下パターンが端末ごとにズレる。`useGameSession` はtickエフェクト側でrng・idPrefixを遅延生成することでこれを防いでいる(過去の実バグ)
- 再戦時は `idPrefix` にラウンド識別子を付け、前ラウンドの `takenLetters` とid衝突しないようにする
- 参加人数に応じて1回のスポーンで降らせる文字数をスケールする(`lettersPerSpawn`、最大6)
- 文字の取得は `takenLetters` へのトランザクションによる早い者勝ち。失敗時は「ほかのプレイヤーが先にとりました」と明示する(無反応に見せない)

## セキュリティルールの必須要件(`firebase.rules.json`)

- ルート既定は `.read`/`.write` ともに false。個別に許可する
- `players/{uid}`:`auth.uid == $uid` のときのみ書き込み可。`score` は1回の増加量を200以下に制限(`MAX_SCORE_INCREMENT_PER_WORD` と同値に保つこと)
- `takenLetters/{letterId}`:`!data.exists()` のときのみ書き込み可(早い者勝ちの排他制御)。値は `auth.uid` に限定
- `leaderboard`:読み取りは公開、書き込みは本人のみ。`bestScore` は増加のみ、`updatedAt` は `now` のみ許可、`name` は20文字以内
- `updatedAt === now` の制約があるため、**自己ベスト未満のときに同じ値を書き戻すと permission denied になる**。`submitScore` はその場合トランザクションを中止(`undefined` を返す)し、UIでも「登録失敗」ではなく「自己ベストは◯点のまま」と伝える(過去の実バグ)

## デザイン仕様(確定事項・変更しないこと)

- 配色:パステル系3色(マゼンタ/オレンジ/アクア)を文字チップに割当。割当は文字コードのハッシュで決まる(同じ文字は常に同じ色)
- 文字チップ:丸型、ポップで親しみやすい印象(和風・落ち着いたトーンは不採用と決定済み)
- UIコピー:ひらがな中心の平易な文言(例:「この単語で確定」「ぜんぶクリア」)
- ボーナス表示バッジ:画面上部に常時表示、警告色系(黄〜アンバー)
- レイアウト:モバイルファースト。ゲームキャンバス最大幅420px(`--canvas-max-width`)、PCでは左右レターボックス。縦も900px上限だが、これは幅480px以上のときのみ適用(スマホ実機で上下に背景の段差が出るため)
- ページ全体のスクロールは禁止(`html`/`body` を `overflow: hidden`)。スクロールが必要な画面は内側のコンテナだけに `overflow-y: auto` を持たせる
- 操作は `click` ではなく `pointerdown` で確定させる(反応の遅さを避けるため)
- 開発者ツール対策:F12無効化などの強い制限は不採用。右クリック無効化のみ `App.tsx` で実施

## 明示的に不採用となった案(再検討不要)

- アプリ名の漢字表記(「文字降る」等) → 不採用、全編ひらがな「もじふる」で確定
- 和風テイストのビジュアルデザイン(青海波模様、朱色の印鑑ボタン等) → 試作したが不採用。ポップな方向に確定済み
- F12/開発者ツールの無効化 → 技術的に実効性がないため不採用
- 効果音の音声ファイル同梱 → Web Audio合成で代替(ライセンス表記・配信サイズの都合)
- **一時ストックスロット**(構成中の単語を保留する仕組み) → 導入せず。収集中の単語欄と「ぜんぶクリア」のみで完結させる

## 開発コマンド

```bash
npm run dev          # 開発サーバー
npm run test         # Vitest(src/game/ の純粋関数が中心)
npm run lint         # oxlint
npm run build        # tsc -b && vite build
npm run fetch-dict   # 辞書ソースを scripts/.cache/ へダウンロード(初回のみ)
npm run build-dict   # public/dict.dawg, public/wordlist.json を再生成
```

- リリース時は `package.json` の `version` を上げる(タイトル画面のフッターに表示され、更新の反映確認に使う)
- `main` へのpushで自動的にテスト→ビルド→GitHub Pagesデプロイが走る

## 実装しながら詰める項目(未確定)

- 降下速度・出現間隔のバランス(長い単語を作る猶予の確保)
- ダウンコンボの減衰率・下限のチューニング
- 文字出現頻度テーブル(`DEFAULT_KANA_WEIGHTS`)の再集計タイミング(辞書生成結果が大きく変わったとき)
- 対戦の人数スケール(`lettersPerSpawn`)の上限・カーブ
