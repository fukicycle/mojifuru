import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { leaveRoom, startRoom, subscribeRoom, type Room } from '../firebase/room';
import { useGameContext } from '../context/GameContext';
import { signInAnonymouslyOnce } from '../firebase/config';
import { ChipLoader, ChipTitle, DecoChips, EmptyChip } from './decor';
import { colorForChar } from './chipColors';

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

  if (!roomId) return null;

  if (!firebaseEnabled) {
    return (
      <div className="screen screen--center screen--decorated">
        <DecoChips />
        <EmptyChip mark="!" text="Firebaseが未設定のため、対戦モードは利用できません。" />
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
    <div className="screen screen--center screen--decorated">
      <DecoChips />

      <ChipTitle text="ルーム" caption="ルームコードを友だちにおくろう" />

      <div className="panel panel--text room-code-card">
        <p className="room-code-label">ルームコード</p>
        <div className="room-code">{roomId}</div>
      </div>
      <button className="button button--ghost" onClick={handleCopy}>
        {copied ? 'コピーしました!' : 'ルームコードをコピー'}
      </button>

      <p className="count-badge count-badge--center">さんかしゃ {players.length}人</p>

      <div className="panel player-list" style={{ maxHeight: '32vh', overflowY: 'auto', width: '100%' }}>
        {players.map(([uid, player]) => {
          const name = player.name || 'ななしさん';
          return (
            <div className="player-list-row" key={uid}>
              <span className={`player-avatar player-avatar--${colorForChar(name[0])}`} aria-hidden="true">
                {name[0]}
              </span>
              <span className="player-list-name">{name}</span>
            </div>
          );
        })}
        {players.length === 0 && <ChipLoader text="さんかしゃを まっています..." />}
      </div>

      {syncError && <p className="form-error">{syncError}</p>}

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
