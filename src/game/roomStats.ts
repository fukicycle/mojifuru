/**
 * ルーム対戦の戦績(純粋関数)。
 *
 * 保存してあるのは「なまえ・とくてん・成立した単語の並び」だけで、
 * 1単語ごとの点数やボーナス段階は持たない(得点は単語の並びから一意に決まるため、
 * rescoreWordSequence で再現できる)。この層はFirebaseに依存せず、
 * 記録の形だけを知っている。
 */

import { rescoreWordSequence, type ScoredWord } from './scoring';

/** 1ラウンドぶんの、あるプレイヤーの記録(RTDBに保存されている形) */
export interface RoundPlayerRecord {
  name: string;
  score: number;
  /** RTDBは空配列を保持しないため、1語も成立しなかったプレイヤーではフィールドごと存在しない */
  words?: string[];
}

/** 1ラウンドぶんの記録(RTDBに保存されている形 + キー) */
export interface RoundRecord {
  /** RTDB上のキー(ラウンド開始時刻から作る。古い順に並ぶ) */
  id: string;
  startedAt: number;
  finishedAt?: number;
  players?: Record<string, RoundPlayerRecord>;
}

export interface RankedRoundPlayer {
  uid: string;
  name: string;
  score: number;
  /** 同点は同じ順位(1, 1, 3 のように飛ぶ) */
  rank: number;
  words: ScoredWord[];
}

/** 0点のまま終わったラウンドには勝者を立てない(全員0点で「1位」が付くのを避ける) */
const MIN_WINNING_SCORE = 1;

/** 1ラウンドの参加者を得点順に並べ、各自の成立単語を点数付きで復元する */
export function rankRoundPlayers(players: Record<string, RoundPlayerRecord> | undefined): RankedRoundPlayer[] {
  const entries = Object.entries(players ?? {}).sort(([, a], [, b]) => (b.score ?? 0) - (a.score ?? 0));
  let lastScore: number | null = null;
  let lastRank = 0;
  return entries.map(([uid, player], index) => {
    const score = player.score ?? 0;
    if (lastScore === null || score !== lastScore) {
      lastScore = score;
      lastRank = index + 1;
    }
    return {
      uid,
      name: player.name || 'ななしさん',
      score,
      rank: lastRank,
      words: rescoreWordSequence(player.words ?? []),
    };
  });
}

export interface PlayerTotals {
  uid: string;
  /** 直近のラウンドで使っていたなまえ */
  name: string;
  /** 参加したラウンド数 */
  rounds: number;
  /** 1位になったラウンド数(同点1位は全員勝ち) */
  wins: number;
  totalScore: number;
  bestScore: number;
  /** 成立させた単語の総数 */
  wordCount: number;
  /** いちばん長い単語(同じ長さなら先に出したもの) */
  longestWord: string | null;
}

/**
 * ラウンドの記録をまとめて、プレイヤーごとの通算成績にする。
 *
 * @param rounds 古い順のラウンド記録。なまえは最後に現れたものを採用する。
 */
export function aggregatePlayerTotals(rounds: readonly RoundRecord[]): PlayerTotals[] {
  const totals = new Map<string, PlayerTotals>();

  for (const round of rounds) {
    const ranked = rankRoundPlayers(round.players);
    for (const player of ranked) {
      const current = totals.get(player.uid) ?? {
        uid: player.uid,
        name: player.name,
        rounds: 0,
        wins: 0,
        totalScore: 0,
        bestScore: 0,
        wordCount: 0,
        longestWord: null,
      };
      current.name = player.name;
      current.rounds += 1;
      if (player.rank === 1 && player.score >= MIN_WINNING_SCORE) current.wins += 1;
      current.totalScore += player.score;
      current.bestScore = Math.max(current.bestScore, player.score);
      current.wordCount += player.words.length;
      for (const word of player.words) {
        if (current.longestWord === null || word.length > current.longestWord.length) {
          current.longestWord = word.word;
        }
      }
      totals.set(player.uid, current);
    }
  }

  return [...totals.values()].sort(
    (a, b) =>
      b.wins - a.wins ||
      b.totalScore - a.totalScore ||
      b.bestScore - a.bestScore ||
      a.name.localeCompare(b.name),
  );
}
