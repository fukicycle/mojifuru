import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { ensureSignedIn } from '../firebase/config';
import { createRoom, joinRoom, rejoinRoom } from '../firebase/room';
import { forgetRoom, loadRecentRooms } from '../storage/recentRooms';
import AccountPanel from './AccountPanel';
import { DecoChips } from './decor';

/** さいきんのルームに添える日付(「9/14」) */
function formatJoinedAt(at: number): string {
  const date = new Date(at);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function TitleScreen() {
  const navigate = useNavigate();
  const { playerName, setPlayerName, firebaseEnabled, dawg, dawgError } = useGameContext();
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // この端末で入ったことのあるルーム。タイトルへ戻るたびにマウントし直されるため、
  // 初期値として読むだけでよい(他画面での追加もここで反映される)。
  const [recentRooms, setRecentRooms] = useState(loadRecentRooms);

  const trimmedName = playerName.trim();
  const nameMissing = trimmedName.length === 0;

  async function handleCreateRoom() {
    if (nameMissing) return;
    setBusy(true);
    setError(null);
    try {
      const uid = await ensureSignedIn();
      const roomId = await createRoom(uid, trimmedName);
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinRoom() {
    if (nameMissing) return;
    const roomId = roomCodeInput.trim().toUpperCase();
    if (!roomId) return;
    setBusy(true);
    setError(null);
    try {
      const uid = await ensureSignedIn();
      const room = await joinRoom(roomId, uid, trimmedName);
      if (!room) {
        setError('ルームが見つかりませんでした。ルームコードを確認してください。');
        return;
      }
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  /** さいきんのルームに入り直す。消えていれば同じルームコードで作り直される。 */
  async function handleRejoinRoom(roomId: string) {
    if (nameMissing) return;
    setBusy(true);
    setError(null);
    try {
      const uid = await ensureSignedIn();
      await rejoinRoom(roomId, uid, trimmedName);
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen screen--center screen--decorated">
      <DecoChips />

      <h1 className="app-logo">もじふる</h1>
      <p className="app-tagline">降ってくるひらがなをあつめて、単語をつくろう</p>

      <input
        className="text-input"
        placeholder="なまえ(必須)"
        value={playerName}
        maxLength={20}
        required
        onChange={(e) => setPlayerName(e.target.value)}
        style={{ maxWidth: 280, marginBottom: nameMissing ? 4 : 8 }}
      />
      {nameMissing && <p className="form-error" style={{ marginBottom: 8 }}>なまえを入力してください</p>}

      {dawgError && <p className="form-error">辞書の読み込みに失敗しました: {dawgError}</p>}

      <div className="button-row">
        <button
          className="button button--primary button--block"
          disabled={!dawg || nameMissing}
          onClick={() => navigate('/game')}
        >
          {dawg ? 'ひとりで遊ぶ' : '辞書を読み込み中...'}
        </button>

        {!showMultiplayer ? (
          <button className="button button--secondary button--block" onClick={() => setShowMultiplayer(true)}>
            友だちと対戦
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!firebaseEnabled ? (
              <p style={{ fontSize: 13, color: 'var(--text-soft)' }}>
                対戦モードには Firebase の設定が必要です(.env.local を参照)。
              </p>
            ) : (
              <>
                <button
                  className="button button--secondary button--block"
                  disabled={busy || nameMissing}
                  onClick={handleCreateRoom}
                >
                  ルームをつくる
                </button>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="text-input"
                    placeholder="ルームコード"
                    value={roomCodeInput}
                    maxLength={6}
                    onChange={(e) => setRoomCodeInput(e.target.value)}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button
                    className="button button--secondary"
                    disabled={busy || nameMissing || !roomCodeInput}
                    onClick={handleJoinRoom}
                    style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    参加
                  </button>
                </div>
                {/* 終わったルームの戦績は、あとからルームコードだけで見返せる(なまえは不要) */}
                <button
                  className="text-link-button"
                  disabled={!roomCodeInput.trim()}
                  onClick={() => navigate(`/room/${roomCodeInput.trim().toUpperCase()}/history`)}
                >
                  このコードの せんせきを見る
                </button>

                {/*
                 * ルームコードは覚えておけないまま失われがちなので、入ったことのある
                 * ルームをここに残す。同じルームを使い回して遊べるようにするのが目的。
                 */}
                {recentRooms.length > 0 && (
                  <div className="recent-rooms">
                    <p className="recent-rooms-label">さいきんのルーム</p>
                    {recentRooms.map((room) => (
                      <div className="recent-room-row" key={room.roomId}>
                        <button
                          className="recent-room-enter"
                          disabled={busy || nameMissing}
                          onClick={() => handleRejoinRoom(room.roomId)}
                        >
                          <span className="recent-room-code">{room.roomId}</span>
                          <span className="recent-room-date">{formatJoinedAt(room.lastJoinedAt)}</span>
                        </button>
                        <button
                          className="text-link-button recent-room-history"
                          onClick={() => navigate(`/room/${room.roomId}/history`)}
                        >
                          せんせき
                        </button>
                        <button
                          className="recent-room-forget"
                          aria-label={`${room.roomId} を一覧から消す`}
                          onClick={() => setRecentRooms(forgetRoom(room.roomId))}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {error && <p className="form-error">{error}</p>}
          </div>
        )}
      </div>

      {firebaseEnabled && <AccountPanel />}

      <div className="footer-links">
        {firebaseEnabled && <Link to="/collection">ずかん</Link>}
        <Link to="/wordlist">単語一覧</Link>
        <Link to="/leaderboard">ランキング</Link>
        <Link to="/license">ライセンス</Link>
      </div>
      <p className="app-version">v{__APP_VERSION__}</p>
    </div>
  );
}
