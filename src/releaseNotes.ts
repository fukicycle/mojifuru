/** アップデート後の初回起動で表示するリリースノート。新しいバージョンを配列の先頭に追加していく */
export interface ReleaseNote {
  version: string;
  items: string[];
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
];
