import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { signInAnonymouslyOnce } from '../firebase/config';
import { createRoom, joinRoom } from '../firebase/room';

export default function TitleScreen() {
  const navigate = useNavigate();
  const { playerName, setPlayerName, firebaseEnabled, dawg, dawgError } = useGameContext();
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = playerName.trim();
  const nameMissing = trimmedName.length === 0;

  async function handleCreateRoom() {
    if (nameMissing) return;
    setBusy(true);
    setError(null);
    try {
      const uid = await signInAnonymouslyOnce();
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
      const uid = await signInAnonymouslyOnce();
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

  return (
    <div className="screen screen--center">
      <h1 className="app-logo">もじふる</h1>
      <p className="app-tagline">降ってくるひらがなであつめて、単語をつくろう</p>

      <input
        className="text-input"
        placeholder="なまえ(必須)"
        value={playerName}
        maxLength={20}
        required
        onChange={(e) => setPlayerName(e.target.value)}
        style={{ maxWidth: 280, marginBottom: nameMissing ? 4 : 8 }}
      />
      {nameMissing && (
        <p style={{ color: 'crimson', fontSize: 13, marginTop: 0, marginBottom: 8 }}>なまえを入力してください</p>
      )}

      {dawgError && <p style={{ color: 'crimson', fontSize: 13 }}>辞書の読み込みに失敗しました: {dawgError}</p>}

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
                  />
                  <button
                    className="button button--secondary"
                    disabled={busy || nameMissing || !roomCodeInput}
                    onClick={handleJoinRoom}
                  >
                    参加
                  </button>
                </div>
              </>
            )}
            {error && <p style={{ color: 'crimson', fontSize: 13 }}>{error}</p>}
          </div>
        )}
      </div>

      <div className="footer-links">
        <Link to="/wordlist">単語一覧</Link>
        <Link to="/leaderboard">ランキング</Link>
        <Link to="/license">ライセンス</Link>
      </div>
      <p className="app-version">v{__APP_VERSION__}</p>
    </div>
  );
}
