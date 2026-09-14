import { beforeEach, describe, expect, it } from 'vitest';
import {
  forgetRoom,
  loadRecentRooms,
  parseRecentRooms,
  RECENT_ROOMS_MAX,
  rememberRoom,
  removeRecentRoom,
  upsertRecentRoom,
  type RecentRoom,
} from './recentRooms';

describe('upsertRecentRoom', () => {
  const rooms: RecentRoom[] = [
    { roomId: 'AAA111', lastJoinedAt: 200 },
    { roomId: 'BBB222', lastJoinedAt: 100 },
  ];

  it('新しく入ったルームを先頭に入れる', () => {
    expect(upsertRecentRoom(rooms, 'CCC333', 300).map((r) => r.roomId)).toEqual([
      'CCC333',
      'AAA111',
      'BBB222',
    ]);
  });

  it('同じルームは重複させず、先頭に移して時刻を更新する', () => {
    const next = upsertRecentRoom(rooms, 'BBB222', 300);
    expect(next.map((r) => r.roomId)).toEqual(['BBB222', 'AAA111']);
    expect(next[0].lastJoinedAt).toBe(300);
  });

  it('件数の上限を超えたら古いものから落とす', () => {
    let list: RecentRoom[] = [];
    for (let i = 0; i < RECENT_ROOMS_MAX + 3; i += 1) {
      list = upsertRecentRoom(list, `ROOM${i}`, i);
    }
    expect(list).toHaveLength(RECENT_ROOMS_MAX);
    expect(list[0].roomId).toBe(`ROOM${RECENT_ROOMS_MAX + 2}`);
  });
});

describe('removeRecentRoom', () => {
  it('指定したルームだけを一覧から外す', () => {
    const rooms: RecentRoom[] = [
      { roomId: 'AAA111', lastJoinedAt: 2 },
      { roomId: 'BBB222', lastJoinedAt: 1 },
    ];
    expect(removeRecentRoom(rooms, 'AAA111').map((r) => r.roomId)).toEqual(['BBB222']);
  });
});

describe('parseRecentRooms', () => {
  it('新しい順に並べ替えて返す', () => {
    const raw = JSON.stringify([
      { roomId: 'AAA111', lastJoinedAt: 1 },
      { roomId: 'BBB222', lastJoinedAt: 9 },
    ]);
    expect(parseRecentRooms(raw).map((r) => r.roomId)).toEqual(['BBB222', 'AAA111']);
  });

  it('壊れた保存内容は空一覧として扱う(例外を投げない)', () => {
    expect(parseRecentRooms(null)).toEqual([]);
    expect(parseRecentRooms('{')).toEqual([]);
    expect(parseRecentRooms('{"roomId":"AAA111"}')).toEqual([]);
    expect(parseRecentRooms('[null, 1, {"roomId":"AAA111"}]')).toEqual([]);
  });
});

describe('rememberRoom / forgetRoom', () => {
  beforeEach(() => localStorage.clear());

  it('控えたルームを読み戻せる', () => {
    rememberRoom('AAA111', 100);
    rememberRoom('BBB222', 200);
    expect(loadRecentRooms().map((r) => r.roomId)).toEqual(['BBB222', 'AAA111']);
  });

  it('一覧から消せる', () => {
    rememberRoom('AAA111', 100);
    expect(forgetRoom('AAA111')).toEqual([]);
    expect(loadRecentRooms()).toEqual([]);
  });
});
