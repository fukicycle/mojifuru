/**
 * 得点計算(純粋関数)。
 * 短い単語を複数成立させる戦略、長い単語でボーナスを狙う戦略の両方が
 * 成立するように、文字数に応じた段階制ボーナスをかける。
 */

export type BonusTier = 'none' | 'bonus' | 'grand-bonus';

export const BONUS_MIN_LENGTH = 5;
export const GRAND_BONUS_MIN_LENGTH = 7;
export const BASE_POINTS_PER_CHAR = 10;
export const BONUS_MULTIPLIER = 1.5;
export const GRAND_BONUS_MULTIPLIER = 2.5;

export interface ScoredWord {
  word: string;
  length: number;
  basePoints: number;
  bonusTier: BonusTier;
  bonusPoints: number;
  totalPoints: number;
}

export function bonusTierForLength(length: number): BonusTier {
  if (length >= GRAND_BONUS_MIN_LENGTH) return 'grand-bonus';
  if (length >= BONUS_MIN_LENGTH) return 'bonus';
  return 'none';
}

function multiplierForTier(tier: BonusTier): number {
  switch (tier) {
    case 'grand-bonus':
      return GRAND_BONUS_MULTIPLIER;
    case 'bonus':
      return BONUS_MULTIPLIER;
    default:
      return 1;
  }
}

export function scoreWord(word: string): ScoredWord {
  const length = word.length;
  const basePoints = length * BASE_POINTS_PER_CHAR;
  const bonusTier = bonusTierForLength(length);
  const totalPoints = Math.round(basePoints * multiplierForTier(bonusTier));
  return { word, length, basePoints, bonusTier, bonusPoints: totalPoints - basePoints, totalPoints };
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
