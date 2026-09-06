import { ref, runTransaction, serverTimestamp } from 'firebase/database';
import { getFirebaseDb } from './config';

export interface WordCandidate {
  count: number;
  firstSeenAt: number | object;
}

/**
 * 辞書に未登録だった単語を /wordCandidates/{word} に収集する。
 * 頻出する未登録語を確認し、次回リリースで辞書に追加する運用を想定している。
 */
export async function reportUnregisteredWord(word: string): Promise<void> {
  const db = getFirebaseDb();
  const candidateRef = ref(db, `wordCandidates/${word}`);
  await runTransaction(candidateRef, (current: WordCandidate | null) => {
    if (current) return { ...current, count: current.count + 1 };
    return { count: 1, firstSeenAt: serverTimestamp() };
  });
}
