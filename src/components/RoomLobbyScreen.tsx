import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { startRoom, subscribeRoom, type Room } from '../firebase/room';
import { useGameContext } from '../context/GameContext';

export default function RoomLobbyScreen() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { firebaseEnabled } = useGameContext();
  const [room, setRoom] = useState<Room | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!roomId || !firebaseEnabled) return;
    return subscribeRoom(roomId, setRoom);
  }, [roomId, firebaseEnabled]);

  useEffect(() => {
    if (room?.startAt !== null && room?.startAt !== undefined && roomId) {
      navigate(`/room/${roomId}/play`);
    }
  }, [room, roomId, navigate]);

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

      <div className="button-row" style={{ marginTop: 16 }}>
        <button className="button button--primary button--block" onClick={() => roomId && startRoom(roomId)}>
          ゲーム開始
        </button>
        <button className="button button--ghost button--block" onClick={() => navigate('/')}>
          やめる
        </button>
      </div>
    </div>
  );
}
