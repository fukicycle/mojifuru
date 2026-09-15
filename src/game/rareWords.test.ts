import { describe, expect, it } from 'vitest';
import { isRareWord } from './rareWords';

describe('isRareWord', () => {
  it('濁点をふくむ単語はレア', () => {
    expect(isRareWord('かばん')).toBe(true);
    expect(isRareWord('ざぶとん')).toBe(true);
    expect(isRareWord('ふでばこ')).toBe(true);
  });

  it('半濁点をふくむ単語もレア', () => {
    expect(isRareWord('たんぽぽ')).toBe(true);
  });

  it('濁点のない単語はレアではない', () => {
    expect(isRareWord('ねこ')).toBe(false);
    expect(isRareWord('ひまわり')).toBe(false);
  });

  it('小さい文字・長音だけではレアにならない', () => {
    expect(isRareWord('きょうしつ')).toBe(false);
    expect(isRareWord('がっこう')).toBe(true);
  });
});
