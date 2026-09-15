/** アップデート後の初回起動で表示するリリースノート。新しいバージョンを配列の先頭に追加していく */
export interface ReleaseNote {
  version: string;
  items: string[];
}

function versionParts(version: string): number[] {
  return version.split('.').map((part) => Number.parseInt(part, 10) || 0);
}

/**
 * セマンティックバージョンの大小を比べる(a<b なら負、a>b なら正)。
 * 文字列比較では '0.9.10' < '0.9.9' になってしまうため、数値として桁ごとに比べる。
 */
export function compareVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * 「前回見たバージョン」より新しく、かつ現在のバージョン以下のノートを新しい順に返す。
 *
 * 1バージョンぶんしか出さないと、途中のバージョンを飛ばして更新した人
 * (例: 0.9.8 → 0.9.10)がその間の変更点を一度も見られないため、まとめて出す。
 * 初回インストール(lastSeenがnull)は「アップデート」ではないので何も返さない。
 */
export function notesSince(
  notes: readonly ReleaseNote[],
  lastSeenVersion: string | null,
  currentVersion: string,
): ReleaseNote[] {
  if (lastSeenVersion === null) return [];
  return notes
    .filter(
      (note) =>
        compareVersions(note.version, lastSeenVersion) > 0 &&
        compareVersions(note.version, currentVersion) <= 0,
    )
    .sort((a, b) => compareVersions(b.version, a.version));
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '0.9.6',
    items: [
      '「1文字消す」ボタンを追加。ひとつ前の文字だけ取り消せるようになりました',
      '確定ボタンとクリアボタンを左右に離して配置。よそ見タップでの誤クリアを防ぎます',
      '「1文字消す」を1秒以内に2回押すと、ぜんぶクリアになります(色と音でどちらの操作か分かります)',
    ],
  },
  {
    version: '0.9.8',
    items: [
      '軽微なバグ修正をしました。'
    ]
  },
  {
    version: '0.9.9',
    items: [
      'ルーム対戦に「せんせき」を追加。ラウンドごとの順位と、通算の勝ち数が見られます',
      '結果画面でなまえをタップすると、そのひとが作ったことばが開きます',
      'タイトル画面でルームコードを入れると、あとからそのルームのせんせきを見返せます',
    ],
  },
  {
    version: '0.9.10',
    items: [
      'タイトル画面に「さいきんのルーム」を追加。ルームコードを覚えていなくても、同じルームでまた集まれます',
      '一覧のルームからそのまま戦績を開けるようにしました',
      '解散したルームでも、同じルームコードで再開できるようにしました(戦績は引き継がれます)',
    ],
  },
  {
    version: '0.9.11',
    items: [
      'タイトル画面に「Googleでつづける」を追加。ランキングの自己ベストや戦績を、ほかの端末やブラウザにも引き継げます',
      'ログインしなくても、これまでどおり遊べます',
    ],
  },
  {
    version: '0.9.12',
    items: [
      'こうしんのお知らせで「わかった!」を押すと、ゲームがすぐに始まってしまう不具合を直しました',
    ],
  },
  {
    version: '0.9.13',
    items: [
      'iPhoneでホーム画面に追加して遊んだとき、画面の上や下にすきま・段差が出る不具合を直しました',
      'いちばん下のボタンが、画面下のホームインジケーター(よこ棒)と重ならないようにしました',
    ],
  },
  {
    version: '0.9.14',
    items: [
      '対戦のけっか・せんせきで、何人ぶんでも同時にことばを開けるようにしました(ひとり開くとほかが閉じてしまう動きをやめました)',
      '「ぜんぶひらく」を追加。ラウンド全員のことばをまとめて開け閉めできます',
    ],
  },
];
