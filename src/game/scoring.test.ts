import { describe, expect, it } from 'vitest';
import { bonusTierForLength, scoreWord, summarizeScore } from './scoring';

describe('bonusTierForLength', () => {
  it('4文字以下はボーナスなし', () => {
    expect(bonusTierForLength(2)).toBe('none');
    expect(bonusTierForLength(4)).toBe('none');
  });
  it('5〜6文字はボーナス', () => {
    expect(bonusTierForLength(5)).toBe('bonus');
    expect(bonusTierForLength(6)).toBe('bonus');
  });
  it('7文字以上は大ボーナス', () => {
    expect(bonusTierForLength(7)).toBe('grand-bonus');
    expect(bonusTierForLength(8)).toBe('grand-bonus');
  });
});

describe('scoreWord', () => {
  it('文字数に応じた基礎点を計算する', () => {
    const result = scoreWord('ねこ');
    expect(result.length).toBe(2);
    expect(result.basePoints).toBe(20);
    expect(result.bonusTier).toBe('none');
    expect(result.totalPoints).toBe(20);
  });

  it('5文字以上でボーナス倍率がかかる', () => {
    const result = scoreWord('ひまわり');
    expect(result.length).toBe(4);
    expect(result.bonusTier).toBe('none');

    const bonusResult = scoreWord('たんぽぽばたけ');
    expect(bonusResult.length).toBe(7);
    expect(bonusResult.bonusTier).toBe('grand-bonus');
    expect(bonusResult.totalPoints).toBeGreaterThan(bonusResult.basePoints);
  });

  it('大ボーナスの倍率はボーナスより高い', () => {
    const bonus = scoreWord('あいうえお'); // 5文字
    const grand = scoreWord('あいうえおかき'); // 7文字
    const bonusRate = bonus.totalPoints / bonus.basePoints;
    const grandRate = grand.totalPoints / grand.basePoints;
    expect(grandRate).toBeGreaterThan(bonusRate);
  });
});

describe('summarizeScore', () => {
  it('合計点と単語数・ボーナス数を集計する', () => {
    const words = [scoreWord('ねこ'), scoreWord('あいうえお'), scoreWord('あいうえおかき')];
    const summary = summarizeScore(words);
    expect(summary.wordCount).toBe(3);
    expect(summary.bonusCount).toBe(1);
    expect(summary.grandBonusCount).toBe(1);
    expect(summary.totalScore).toBe(words.reduce((s, w) => s + w.totalPoints, 0));
  });

  it('空配列でも安全に集計できる', () => {
    const summary = summarizeScore([]);
    expect(summary.totalScore).toBe(0);
    expect(summary.wordCount).toBe(0);
  });
});
