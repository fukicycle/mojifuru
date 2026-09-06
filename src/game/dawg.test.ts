import { describe, expect, it } from 'vitest';
import { buildDawg } from '../../scripts/dawgBuilder';
import { Dawg } from './dawg';

function makeDawg(words: string[]): Dawg {
  const sorted = [...new Set(words)].sort();
  return new Dawg(buildDawg(sorted));
}

describe('Dawg', () => {
  const dawg = makeDawg(['ねこ', 'いぬ', 'いぬごや', 'いす', 'ぬこ']);

  it('登録した単語をisWordで完全一致判定できる', () => {
    expect(dawg.isWord('ねこ')).toBe(true);
    expect(dawg.isWord('いぬ')).toBe(true);
    expect(dawg.isWord('いぬごや')).toBe(true);
  });

  it('未登録の単語はfalseを返す', () => {
    expect(dawg.isWord('たぬき')).toBe(false);
    expect(dawg.isWord('い')).toBe(false);
  });

  it('登録された単語の途中(接頭辞のみ)はisWordではfalse', () => {
    expect(dawg.isWord('いぬご')).toBe(false);
  });

  it('hasPrefixは接頭辞が存在すればtrueを返す(単語自体が終端でなくても良い)', () => {
    expect(dawg.hasPrefix('いぬ')).toBe(true);
    expect(dawg.hasPrefix('いぬご')).toBe(true);
    expect(dawg.hasPrefix('いぬごや')).toBe(true);
  });

  it('存在しない接頭辞にはhasPrefixもfalseを返す', () => {
    expect(dawg.hasPrefix('うさ')).toBe(false);
  });

  it('接尾辞を共有する単語同士で状態が最小化される', () => {
    // 'ねこ' と 'ぬこ' は末尾 'こ' を共有するため、
    // 素朴なtrieより状態数が少なくなっているはず。
    const data = buildDawg(['ねこ', 'ぬこ'].sort());
    // ルート + (ね|ぬ) + 共有される「こ」状態 + 終端 = 4状態程度に収まる
    expect(data.states.length).toBeLessThanOrEqual(5);
  });
});
