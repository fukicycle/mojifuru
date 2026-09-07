import { get, onValue, query, orderByChild, limitToLast, ref, runTransaction, serverTimestamp } from 'firebase/database';
import { getFirebaseDb } from './config';

export interface LeaderboardEntry {
  name: string;
  bestScore: number;
  updatedAt: number | object;
}

export type LeaderboardPeriod = 'daily' | 'monthly' | 'allTime';

// 日付境界はJST(UTC+9)固定で計算する(タイムゾーンライブラリは使わない)
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function jstDateParts(): { year: number; month: number; day: number } {
  const jst = new Date(Date.now() + JST_OFFSET_MS);
  return { year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1, day: jst.getUTCDate() };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 現在の日付キー(JST, 例: "2026-09-08")を返す */
export function currentDailyKey(): string {
  const { year, month, day } = jstDateParts();
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** 現在の月キー(JST, 例: "2026-09")を返す */
export function currentMonthlyKey(): string {
  const { year, month } = jstDateParts();
  return `${year}-${pad2(month)}`;
}

function periodPath(period: LeaderboardPeriod): string {
  if (period === 'daily') return `leaderboard/daily/${currentDailyKey()}`;
  if (period === 'monthly') return `leaderboard/monthly/${currentMonthlyKey()}`;
  return 'leaderboard/allTime';
}

/**
 * スコアを送信する。デイリー・マンスリー・全期間の3つのランキングそれぞれに対して、
 * 自己ベストのときだけ更新する(セキュリティルール側でも「増加のみ」を強制するが、
 * 無駄な書き込みを避けるためクライアント側でも比較する)。
 */
export async function submitScore(uid: string, name: string, score: number): Promise<void> {
  const db = getFirebaseDb();
  const periods: LeaderboardPeriod[] = ['daily', 'monthly', 'allTime'];
  await Promise.all(
    periods.map((period) => {
      const entryRef = ref(db, `${periodPath(period)}/${uid}`);
      return runTransaction(entryRef, (current: LeaderboardEntry | null) => {
        if (current && current.bestScore >= score) return current;
        return { name, bestScore: score, updatedAt: serverTimestamp() };
      });
    }),
  );
}

export interface LeaderboardRow extends LeaderboardEntry {
  uid: string;
}

/** 指定期間のランキングを取得する(全員分。countを指定した場合のみ件数を絞る) */
export async function fetchTopScores(period: LeaderboardPeriod, count?: number): Promise<LeaderboardRow[]> {
  const db = getFirebaseDb();
  const base = query(ref(db, periodPath(period)), orderByChild('bestScore'));
  const leaderboardQuery = count ? query(base, limitToLast(count)) : base;
  const snapshot = await get(leaderboardQuery);
  const rows: LeaderboardRow[] = [];
  snapshot.forEach((child) => {
    rows.push({ uid: child.key!, ...(child.val() as LeaderboardEntry) });
  });
  return rows.sort((a, b) => b.bestScore - a.bestScore);
}

/** 指定期間のランキングの変化をリアルタイムに購読する(全員分。countを指定した場合のみ件数を絞る) */
export function subscribeTopScores(
  period: LeaderboardPeriod,
  count: number | undefined,
  onChange: (rows: LeaderboardRow[]) => void,
): () => void {
  const db = getFirebaseDb();
  const base = query(ref(db, periodPath(period)), orderByChild('bestScore'));
  const leaderboardQuery = count ? query(base, limitToLast(count)) : base;
  return onValue(leaderboardQuery, (snapshot) => {
    const rows: LeaderboardRow[] = [];
    snapshot.forEach((child) => {
      rows.push({ uid: child.key!, ...(child.val() as LeaderboardEntry) });
    });
    onChange(rows.sort((a, b) => b.bestScore - a.bestScore));
  });
}
