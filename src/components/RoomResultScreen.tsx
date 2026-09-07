import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { leaveRoom, restartRoom, subscribeRoom, type Room } from '../firebase/room';
import { useGameContext } from '../context/GameContext';
import { signInAnonymouslyOnce } from '../firebase/config';

export default function RoomResultScreen() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { firebaseEnabled } = useGameContext();
  const [room, setRoom] = useState<Room | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  // ゲーム終了間際の「確定」連打の残りタップが、同じ画面位置にある
  // 「もう一度あそぶ」を誤って発火させないよう、遷移直後は操作を受け付けない。
  // ルーム対戦では全員を巻き込む再戦になるため、ソロ版より重要な対策。
  const [controlsReady, setControlsReady] = useState(false);

  useEffect(() => {
    if (!firebaseEnabled) return;
    signInAnonymouslyOnce().then(setUid);
  }, [firebaseEnabled]);

  useEffect(() => {
    const timer = setTimeout(() => setControlsReady(true), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!roomId || !firebaseEnabled) return;
    return subscribeRoom(roomId, setRoom, (error) =>
      setSyncError(`ルームの同期に失敗しました: ${error.message}`),
    );
  }, [roomId, firebaseEnabled]);

  // 誰か1人が「もう一度あそぶ」を押してstartAtがリセットされたら、
  // 全員のこの画面をロビーへ連れ戻す。
  // RTDBはnullを書き込んだフィールドを削除するため、実際に届く値は
  // (厳密な)nullではなくundefined(キー自体が存在しない)になる点に注意。
  useEffect(() => {
    if (roomId && room && room.startAt == null) {
      navigate(`/room/${roomId}`);
    }
  }, [room, roomId, navigate]);

  if (!roomId) return null;

  async function handleRematch() {
    setRestarting(true);
    try {
      await restartRoom(roomId!);
    } catch (error) {
      setSyncError(`再戦の開始に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRestarting(false);
    }
  }

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

      {syncError && <p style={{ color: 'crimson', fontSize: 13, textAlign: 'center' }}>{syncError}</p>}

      <div className="button-row" style={{ margin: '16px auto 0' }}>
        <button
          className="button button--primary button--block"
          onClick={handleRematch}
          disabled={restarting || !controlsReady}
        >
          もう一度あそぶ
        </button>
        <button
          className="button button--ghost button--block"
          disabled={!controlsReady}
          onClick={() => {
            if (roomId && uid) void leaveRoom(roomId, uid);
            navigate('/');
          }}
        >
          タイトルへ
        </button>
      </div>
    </div>
  );
}
