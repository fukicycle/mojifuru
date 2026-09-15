/**
 * 単語ずかん(これまでに成立させた単語の記録)の保存と読み出し。
 *
 * なまえ・音設定のような端末ごとの設定とは違い、ずかんは遊んだぶんだけ積み上がる
 * 記録なので、localStorageではなくRTDBのuid配下に置く。Googleアカウントと連携しても
 * uidは変わらないため、連携さえしておけば機種を変えてもそのまま引き継がれる。
 *
 * 最初に見つけた日付を残したいので、いちど書いた単語は上書きできない
 * (セキュリティルール側で `!data.exists()` のときだけ書き込みを許可している)。
 */

import { child, get, ref, serverTimestamp, update } from 'firebase/database';
import { getFirebaseDb } from './config';

/** 単語 → はじめて見つけた日時(epoch ms) */
export type WordCollection = Record<string, number>;

function collectionRef(uid: string) {
  return ref(getFirebaseDb(), `wordCollection/${uid}`);
}

/** ずかん全体を読み出す(ずかん画面用) */
export async function fetchWordCollection(uid: string): Promise<WordCollection> {
  const snapshot = await get(collectionRef(uid));
  return (snapshot.val() ?? {}) as WordCollection;
}

/**
 * 成立した単語のうち、まだ記録していないものを「はじめて見つけた単語」として記録し、
 * その一覧(成立した順)を返す。
 *
 * 記録済みの単語は書き込みがルールで弾かれるため、書く前に存在を確かめる。
 * ずかん全体を読むと収集語数に比例して重くなるので、このラウンドで成立した単語だけを
 * ピンポイントで読む(1ラウンドでせいぜい十数語)。
 */
export async function recordFoundWords(uid: string, words: readonly string[]): Promise<string[]> {
  const unique = [...new Set(words)];
  if (unique.length === 0) return [];

  const base = collectionRef(uid);
  const snapshots = await Promise.all(unique.map((word) => get(child(base, word))));
  const fresh = unique.filter((_, i) => !snapshots[i].exists());
  if (fresh.length === 0) return [];

  const updates: Record<string, object> = {};
  for (const word of fresh) updates[word] = serverTimestamp();
  await update(base, updates);
  return fresh;
}
