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

  const effectiveName = playerName.trim() || 'ななしさん';

  async function handleCreateRoom() {
    setBusy(true);
    setError(null);
    try {
      const uid = await signInAnonymouslyOnce();
      const roomId = await createRoom(uid, effectiveName);
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinRoom() {
    const roomId = roomCodeInput.trim().toUpperCase();
    if (!roomId) return;
    setBusy(true);
    setError(null);
    try {
      const uid = await signInAnonymouslyOnce();
      const room = await joinRoom(roomId, uid, effectiveName);
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
        placeholder="なまえ(ランキング表示用・省略可)"
        value={playerName}
        maxLength={20}
        onChange={(e) => setPlayerName(e.target.value)}
        style={{ maxWidth: 280, marginBottom: 8 }}
      />

      {dawgError && <p style={{ color: 'crimson', fontSize: 13 }}>辞書の読み込みに失敗しました: {dawgError}</p>}

      <div className="button-row">
        <button className="button button--primary button--block" disabled={!dawg} onClick={() => navigate('/game')}>
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
                <button className="button button--secondary button--block" disabled={busy} onClick={handleCreateRoom}>
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
                  <button className="button button--secondary" disabled={busy || !roomCodeInput} onClick={handleJoinRoom}>
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
    </div>
  );
}
