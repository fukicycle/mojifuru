import {
  get,
  onValue,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { getFirebaseDb } from './config';

export const ROOM_DURATION_SECONDS = 60;
/** 1回の単語成立で加算できるスコアの上限(セキュリティルールと同じ値。改ざん対策の目安) */
export const MAX_SCORE_INCREMENT_PER_WORD = 200;

export interface RoomPlayer {
  name: string;
  score: number;
  /** RTDBは空配列を保持しないため、単語未成立の間はフィールド自体が存在しない */
  wordsFormed?: string[];
}

export interface Room {
  seed: number;
  startAt: number | null;
  duration: number;
  players: Record<string, RoomPlayer>;
  takenLetters?: Record<string, string>;
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除いたルームコード
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/** ルームを新規作成し、ルームコードを返す。降下パターン共有用のseedもここで決まる。 */
export async function createRoom(uid: string, name: string): Promise<string> {
  const db = getFirebaseDb();
  const roomId = generateRoomId();
  const seed = Math.floor(Math.random() * 2 ** 31);
  await set(ref(db, `rooms/${roomId}`), {
    seed,
    startAt: null,
    duration: ROOM_DURATION_SECONDS,
    players: {
      [uid]: { name, score: 0, wordsFormed: [] } satisfies RoomPlayer,
    },
  });
  return roomId;
}

/** 既存ルームに参加する。存在しなければnullを返す。 */
export async function joinRoom(roomId: string, uid: string, name: string): Promise<Room | null> {
  const db = getFirebaseDb();
  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return null;
  await set(ref(db, `rooms/${roomId}/players/${uid}`), { name, score: 0, wordsFormed: [] } satisfies RoomPlayer);
  return (await get(roomRef)).val() as Room;
}

/** ホストがゲーム開始時刻を確定させる(参加者全員が同じstartAtから残り時間を計算する) */
export async function startRoom(roomId: string): Promise<void> {
  const db = getFirebaseDb();
  await update(ref(db, `rooms/${roomId}`), { startAt: serverTimestamp() });
}

export function subscribeRoom(roomId: string, onChange: (room: Room | null) => void): () => void {
  const db = getFirebaseDb();
  return onValue(ref(db, `rooms/${roomId}`), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.val() as Room) : null);
  });
}

/**
 * 文字の早い者勝ち排他制御。
 * セキュリティルール側で「値がnullのときのみ書き込み可」を強制しているため、
 * 他プレイヤーと同時にタップしても一方しか成功しない。
 */
export async function claimLetter(roomId: string, letterId: string, uid: string): Promise<boolean> {
  const db = getFirebaseDb();
  const letterRef = ref(db, `rooms/${roomId}/takenLetters/${letterId}`);
  const result = await runTransaction(letterRef, (current: string | null) => {
    if (current !== null) return; // 中断(既に取得済み)
    return uid;
  });
  return result.committed;
}

/** 単語成立時にスコアと成立単語一覧を更新する */
export async function submitRoomWord(roomId: string, uid: string, word: string, points: number): Promise<void> {
  const db = getFirebaseDb();
  const playerRef = ref(db, `rooms/${roomId}/players/${uid}`);
  await runTransaction(playerRef, (current: RoomPlayer | null) => {
    const base: RoomPlayer = current ?? { name: '', score: 0, wordsFormed: [] };
    return {
      ...base,
      score: (base.score ?? 0) + Math.min(points, MAX_SCORE_INCREMENT_PER_WORD),
      wordsFormed: [...(base.wordsFormed ?? []), word],
    };
  });
}
