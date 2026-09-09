import {
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from 'firebase/database';
import { getFirebaseDb } from './config';

export const ROOM_DURATION_SECONDS = 60;
/** 1回の単語成立で加算できるスコアの上限(セキュリティルールと同じ値。改ざん対策の目安) */
export const MAX_SCORE_INCREMENT_PER_WORD = 200;
/** 「ゲーム開始」からプレイ開始までのカウントダウン秒数(全員が同じstartAtから逆算する) */
export const ROOM_COUNTDOWN_SECONDS = 3;

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
  /** 開始時点の参加人数。降ってくる文字の量をスケールするため、開始時に固定する */
  playerCountAtStart?: number;
  players: Record<string, RoomPlayer>;
  takenLetters?: Record<string, string>;
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除いたルームコード
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/**
 * タブを閉じる・接続が切れるなど「退出」を明示的に検知できないケースに備え、
 * 自分のplayersエントリをサーバ側に「切断時に削除」として予約する。
 * SPA内のページ遷移ではWebSocket接続自体は切れないため消えず、実際に
 * タブを閉じる/リロードする/オフラインになったときにだけ発火する。
 */
function registerLeaveOnDisconnect(roomId: string, uid: string): void {
  const db = getFirebaseDb();
  onDisconnect(ref(db, `rooms/${roomId}/players/${uid}`)).remove().catch(() => {
    // onDisconnectの登録自体に失敗しても致命的ではないため無視する
  });
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
  registerLeaveOnDisconnect(roomId, uid);
  return roomId;
}

/** 既存ルームに参加する。存在しなければnullを返す。 */
export async function joinRoom(roomId: string, uid: string, name: string): Promise<Room | null> {
  const db = getFirebaseDb();
  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  if (!snapshot.exists()) return null;
  await set(ref(db, `rooms/${roomId}/players/${uid}`), { name, score: 0, wordsFormed: [] } satisfies RoomPlayer);
  registerLeaveOnDisconnect(roomId, uid);
  return (await get(roomRef)).val() as Room;
}

/**
 * 「やめる」など明示的な退出操作用。onDisconnectの発火(タブを閉じる等)を待たずに
 * 即座に自分のplayersエントリを削除する。
 */
export async function leaveRoom(roomId: string, uid: string): Promise<void> {
  const db = getFirebaseDb();
  await remove(ref(db, `rooms/${roomId}/players/${uid}`));
}

/** ホストがゲーム開始時刻を確定させる(参加者全員が同じstartAtから残り時間を計算する) */
export async function startRoom(roomId: string): Promise<void> {
  const db = getFirebaseDb();
  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  const room = snapshot.val() as Room | null;
  // 対戦中に参加人数が変わると文字の出現量スケールが端末ごとにズレてしまうため、
  // ラウンド開始時点の人数をここで固定する。
  const playerCountAtStart = room ? Object.keys(room.players ?? {}).length : 1;
  await update(roomRef, { startAt: serverTimestamp(), playerCountAtStart });
}

/**
 * 同じルームでもう一度遊ぶ。ロビーを経由させず、startRoomと同様に新しいstartAtを
 * 即座に確定させることで、結果画面から直接カウントダウン→プレイ開始へつなげる。
 * seedも新しくして降ってくる文字のパターンを次回戦は変える。
 * 各プレイヤーのスコア・成立単語のリセットは、セキュリティルール上
 * 本人のuidでしか書き込めないため、ここでは行わない
 * (各クライアントがstartAtの変化を検知した際にresetOwnRoundStateで自分の分を行う)。
 */
export async function restartRoom(roomId: string): Promise<void> {
  const db = getFirebaseDb();
  const roomRef = ref(db, `rooms/${roomId}`);
  const snapshot = await get(roomRef);
  const room = snapshot.val() as Room | null;
  const seed = Math.floor(Math.random() * 2 ** 31);
  const playerCountAtStart = room ? Object.keys(room.players ?? {}).length : 1;
  await update(roomRef, { startAt: serverTimestamp(), seed, playerCountAtStart });
}

/** 再戦時、前回ラウンドの自分のスコア・成立単語をリセットする */
export async function resetOwnRoundState(roomId: string, uid: string): Promise<void> {
  const db = getFirebaseDb();
  await update(ref(db, `rooms/${roomId}/players/${uid}`), { score: 0, wordsFormed: null });
}

export function subscribeRoom(
  roomId: string,
  onChange: (room: Room | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirebaseDb();
  return onValue(
    ref(db, `rooms/${roomId}`),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      const room = snapshot.val() as Room;
      onChange(room);
      // 全員が退出(明示的な退出 or onDisconnectでの自動削除)してplayersが
      // 空になったら、そのタイミングで購読中のクライアントがルームごと閉じる。
      // 複数クライアントが同時に呼んでも削除は冪等なので競合の心配はない。
      if (!room.players || Object.keys(room.players).length === 0) {
        void remove(ref(db, `rooms/${roomId}`));
      }
    },
    (error) => {
      // onValueは購読中にエラーが起きると以後コールバックが呼ばれなくなる。
      // ここで拾わないと「相手の画面が反映されない」ように見えるだけで
      // 原因(権限エラー等)が一切わからなくなるため、必ず呼び出し元へ伝える。
      console.error(`[mojifuru] rooms/${roomId} の購読に失敗しました`, error);
      onError?.(error);
    },
  );
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
