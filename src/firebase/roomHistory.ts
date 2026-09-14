/**
 * ルーム対戦の戦績(ラウンドごとの記録)の保存と読み出し。
 *
 * `rooms/{roomId}` は全員が退出すると消えてしまうため、あとからルームコードを頼りに
 * 見返せるよう、戦績は `roomHistory/{roomId}` に別ノードとして積んでいく。
 * 書き込みはラウンド終了時に各クライアントが「自分のぶんだけ」行う
 * (セキュリティルール上、players/{uid} は本人しか書けない)。
 */

import { limitToLast, onValue, orderByKey, query, ref, serverTimestamp, update } from 'firebase/database';
import { getFirebaseDb } from './config';
import type { RoundPlayerRecord, RoundRecord } from '../game/roomStats';

/** 読み込むラウンド数の上限(同じルームで延々と再戦しても読み込み量が増えないようにする) */
export const ROOM_HISTORY_MAX_ROUNDS = 30;
/** 1ラウンドぶんの得点の上限(セキュリティルールと同じ値。改ざん対策の目安) */
export const MAX_ROUND_SCORE = 20000;
/** なまえの最大文字数(セキュリティルールと同じ値) */
const MAX_NAME_LENGTH = 20;

/**
 * ラウンドのキーはラウンド開始時刻(サーバータイムスタンプ)から作る。
 * 全端末で同じ値になるため追加の同期がいらず、先頭に `r` を付けて文字列キーにすることで
 * RTDBが数値キーを配列とみなす挙動も避けられる(桁数が同じなので辞書順=時刻順)。
 */
export function roundHistoryKey(roundStartAt: number): string {
  return `r${roundStartAt}`;
}

export interface ArchiveRoundParams {
  roomId: string;
  /** このラウンドの `room.startAt`(全員で一致する値) */
  roundStartAt: number;
  uid: string;
  name: string;
  score: number;
  words: readonly string[];
}

/** ラウンド終了時に、自分のぶんの結果を戦績として残す */
export async function archiveRoundResult({
  roomId,
  roundStartAt,
  uid,
  name,
  score,
  words,
}: ArchiveRoundParams): Promise<void> {
  const db = getFirebaseDb();
  const record: RoundPlayerRecord = {
    name: name.slice(0, MAX_NAME_LENGTH),
    score: Math.max(0, Math.min(Math.round(score), MAX_ROUND_SCORE)),
  };
  // RTDBは空配列を保持しないため、1語も成立しなかったときはフィールドごと送らない
  if (words.length > 0) record.words = [...words];

  await update(ref(db, `roomHistory/${roomId}/${roundHistoryKey(roundStartAt)}`), {
    startedAt: roundStartAt,
    finishedAt: serverTimestamp(),
    [`players/${uid}`]: record,
  });
}

function toRounds(snapshotValue: unknown): RoundRecord[] {
  const rounds: RoundRecord[] = [];
  for (const [id, value] of Object.entries((snapshotValue ?? {}) as Record<string, Omit<RoundRecord, 'id'>>)) {
    rounds.push({ ...value, id });
  }
  // キーは `r{開始時刻}` なので辞書順に並べればラウンドの古い順になる
  return rounds.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * ルームの戦績を購読する(古い順)。
 * ラウンド終了直後は各プレイヤーの書き込みが少しずつ届くため、
 * 一度きりの取得ではなく購読にして、揃うたびに表示を更新する。
 */
export function subscribeRoomHistory(
  roomId: string,
  onChange: (rounds: RoundRecord[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirebaseDb();
  const historyQuery = query(
    ref(db, `roomHistory/${roomId}`),
    orderByKey(),
    limitToLast(ROOM_HISTORY_MAX_ROUNDS),
  );
  return onValue(
    historyQuery,
    (snapshot) => onChange(toRounds(snapshot.val())),
    (error) => {
      console.error(`[mojifuru] roomHistory/${roomId} の購読に失敗しました`, error);
      onError?.(error);
    },
  );
}
