/**
 * 得点計算(純粋関数)。
 *
 * 文字数ごとの基礎点は指数カーブ(1文字増えるごとに GROWTH_RATE 倍)にして、
 * 長い単語ほど跳ねるようにする。加えて、2〜3文字の短い単語を連発すると
 * 「ダウンコンボ」で得点が減衰していく(4文字以上を挟むとリセット)。
 * これにより「短い単語を適当に連打するだけ」が最適戦略にならないようにする。
 */

export type BonusTier = 'none' | 'bonus' | 'grand-bonus';

export const BONUS_MIN_LENGTH = 5;
export const GRAND_BONUS_MIN_LENGTH = 7;

/** 基礎点カーブの基準点(この文字数のとき BASE_POINTS になる) */
export const BASE_LENGTH = 2;
export const BASE_POINTS = 10;
/** 1文字増えるごとの基礎点の増加率 */
export const GROWTH_RATE = 1.7;

/** この文字数以下は「短い単語」としてダウンコンボの対象になる */
export const SHORT_WORD_MAX_LENGTH = 3;
/** 短い単語を連発するごとにかかる減衰率 */
export const DOWN_COMBO_DECAY = 0.75;
/** 減衰の下限(これ以上は下がらない) */
export const DOWN_COMBO_FLOOR = 0.25;

export interface ScoredWord {
  word: string;
  length: number;
  basePoints: number;
  bonusTier: BonusTier;
  /** ダウンコンボによる減衰倍率(1が通常、短い単語の連発で下がる) */
  comboMultiplier: number;
  totalPoints: number;
}

export function bonusTierForLength(length: number): BonusTier {
  if (length >= GRAND_BONUS_MIN_LENGTH) return 'grand-bonus';
  if (length >= BONUS_MIN_LENGTH) return 'bonus';
  return 'none';
}

function basePointsForLength(length: number): number {
  return Math.round(BASE_POINTS * GROWTH_RATE ** (length - BASE_LENGTH));
}

function comboMultiplierFor(length: number, precedingShortStreak: number): number {
  if (length > SHORT_WORD_MAX_LENGTH) return 1;
  return Math.max(DOWN_COMBO_FLOOR, DOWN_COMBO_DECAY ** precedingShortStreak);
}

/**
 * 直近の単語列の末尾から、何個連続で「短い単語」が続いているかを数える。
 * 次の単語のダウンコンボ倍率を決めるのに使う。
 */
export function countTrailingShortStreak(words: readonly { length: number }[]): number {
  let streak = 0;
  for (let i = words.length - 1; i >= 0; i -= 1) {
    if (words[i].length > SHORT_WORD_MAX_LENGTH) break;
    streak += 1;
  }
  return streak;
}

/**
 * 直近の単語列から、「次に短い単語(2〜3文字)を出したら何倍になるか」を返す。
 * 1が通常、短い単語の連発が続くほど下がる(下限DOWN_COMBO_FLOOR)。
 * ゲーム画面の背景演出(コンボダウンの可視化)に使う。
 */
export function currentComboMultiplier(words: readonly { length: number }[]): number {
  const streak = countTrailingShortStreak(words);
  return comboMultiplierFor(SHORT_WORD_MAX_LENGTH, streak);
}

/**
 * @param precedingShortStreak その単語の直前まで、短い単語が何連続で続いているか
 *   (countTrailingShortStreakで算出)。省略時は0(連続なし)として扱う。
 */
export function scoreWord(word: string, precedingShortStreak = 0): ScoredWord {
  const length = word.length;
  const basePoints = basePointsForLength(length);
  const bonusTier = bonusTierForLength(length);
  const comboMultiplier = comboMultiplierFor(length, precedingShortStreak);
  const totalPoints = Math.round(basePoints * comboMultiplier);
  return { word, length, basePoints, bonusTier, comboMultiplier, totalPoints };
}

export interface ScoreSummary {
  words: ScoredWord[];
  totalScore: number;
  wordCount: number;
  bonusCount: number;
  grandBonusCount: number;
}

export function summarizeScore(words: readonly ScoredWord[]): ScoreSummary {
  return {
    words: [...words],
    totalScore: words.reduce((sum, w) => sum + w.totalPoints, 0),
    wordCount: words.length,
    bonusCount: words.filter((w) => w.bonusTier === 'bonus').length,
    grandBonusCount: words.filter((w) => w.bonusTier === 'grand-bonus').length,
  };
}
