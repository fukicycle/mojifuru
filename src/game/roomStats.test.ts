import { describe, expect, it } from 'vitest';
import { aggregatePlayerTotals, rankRoundPlayers, type RoundRecord } from './roomStats';

function round(id: string, players: RoundRecord['players']): RoundRecord {
  return { id, startedAt: Number(id.slice(1)), players };
}

describe('rankRoundPlayers', () => {
  it('得点の高い順に並べて順位を付ける', () => {
    const ranked = rankRoundPlayers({
      a: { name: 'あかり', score: 40 },
      b: { name: 'ぶんた', score: 120 },
      c: { name: 'ちひろ', score: 80 },
    });
    expect(ranked.map((p) => p.name)).toEqual(['ぶんた', 'ちひろ', 'あかり']);
    expect(ranked.map((p) => p.rank)).toEqual([1, 2, 3]);
  });

  it('同点は同じ順位になり、次の順位は飛ぶ', () => {
    const ranked = rankRoundPlayers({
      a: { name: 'あかり', score: 100 },
      b: { name: 'ぶんた', score: 100 },
      c: { name: 'ちひろ', score: 10 },
    });
    expect(ranked.map((p) => p.rank)).toEqual([1, 1, 3]);
  });

  it('成立単語を点数付きで復元する', () => {
    const ranked = rankRoundPlayers({ a: { name: 'あかり', score: 59, words: ['ねこ', 'ひまわり'] } });
    expect(ranked[0].words.map((w) => w.word)).toEqual(['ねこ', 'ひまわり']);
    expect(ranked[0].words[1].bonusTier).toBe('none');
    expect(ranked[0].words[0].totalPoints).toBeGreaterThan(0);
  });

  it('単語が1つもない・参加者がいない場合も安全に扱える', () => {
    expect(rankRoundPlayers(undefined)).toEqual([]);
    expect(rankRoundPlayers({ a: { name: 'あかり', score: 0 } })[0].words).toEqual([]);
  });

  it('なまえが空なら「ななしさん」にする', () => {
    expect(rankRoundPlayers({ a: { name: '', score: 0 } })[0].name).toBe('ななしさん');
  });
});

describe('aggregatePlayerTotals', () => {
  const rounds: RoundRecord[] = [
    round('r1', {
      a: { name: 'あかり', score: 120, words: ['ねこ', 'ひまわり'] },
      b: { name: 'ぶんた', score: 80, words: ['いぬ'] },
    }),
    round('r2', {
      a: { name: 'あかりん', score: 40, words: ['うし'] },
      b: { name: 'ぶんた', score: 200, words: ['あいうえおかき'] },
    }),
  ];

  it('勝ち数・合計点・最高点・単語数を集計する', () => {
    const totals = aggregatePlayerTotals(rounds);
    const akari = totals.find((t) => t.uid === 'a')!;
    const bunta = totals.find((t) => t.uid === 'b')!;
    expect(akari.wins).toBe(1);
    expect(akari.rounds).toBe(2);
    expect(akari.totalScore).toBe(160);
    expect(akari.bestScore).toBe(120);
    expect(akari.wordCount).toBe(3);
    expect(bunta.wins).toBe(1);
    expect(bunta.bestScore).toBe(200);
  });

  it('なまえは直近のラウンドのものを使う', () => {
    expect(aggregatePlayerTotals(rounds).find((t) => t.uid === 'a')!.name).toBe('あかりん');
  });

  it('いちばん長い単語を覚えておく', () => {
    const totals = aggregatePlayerTotals(rounds);
    expect(totals.find((t) => t.uid === 'a')!.longestWord).toBe('ひまわり');
    expect(totals.find((t) => t.uid === 'b')!.longestWord).toBe('あいうえおかき');
  });

  it('勝ち数→合計点の順に並べる', () => {
    const totals = aggregatePlayerTotals([
      ...rounds,
      round('r3', { b: { name: 'ぶんた', score: 10, words: ['ねこ'] } }),
    ]);
    expect(totals.map((t) => t.uid)).toEqual(['b', 'a']);
  });

  it('全員0点のラウンドには勝者を立てない', () => {
    const totals = aggregatePlayerTotals([
      round('r1', { a: { name: 'あかり', score: 0 }, b: { name: 'ぶんた', score: 0 } }),
    ]);
    expect(totals.every((t) => t.wins === 0)).toBe(true);
    expect(totals.every((t) => t.rounds === 1)).toBe(true);
  });

  it('同点1位はどちらも勝ちになる', () => {
    const totals = aggregatePlayerTotals([
      round('r1', { a: { name: 'あかり', score: 50 }, b: { name: 'ぶんた', score: 50 } }),
    ]);
    expect(totals.every((t) => t.wins === 1)).toBe(true);
  });

  it('記録がなければ空になる', () => {
    expect(aggregatePlayerTotals([])).toEqual([]);
  });
});
