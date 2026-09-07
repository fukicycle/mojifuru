import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { leaveRoom, resetOwnRoundState, startRoom, subscribeRoom, type Room } from '../firebase/room';
import { useGameContext } from '../context/GameContext';
import { signInAnonymouslyOnce } from '../firebase/config';

export default function RoomLobbyScreen() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { firebaseEnabled } = useGameContext();
  const [room, setRoom] = useState<Room | null>(null);
  const [copied, setCopied] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseEnabled) return;
    signInAnonymouslyOnce().then(setUid);
  }, [firebaseEnabled]);

  useEffect(() => {
    if (!roomId || !firebaseEnabled) return;
    return subscribeRoom(roomId, setRoom, (error) =>
      setSyncError(`ルームの同期に失敗しました: ${error.message}`),
    );
  }, [roomId, firebaseEnabled]);

  useEffect(() => {
    if (room?.startAt !== null && room?.startAt !== undefined && roomId) {
      navigate(`/room/${roomId}/play`);
    }
  }, [room, roomId, navigate]);

  // 再戦でロビーへ戻ってきた場合、前回ラウンドの自分のスコア・成立単語をリセットする
  useEffect(() => {
    if (!roomId || !uid || !room || room.startAt !== null) return;
    const me = room.players?.[uid];
    if (me && ((me.score ?? 0) > 0 || (me.wordsFormed?.length ?? 0) > 0)) {
      void resetOwnRoundState(roomId, uid);
    }
  }, [room, roomId, uid]);

  if (!roomId) return null;

  if (!firebaseEnabled) {
    return (
      <div className="screen screen--center">
        <p style={{ color: 'var(--text-soft)' }}>Firebaseが未設定のため、対戦モードは利用できません。</p>
        <button className="button button--ghost button--block" onClick={() => navigate('/')}>
          タイトルへもどる
        </button>
      </div>
    );
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(roomId!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードが使えない環境では無視する
    }
  }

  const players = room ? Object.entries(room.players ?? {}) : [];

  return (
    <div className="screen screen--center">
      <h2>ルーム</h2>
      <div className="room-code">{roomId}</div>
      <button className="button button--ghost" onClick={handleCopy}>
        {copied ? 'コピーしました!' : 'ルームコードをコピー'}
      </button>

      <div className="player-list" style={{ marginTop: 16, maxHeight: '40vh', overflowY: 'auto', width: '100%' }}>
        {players.map(([uid, player]) => (
          <div className="player-list-row" key={uid}>
            <span>{player.name || 'ななしさん'}</span>
          </div>
        ))}
        {players.length === 0 && <p style={{ color: 'var(--text-soft)' }}>参加者を待っています...</p>}
      </div>

      {syncError && <p style={{ color: 'crimson', fontSize: 13, marginTop: 8 }}>{syncError}</p>}

      <div className="button-row" style={{ marginTop: 16 }}>
        <button
          className="button button--primary button--block"
          onClick={() =>
            roomId &&
            startRoom(roomId).catch((error: unknown) =>
              setSyncError(`ゲームの開始に失敗しました: ${error instanceof Error ? error.message : String(error)}`),
            )
          }
        >
          ゲーム開始
        </button>
        <button
          className="button button--ghost button--block"
          onClick={() => {
            if (roomId && uid) void leaveRoom(roomId, uid);
            navigate('/');
          }}
        >
          やめる
        </button>
      </div>
    </div>
  );
}
