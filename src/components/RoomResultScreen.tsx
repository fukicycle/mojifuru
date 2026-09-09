import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { leaveRoom, resetOwnRoundState, restartRoom, subscribeRoom, type Room } from '../firebase/room';
import { useGameContext } from '../context/GameContext';
import { signInAnonymouslyOnce } from '../firebase/config';
import type { BonusTier } from '../game/scoring';
import { ChipTitle, DecoChips, EmptyChip } from './decor';

const TOP_MEDALS = ['🥇', '🥈', '🥉'];

function tierLabel(tier: BonusTier): string {
  if (tier === 'grand-bonus') return '大ボーナス';
  if (tier === 'bonus') return 'ボーナス';
  return '';
}

export default function RoomResultScreen() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { firebaseEnabled, lastResult } = useGameContext();
  const [room, setRoom] = useState<Room | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  // ゲーム終了間際の「確定」連打の残りタップが、同じ画面位置にある
  // 「もう一度あそぶ」を誤って発火させないよう、遷移直後は操作を受け付けない。
  // ルーム対戦では全員を巻き込む再戦になるため、ソロ版より重要な対策。
  const [controlsReady, setControlsReady] = useState(false);
  // この結果画面に到達した時点のstartAt(今表示しているラウンドのもの)。
  // 誰かが再戦してstartAtが更新されたら、全員のこの画面がそれを検知し、
  // 自分のスコアだけリセットした上で(セキュリティルール上、本人のuidでしか書けない)
  // ロビーを経由せず直接プレイ画面へ進む。
  const initialStartAtRef = useRef<number | null | undefined>(undefined);
  const rematchHandledRef = useRef(false);

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

  // 誰か1人が「もう一度あそぶ」を押してstartAtが更新されたら、全員のこの画面が
  // それを検知する。ロビーには戻さず、自分のスコア・成立単語をリセットしてから
  // (セキュリティルール上、本人のuidでしか書き込めないため各自がここで行う)
  // 直接プレイ画面(カウントダウン)へ進む。
  useEffect(() => {
    if (!room) return;
    if (initialStartAtRef.current === undefined) {
      initialStartAtRef.current = room.startAt;
      return;
    }
    if (rematchHandledRef.current || !roomId || !uid) return;
    if (room.startAt !== initialStartAtRef.current) {
      rematchHandledRef.current = true;
      void resetOwnRoundState(roomId, uid);
      navigate(`/room/${roomId}/play`);
    }
  }, [room, roomId, uid, navigate]);

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
      <div className="screen screen--center screen--decorated">
        <DecoChips />
        <EmptyChip mark="!" text="Firebaseが未設定のため、対戦モードは利用できません。" />
        <button className="button button--ghost button--block" onClick={() => navigate('/')}>
          タイトルへもどる
        </button>
      </div>
    );
  }

  const ranked = Object.entries(room?.players ?? {}).sort(([, a], [, b]) => b.score - a.score);

  return (
    <div className="screen screen--decorated">
      <DecoChips />

      <ChipTitle text="けっか" caption="このラウンドのじゅんい" />

      <div className="panel" style={{ flex: '0 1 auto', maxHeight: '32vh', overflowY: 'auto' }}>
        {ranked.map(([uid, player], i) => (
          <div className={'leaderboard-row' + (i < 3 ? ' leaderboard-row--top10' : '')} key={uid}>
            <div className="leaderboard-rank">
              {i < 3 ? <span className="rank-medal">{TOP_MEDALS[i]}</span> : i + 1}
            </div>
            <div className="leaderboard-name">{player.name || 'ななしさん'}</div>
            <div className="leaderboard-score">{player.score}点</div>
          </div>
        ))}
      </div>

      {lastResult && (
        <div className="panel panel--scroll">
          <h3 className="panel-heading">じぶんの成立単語</h3>
          <table className="word-list-table">
            <thead>
              <tr>
                <th>単語</th>
                <th>点数</th>
              </tr>
            </thead>
            <tbody>
              {lastResult.words.map((w, i) => (
                <tr key={i}>
                  <td>
                    {w.word}
                    {w.bonusTier !== 'none' && (
                      <span className={`tier-tag tier-tag--${w.bonusTier}`}>{tierLabel(w.bonusTier)}</span>
                    )}
                  </td>
                  <td>{w.totalPoints}</td>
                </tr>
              ))}
              {lastResult.words.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ color: 'var(--text-soft)', textAlign: 'center' }}>
                    成立した単語はありませんでした
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {syncError && <p className="form-error" style={{ textAlign: 'center' }}>{syncError}</p>}

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
