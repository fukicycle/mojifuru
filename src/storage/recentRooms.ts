/**
 * さいきん遊んだルームの記録(この端末のみ・localStorage)。
 *
 * ルームコードはランダムな6文字で、覚えておく手立てがないまま失われてしまう。
 * そこで「入ったことのあるルーム」を端末側に控えておき、タイトル画面から
 * 同じルームに入り直したり、戦績を見返したりできるようにする。
 *
 * バックエンドを持たない構成のため、サーバー側にユーザーごとのルーム一覧は作らない
 * (匿名認証のuidも端末ごとなので、RTDBに置いてもlocalStorageと持続性は変わらない)。
 */

const STORAGE_KEY = 'mojifuru:recentRooms';

/** 一覧に残す件数。多すぎるとタイトル画面が埋まるため絞る */
export const RECENT_ROOMS_MAX = 5;

export interface RecentRoom {
  roomId: string;
  /** 最後にそのルームへ入った時刻(epoch ms) */
  lastJoinedAt: number;
}

function isRecentRoom(value: unknown): value is RecentRoom {
  const room = value as RecentRoom | null;
  return typeof room?.roomId === 'string' && typeof room?.lastJoinedAt === 'number';
}

/** 保存された文字列を一覧に戻す。壊れていても例外は投げず、空一覧として扱う。 */
export function parseRecentRooms(raw: string | null): RecentRoom[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isRecentRoom)
      .map((room) => ({ roomId: room.roomId, lastJoinedAt: room.lastJoinedAt }))
      .sort((a, b) => b.lastJoinedAt - a.lastJoinedAt)
      .slice(0, RECENT_ROOMS_MAX);
  } catch {
    return [];
  }
}

/** 新しい順に並べ直して先頭へ入れる(同じルームは重複させず時刻だけ更新する) */
export function upsertRecentRoom(rooms: readonly RecentRoom[], roomId: string, at: number): RecentRoom[] {
  const others = rooms.filter((room) => room.roomId !== roomId);
  return [{ roomId, lastJoinedAt: at }, ...others].slice(0, RECENT_ROOMS_MAX);
}

export function removeRecentRoom(rooms: readonly RecentRoom[], roomId: string): RecentRoom[] {
  return rooms.filter((room) => room.roomId !== roomId);
}

export function loadRecentRooms(): RecentRoom[] {
  try {
    return parseRecentRooms(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function save(rooms: readonly RecentRoom[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // localStorageが使えない環境でも致命的ではないため無視する
  }
}

/** ルームに入ったことを控える(作成・参加・入り直しのいずれでも呼ぶ)。更新後の一覧を返す。 */
export function rememberRoom(roomId: string, at: number = Date.now()): RecentRoom[] {
  const next = upsertRecentRoom(loadRecentRooms(), roomId, at);
  save(next);
  return next;
}

/** 一覧から消す(ルーム自体や戦績は消さない)。更新後の一覧を返す。 */
export function forgetRoom(roomId: string): RecentRoom[] {
  const next = removeRecentRoom(loadRecentRooms(), roomId);
  save(next);
  return next;
}
