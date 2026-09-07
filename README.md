# もじふる

上から降ってくるひらがな文字をタップして集め、制限時間内に単語を作ってスコアを競うWebゲーム。
バックエンドサーバーを持たず、React(フロントエンド)+ GitHub Pages(静的ホスティング)+ Firebase
Realtime Database(Anonymous Auth)のみで完結する構成のPoC実装です。

詳細な仕様は [`CLAUDE.md`](./CLAUDE.md) / [`mojifuru-design-doc.md`](./mojifuru-design-doc.md) を参照してください。

## セットアップ

```bash
npm install
```

### 辞書データの生成

判定用辞書(`public/dict.dawg`)と単語一覧(`public/wordlist.json`)はリポジトリに含まれていません。
ビルド前に一度だけ生成してください(Mozc辞書・JMdictのダウンロードにネットワーク接続が必要です)。

```bash
npm run fetch-dict   # scripts/.cache/ にソースデータをダウンロード(初回のみ)
npm run build-dict   # public/dict.dawg, public/wordlist.json を生成
```

### 開発サーバー

```bash
npm run dev
```

### テスト

```bash
npm run test
```

`src/game/` 以下の純粋関数(文字の降下ロジック・DAWG判定・得点計算)を中心にユニットテストしています。

### 本番ビルド

```bash
npm run build
```

## 対戦モード(任意)

対戦モード・全体ランキングを有効にするには Firebase プロジェクトが必要です。

1. Firebaseコンソールでプロジェクトを作成
2. Authentication > Sign-in method で「匿名」を有効化
3. Realtime Database を作成し、[`firebase.rules.json`](./firebase.rules.json) をルールとしてデプロイ
   (`firebase deploy --only database`、または Firebase CLI 未導入ならコンソールから手動で貼り付け)
4. `.env.example` を `.env.local` にコピーし、Firebaseの設定値を入力

Firebaseを設定しない場合でも「ひとりで遊ぶ」モードは通常どおり動作します。

## PWA対応

`vite-plugin-pwa`(generateSWモード)によりオフライン起動・ホーム画面追加に対応しています。

- アイコン一式(`public/pwa-192.png` / `pwa-512.png` / `apple-touch-icon.png` / `favicon-96.png`)は
  ブランドカラー(マゼンタ→オレンジ→アクアのグラデーション)+「も」の白抜き文字で、`public/favicon.svg`
  と同じデザインコンセプト。maskableアイコン(Androidの各種形状マスク)のセーフゾーンに収まるよう調整済み
- `npm run build` 時に `dist/sw.js` が生成され、JS/CSS/HTMLに加えて辞書データ(`dict.dawg` /
  `wordlist.json`)も事前キャッシュされるため、初回読み込み後はオフラインでも起動・プレイできます
- マニフェストの `start_url` / `scope` はビルド時に `vite.config.ts` の `base`(`/mojifuru/`)へ
  自動的に合わせて解決されます

## GitHub Pagesへのデプロイ

`vite.config.ts` の `base` はリポジトリ名 `mojifuru` を前提に `/mojifuru/` を設定しています。
`npm run build` で生成される `dist/` を GitHub Pages(gh-pagesブランチ、または Actions
によるPagesデプロイ)で配信してください。

## ディレクトリ構成

```
src/
├── game/          文字の降下・DAWG判定・得点計算(純粋関数)
├── firebase/      Firebase設定・ルーム同期・ランキング・未登録語収集
├── hooks/         useGameSession(上記の純粋関数をReactに配線するフック)
├── context/       辞書読み込み状態・プレイヤー名などのグローバル状態
└── components/    各画面(タイトル/ゲーム/結果/一覧/ランキング/ライセンス/対戦ルーム)

scripts/
├── fetchDictSources.ts   Mozc辞書・JMdictのダウンロード
├── buildDict.ts           フィルタ・クロスチェック・DAWG変換
└── dawgBuilder.ts         DAWG(Directed Acyclic Word Graph)構築アルゴリズム
```
