import { describe, expect, it } from 'vitest';
import { buildDawg } from '../../scripts/dawgBuilder';
import { Dawg } from './dawg';
import { canStillFormWord, validateWord } from './wordValidator';

const dawg = new Dawg(buildDawg(['ねこ', 'いぬごや', 'ひまわり'].sort()));

describe('validateWord', () => {
  it('辞書にある単語はvalidとしてスコア付きで返す', () => {
    const result = validateWord(dawg, 'ねこ');
    expect(result.status).toBe('valid');
    expect(result.scored?.word).toBe('ねこ');
  });

  it('1文字はtoo-short', () => {
    expect(validateWord(dawg, 'あ').status).toBe('too-short');
  });

  it('9文字以上はtoo-long', () => {
    expect(validateWord(dawg, 'あ'.repeat(9)).status).toBe('too-long');
  });

  it('辞書にない単語はエラーではなくunregistered(0点・プレイ継続)', () => {
    const result = validateWord(dawg, 'たぬきち');
    expect(result.status).toBe('unregistered');
    expect(result.scored).toBeUndefined();
  });
});

describe('canStillFormWord', () => {
  it('単語の接頭辞ならtrue', () => {
    expect(canStillFormWord(dawg, 'いぬ')).toBe(true);
  });

  it('どの単語の接頭辞でもないならfalse', () => {
    expect(canStillFormWord(dawg, 'んん')).toBe(false);
  });

  it('空文字は常にtrue(まだ何も入力していない状態)', () => {
    expect(canStillFormWord(dawg, '')).toBe(true);
  });
});
