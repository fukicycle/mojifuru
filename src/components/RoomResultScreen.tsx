import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { subscribeRoom, type Room } from '../firebase/room';
import { useGameContext } from '../context/GameContext';

export default function RoomResultScreen() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { firebaseEnabled } = useGameContext();
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    if (!roomId || !firebaseEnabled) return;
    return subscribeRoom(roomId, setRoom);
  }, [roomId, firebaseEnabled]);

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

  const ranked = Object.entries(room?.players ?? {}).sort(([, a], [, b]) => b.score - a.score);

  return (
    <div className="screen">
      <h2 style={{ textAlign: 'center' }}>けっか発表</h2>
      <div className="player-list" style={{ flex: 1, overflowY: 'auto' }}>
        {ranked.map(([uid, player], i) => (
          <div className="leaderboard-row" key={uid}>
            <div className="leaderboard-rank">{i + 1}</div>
            <div className="leaderboard-name">{player.name || 'ななしさん'}</div>
            <div className="leaderboard-score">{player.score}点</div>
          </div>
        ))}
      </div>

      <div className="button-row" style={{ margin: '16px auto 0' }}>
        <button className="button button--primary button--block" onClick={() => navigate(`/room/${roomId}`)}>
          もう一度あそぶ
        </button>
        <button className="button button--ghost button--block" onClick={() => navigate('/')}>
          タイトルへ
        </button>
      </div>
    </div>
  );
}
