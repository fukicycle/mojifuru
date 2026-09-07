import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { signInAnonymouslyOnce } from '../firebase/config';
import { submitScore } from '../firebase/leaderboard';
import type { BonusTier } from '../game/scoring';

function tierLabel(tier: BonusTier): string {
  if (tier === 'grand-bonus') return '大ボーナス';
  if (tier === 'bonus') return 'ボーナス';
  return '';
}

export default function ResultScreen() {
  const navigate = useNavigate();
  const { lastResult, playerName, firebaseEnabled } = useGameContext();
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const submittedRef = useRef(false);
  // プレイ終了間際は「確定」ボタンを連打しがちで、その残り連打がそのまま
  // 同じ画面位置にある「もう一度あそぶ」を誤タップしてしまう事故を防ぐため、
  // 遷移直後の短い間だけボタン操作を受け付けない。
  const [controlsReady, setControlsReady] = useState(false);

  useEffect(() => {
    if (!lastResult) navigate('/', { replace: true });
  }, [lastResult, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => setControlsReady(true), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!lastResult || !firebaseEnabled || submittedRef.current) return;
    submittedRef.current = true;
    const name = playerName.trim();
    setSubmitState('sending');
    (async () => {
      try {
        const uid = await signInAnonymouslyOnce();
        await submitScore(uid, name, lastResult.totalScore);
        setSubmitState('done');
      } catch {
        setSubmitState('error');
      }
    })();
  }, [lastResult, firebaseEnabled, playerName]);

  if (!lastResult) return null;

  return (
    <div className="screen">
      <h2 style={{ textAlign: 'center' }}>けっか</h2>
      <div style={{ textAlign: 'center' }}>
        <div className="result-total">{lastResult.totalScore}点</div>
        <div className="result-stats" style={{ justifyContent: 'center', marginTop: 4 }}>
          <span>成立 {lastResult.wordCount}語</span>
          <span>ボーナス {lastResult.bonusCount}回</span>
          <span>大ボーナス {lastResult.grandBonusCount}回</span>
        </div>
        {firebaseEnabled && (
          <p style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 6 }}>
            {submitState === 'sending' && 'ランキングに登録中...'}
            {submitState === 'done' && 'ランキングに登録しました!'}
            {submitState === 'error' && 'ランキングへの登録に失敗しました'}
          </p>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
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

      <div className="button-row" style={{ margin: '0 auto' }}>
        {firebaseEnabled && (
          <button
            className="button button--secondary button--block"
            disabled={!controlsReady}
            onClick={() => navigate('/leaderboard')}
          >
            ランキングを見る
          </button>
        )}
        <button
          className="button button--primary button--block"
          disabled={!controlsReady}
          onClick={() => navigate('/game')}
        >
          もう一度あそぶ
        </button>
        <button
          className="button button--ghost button--block"
          disabled={!controlsReady}
          onClick={() => navigate('/')}
        >
          タイトルへ
        </button>
      </div>
    </div>
  );
}
