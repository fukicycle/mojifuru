/**
 * なまえ未設定時にプレフィルするデフォルト名を生成する(純粋関数)。
 * ポップで親しみやすい印象に合わせ、形容詞+生き物+数字の組み合わせにする。
 */

const ADJECTIVES = ['ふわふわ', 'きらきら', 'もこもこ', 'ぴかぴか', 'ほかほか', 'わくわく', 'にこにこ', 'のんびり'];
const CREATURES = ['うさぎ', 'ねこ', 'ぱんだ', 'ひよこ', 'くじら', 'りす', 'いぬ', 'かえる'];

export function generateDefaultName(random: () => number = Math.random): string {
  const adjective = ADJECTIVES[Math.floor(random() * ADJECTIVES.length)];
  const creature = CREATURES[Math.floor(random() * CREATURES.length)];
  const number = Math.floor(random() * 900) + 100;
  return `${adjective}${creature}${number}`;
}
