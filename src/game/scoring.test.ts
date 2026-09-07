import { describe, expect, it } from 'vitest';
import { countTrailingShortStreak, bonusTierForLength, scoreWord, summarizeScore } from './scoring';

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
  it('文字数に応じて基礎点が指数的に増える(連続なしなら等倍)', () => {
    expect(scoreWord('ねこ').totalPoints).toBe(10); // 2文字
    expect(scoreWord('つくえ').totalPoints).toBe(17); // 3文字
    expect(scoreWord('ひまわり').totalPoints).toBe(29); // 4文字
    expect(scoreWord('あいうえお').totalPoints).toBe(49); // 5文字
    expect(scoreWord('あいうえおかき').totalPoints).toBe(142); // 7文字
  });

  it('文字数が増えるほど基礎点の増加幅も大きくなる', () => {
    const four = scoreWord('ひまわり').basePoints;
    const five = scoreWord('あいうえお').basePoints;
    const seven = scoreWord('あいうえおかき').basePoints;
    expect(five - four).toBeGreaterThan(1);
    expect(seven).toBeGreaterThan(five * 2);
  });

  it('5文字以上はボーナス、7文字以上は大ボーナスのタグが付く', () => {
    expect(scoreWord('ひまわり').bonusTier).toBe('none'); // 4文字
    expect(scoreWord('あいうえお').bonusTier).toBe('bonus'); // 5文字
    expect(scoreWord('あいうえおかき').bonusTier).toBe('grand-bonus'); // 7文字
  });

  it('連続記録が0ならダウンコンボはかからない', () => {
    const result = scoreWord('ねこ', 0);
    expect(result.comboMultiplier).toBe(1);
    expect(result.totalPoints).toBe(result.basePoints);
  });

  it('短い単語(2〜3文字)を連発すると得点が減衰する', () => {
    const first = scoreWord('ねこ', 0);
    const second = scoreWord('いぬ', 1);
    const third = scoreWord('うし', 2);
    expect(second.totalPoints).toBeLessThan(first.totalPoints);
    expect(third.totalPoints).toBeLessThan(second.totalPoints);
  });

  it('ダウンコンボの減衰には下限がある', () => {
    const result = scoreWord('ねこ', 20);
    expect(result.comboMultiplier).toBe(0.25);
  });

  it('4文字以上の単語にはダウンコンボがかからない(連続していても等倍)', () => {
    const result = scoreWord('ひまわり', 5);
    expect(result.comboMultiplier).toBe(1);
    expect(result.totalPoints).toBe(result.basePoints);
  });
});

describe('countTrailingShortStreak', () => {
  it('末尾から短い単語(2〜3文字)が何連続続いているかを数える', () => {
    expect(countTrailingShortStreak([])).toBe(0);
    expect(countTrailingShortStreak([{ length: 2 }, { length: 3 }])).toBe(2);
  });

  it('4文字以上の単語を挟むとリセットされる', () => {
    const words = [{ length: 2 }, { length: 2 }, { length: 4 }, { length: 3 }];
    expect(countTrailingShortStreak(words)).toBe(1);
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
