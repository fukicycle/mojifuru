import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { ensureSignedIn, getFirebaseAuth } from '../firebase/config';
import { submitScore } from '../firebase/leaderboard';
import { recordFoundWords } from '../firebase/wordCollection';
import { isRareWord } from '../game/rareWords';
import type { BonusTier } from '../game/scoring';
import { ChipTitle, DecoChips, EmptyChip, WordChips } from './decor';

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
  // 自己ベストを更新した匿名ユーザーにだけ、記録を引き継げることを知らせる(毎回出すとうるさいため)
  const [anonymous, setAnonymous] = useState(false);
  // このプレイで はじめて ずかんに入った ことば
  const [newWords, setNewWords] = useState<string[]>([]);
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
        const uid = await ensureSignedIn();
        const result = await submitScore(uid, name, lastResult.totalScore);
        setBestScore(result.bestScore);
        setAnonymous(getFirebaseAuth().currentUser?.isAnonymous ?? false);
        setSubmitState(result.improved ? 'updated' : 'kept');
        // ずかんは付帯機能なので、記録に失敗してもランキング登録の結果表示は変えない
        recordFoundWords(uid, lastResult.words.map((w) => w.word))
          .then(setNewWords)
          .catch((error: unknown) => {
            console.error('[mojifuru] ずかんの記録に失敗しました', error);
          });
      } catch {
        setSubmitState('error');
      }
    })();
  }, [lastResult, firebaseEnabled, playerName]);

  const newWordSet = useMemo(() => new Set(newWords), [newWords]);

  if (!lastResult) return null;

  return (
    <div className="screen screen--decorated result-screen">
      <DecoChips />

      <ChipTitle text="けっか" />

      <div className="panel panel--text result-card">
        <div className="result-headline">
          <span className="result-total">{lastResult.totalScore}点</span>
          <span className="result-stats">
            <span>成立 {lastResult.wordCount}語</span>
            <span>ボーナス {lastResult.bonusCount}回</span>
            <span>大 {lastResult.grandBonusCount}回</span>
          </span>
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
        {submitState === 'updated' && anonymous && (
          <p className="account-hint" style={{ marginTop: 6 }}>
            タイトルの「Googleでつづける」で、きろくを ほかの端末にも ひきつげます
          </p>
        )}
      </div>

      {/*
       * ずかんに入ったことは、下の一覧の「はじめて」タグで1語ずつ分かる。
       * ここは語数とずかんへの導線だけを持つ1行の帯にして、一覧の高さを譲る
       * (同じことばを2つのカードに並べると、どちらも潰れて見づらかった)。
       */}
      {newWords.length > 0 && (
        <div className="discovery-bar">
          <span className="discovery-bar-text">
            <span aria-hidden="true">✨</span> はじめて見つけた ことば {newWords.length}語
          </span>
          <button className="text-link-button discovery-bar-link" onClick={() => navigate('/collection')}>
            ずかんを見る
          </button>
        </div>
      )}

      <div className="panel panel--scroll">
        {lastResult.words.length === 0 ? (
          <EmptyChip mark="?" text="成立した ことばは ありませんでした" />
        ) : (
          <ul className="word-pill-list">
            {lastResult.words.map((w, i) => (
              <li className="word-pill" key={i}>
                <WordChips word={w.word} />
                {w.bonusTier !== 'none' && (
                  <span className={`tier-tag tier-tag--${w.bonusTier}`}>{tierLabel(w.bonusTier)}</span>
                )}
                {isRareWord(w.word) && <span className="tier-tag tier-tag--rare">レア</span>}
                {/* 「はじめて」は上の帯と同じ✨だけで示す。全行に文字のタグが並ぶと、
                    ことばそのものが押し出されて読めなくなる */}
                {newWordSet.has(w.word) && (
                  <span className="tier-tag tier-tag--new" title="はじめて見つけた ことば">
                    <span aria-hidden="true">✨</span>
                    <span className="visually-hidden">はじめて</span>
                  </span>
                )}
                <span className="word-pill-points">+{w.totalPoints}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="result-actions">
        <button
          className="button button--primary button--block"
          disabled={!controlsReady}
          onClick={() => navigate('/game')}
        >
          もう一度あそぶ
        </button>
        <div className="result-actions-row">
          {firebaseEnabled && (
            <button
              className="button button--secondary button--block"
              disabled={!controlsReady}
              onClick={() => navigate('/leaderboard')}
            >
              ランキング
            </button>
          )}
          <button
            className="button button--ghost button--block"
            disabled={!controlsReady}
            onClick={() => navigate('/')}
          >
            タイトルへ
          </button>
        </div>
      </div>
    </div>
  );
}
