import { get, onValue, query, orderByChild, limitToLast, ref, runTransaction, serverTimestamp } from 'firebase/database';
import { getFirebaseDb } from './config';

export interface LeaderboardEntry {
  name: string;
  bestScore: number;
  updatedAt: number | object;
}

/**
 * ソロプレイのスコアを送信する。
 * 自己ベストのときだけ更新する(セキュリティルール側でも「増加のみ」を強制するが、
 * 無駄な書き込みを避けるためクライアント側でも比較する)。
 */
export async function submitScore(uid: string, name: string, score: number): Promise<void> {
  const db = getFirebaseDb();
  const entryRef = ref(db, `leaderboard/${uid}`);
  await runTransaction(entryRef, (current: LeaderboardEntry | null) => {
    if (current && current.bestScore >= score) return current;
    return { name, bestScore: score, updatedAt: serverTimestamp() };
  });
}

export interface LeaderboardRow extends LeaderboardEntry {
  uid: string;
}

/** 全体ランキングを取得する(全員分。countを指定した場合のみ件数を絞る) */
export async function fetchTopScores(count?: number): Promise<LeaderboardRow[]> {
  const db = getFirebaseDb();
  const base = query(ref(db, 'leaderboard'), orderByChild('bestScore'));
  const leaderboardQuery = count ? query(base, limitToLast(count)) : base;
  const snapshot = await get(leaderboardQuery);
  const rows: LeaderboardRow[] = [];
  snapshot.forEach((child) => {
    rows.push({ uid: child.key!, ...(child.val() as LeaderboardEntry) });
  });
  return rows.sort((a, b) => b.bestScore - a.bestScore);
}

/** 全体ランキングの変化をリアルタイムに購読する(全員分。countを指定した場合のみ件数を絞る) */
export function subscribeTopScores(count: number | undefined, onChange: (rows: LeaderboardRow[]) => void): () => void {
  const db = getFirebaseDb();
  const base = query(ref(db, 'leaderboard'), orderByChild('bestScore'));
  const leaderboardQuery = count ? query(base, limitToLast(count)) : base;
  return onValue(leaderboardQuery, (snapshot) => {
    const rows: LeaderboardRow[] = [];
    snapshot.forEach((child) => {
      rows.push({ uid: child.key!, ...(child.val() as LeaderboardEntry) });
    });
    onChange(rows.sort((a, b) => b.bestScore - a.bestScore));
  });
}
