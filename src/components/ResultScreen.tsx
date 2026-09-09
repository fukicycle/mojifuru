import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { signInAnonymouslyOnce } from '../firebase/config';
import { submitScore } from '../firebase/leaderboard';
import type { BonusTier } from '../game/scoring';
import { ChipTitle, DecoChips } from './decor';

function tierLabel(tier: BonusTier): string {
  if (tier === 'grand-bonus') return '大ボーナス';
  if (tier === 'bonus') return 'ボーナス';
  return '';
}

export default function ResultScreen() {
  const navigate = useNavigate();
  const { lastResult, playerName, firebaseEnabled } = useGameContext();
  // 'kept' は「自己ベストに届かなかった」= 正常終了。エラーとして見せない
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'updated' | 'kept' | 'error'>('idle');
  const [bestScore, setBestScore] = useState<number | null>(null);
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
        const result = await submitScore(uid, name, lastResult.totalScore);
        setBestScore(result.bestScore);
        setSubmitState(result.improved ? 'updated' : 'kept');
      } catch {
        setSubmitState('error');
      }
    })();
  }, [lastResult, firebaseEnabled, playerName]);

  if (!lastResult) return null;

  return (
    <div className="screen screen--decorated">
      <DecoChips />

      <ChipTitle text="けっか" />

      <div className="panel panel--text result-card">
        <div className="result-total">{lastResult.totalScore}点</div>
        <div className="result-stats">
          <span>成立 {lastResult.wordCount}語</span>
          <span>ボーナス {lastResult.bonusCount}回</span>
          <span>大ボーナス {lastResult.grandBonusCount}回</span>
        </div>
        {firebaseEnabled && submitState !== 'idle' && (
          <p className={`submit-status submit-status--${submitState}`}>
            {submitState === 'sending' && 'ランキングに登録中...'}
            {submitState === 'updated' && '自己ベスト更新!ランキングに登録しました'}
            {submitState === 'kept' &&
              (bestScore === null
                ? '自己ベストはそのままです'
                : `自己ベストは ${bestScore}点 のままです`)}
            {submitState === 'error' && 'ランキングへの登録に失敗しました'}
          </p>
        )}
      </div>

      <div className="panel panel--scroll">
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
