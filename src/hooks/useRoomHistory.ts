import { useEffect, useState } from 'react';
import { subscribeRoomHistory } from '../firebase/roomHistory';
import type { RoundRecord } from '../game/roomStats';

export interface RoomHistoryState {
  /** 古い順のラウンド記録。読み込み中はnull */
  rounds: RoundRecord[] | null;
  error: string | null;
}

/** ルームの戦績(ラウンドごとの記録)を購読する。roomIdが無い・無効な間は何もしない。 */
export function useRoomHistory(roomId: string | undefined, enabled: boolean): RoomHistoryState {
  const [rounds, setRounds] = useState<RoundRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId || !enabled) return;
    setRounds(null);
    setError(null);
    return subscribeRoomHistory(
      roomId,
      (next) => {
        setRounds(next);
        setError(null);
      },
      (err) => setError(`戦績の読み込みに失敗しました: ${err.message}`),
    );
  }, [roomId, enabled]);

  return { rounds, error };
}
