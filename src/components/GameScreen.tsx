import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { useGameSession } from '../hooks/useGameSession';
import { fallingProgress, type FallingLetter } from '../game/fallingLetters';
import { MIN_WORD_LENGTH } from '../game/wordValidator';
import { currentComboMultiplier, type ScoreSummary } from '../game/scoring';
import { reportUnregisteredWord } from '../firebase/wordCandidates';
import { claimLetter as claimLetterInRoom, subscribeRoom, submitRoomWord, type Room } from '../firebase/room';
import { signInAnonymouslyOnce } from '../firebase/config';

const CHIP_COLORS = ['magenta', 'orange', 'aqua'] as const;

function colorForChar(char: string): (typeof CHIP_COLORS)[number] {
  let hash = 0;
  for (let i = 0; i < char.length; i++) hash = (hash * 31 + char.charCodeAt(i)) >>> 0;
  return CHIP_COLORS[hash % CHIP_COLORS.length];
}

interface GameScreenProps {
  mode: 'solo' | 'room';
}

export default function GameScreen({ mode }: GameScreenProps) {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { dawg, dawgError, setLastResult, playerName, firebaseEnabled, setIsPlaying } = useGameContext();

  const [room, setRoom] = useState<Room | null>(null);
  const uidRef = useRef<string | null>(null);
  const fallingFieldRef = useRef<HTMLDivElement | null>(null);
  const roomReady = mode === 'solo' || (room !== null && room.startAt !== null);
  const isPlayfieldReady = Boolean(dawg) && roomReady;

  // アップデート通知など操作の妨げになるUIを、実際にプレイ画面が表示されている間だけ抑止する
  useEffect(() => {
    if (!isPlayfieldReady) return;
    setIsPlaying(true);
    return () => setIsPlaying(false);
  }, [isPlayfieldReady, setIsPlaying]);

  useEffect(() => {
    if (mode !== 'room' || !roomId || !firebaseEnabled) return;
    let unsubscribe: (() => void) | undefined;
    signInAnonymouslyOnce().then((uid) => {
      uidRef.current = uid;
      unsubscribe = subscribeRoom(roomId, setRoom);
    });
    return () => unsubscribe?.();
  }, [mode, roomId, firebaseEnabled]);

  const handleClaimLetter = useCallback(
    (letterId: string) => {
      if (mode !== 'room' || !roomId || !uidRef.current) return Promise.resolve(true);
      return claimLetterInRoom(roomId, letterId, uidRef.current);
    },
    [mode, roomId],
  );

  const handleFinish = useCallback(
    (summary: ScoreSummary) => {
      setLastResult(summary);
      if (mode === 'room' && roomId) {
        navigate(`/room/${roomId}/result`);
      } else {
        navigate('/result');
      }
    },
    [mode, roomId, navigate, setLastResult],
  );

  const handleWordConfirmed = useCallback(
    (scored: { word: string; totalPoints: number }) => {
      if (mode === 'room' && roomId && uidRef.current) {
        void submitRoomWord(roomId, uidRef.current, scored.word, scored.totalPoints);
      }
    },
    [mode, roomId],
  );

  const handleUnregisteredWord = useCallback(
    (word: string) => {
      if (firebaseEnabled) void reportUnregisteredWord(word);
    },
    [firebaseEnabled],
  );

  const session = useGameSession({
    dawg: roomReady ? dawg : null,
    seed: mode === 'room' ? room?.seed : undefined,
    startAtEpochMs: mode === 'room' ? (room?.startAt ?? undefined) : undefined,
    claimLetter: mode === 'room' ? handleClaimLetter : undefined,
    playerCount: mode === 'room' ? room?.playerCountAtStart : undefined,
    onWordConfirmed: handleWordConfirmed,
    onUnregisteredWord: handleUnregisteredWord,
    onFinish: handleFinish,
  });

  const takenLetters = mode === 'room' ? room?.takenLetters : undefined;
  const visibleFallingLetters =
    mode === 'room' && takenLetters
      ? session.fallingLetters.filter((letter) => !takenLetters[letter.id])
      : session.fallingLetters;

  /*
   * 落下中の文字同士が接近/重なると、見た目の円(44px)より広い当たり判定(64px)が
   * 隣の文字の当たり判定と重なり合い、DOM描画順(後から出現した文字が上)に
   * よってタップが意図しない方の文字に奪われてしまう。
   * これを避けるため、各文字ボタン個別のヒットテストには頼らず、
   * プレイ面全体で1つのpointerdownを受け、タップ座標に最も近い中心を持つ文字を
   * 当たり判定半径内から選んで取得する方式にする。
   */
  const HIT_RADIUS_PX = 32;
  // elapsedMsが毎フレーム変わるため、useCallbackで包んでもメモ化の恩恵はない。
  const handleFieldPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const field = fallingFieldRef.current;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    let closest: FallingLetter | null = null;
    let closestDist = Infinity;
    for (const letter of visibleFallingLetters) {
      const progress = fallingProgress(letter, session.elapsedMs);
      const lx = letter.x * rect.width;
      const ly = (progress * 0.92 + 0.04) * rect.height;
      const dist = Math.hypot(px - lx, py - ly);
      if (dist < closestDist) {
        closestDist = dist;
        closest = letter;
      }
    }

    if (closest && closestDist <= HIT_RADIUS_PX) {
      e.preventDefault();
      session.collectLetter(closest.id, closest.char);
    }
  };

  if (mode === 'room' && !firebaseEnabled) {
    return (
      <div className="screen screen--center">
        <p style={{ color: 'var(--text-soft)' }}>Firebaseが未設定のため、対戦モードは利用できません。</p>
        <button className="button button--ghost button--block" onClick={() => navigate('/')}>
          タイトルへもどる
        </button>
      </div>
    );
  }

  if (dawgError) {
    return (
      <div className="screen screen--center">
        <p style={{ color: 'crimson' }}>辞書の読み込みに失敗しました: {dawgError}</p>
      </div>
    );
  }

  if (!dawg || !roomReady) {
    return (
      <div className="screen screen--center">
        <p>{mode === 'room' ? 'ホストの開始を待っています...' : '辞書を読み込み中...'}</p>
      </div>
    );
  }

  const canConfirm = session.currentWord.length >= MIN_WORD_LENGTH;
  const comboDecay = 1 - currentComboMultiplier(session.scoredWords);
  const players = mode === 'room' ? Object.entries(room?.players ?? {}) : [];

  return (
    <div className="screen">
      <div className="game-header">
        <div className="bonus-badge">5文字でボーナス!7文字で大ボーナス!!</div>
        <div className={`timer ${session.remainingSeconds <= 10 ? 'timer--urgent' : ''}`}>
          {session.remainingSeconds}秒
        </div>
      </div>

      {mode === 'room' && players.length > 0 && (
        <div className="player-avatars">
          {players.map(([uid, player]) => {
            const initial = (player.name || 'ゲ')[0];
            return (
              <div
                key={uid}
                className={`player-avatar player-avatar--${colorForChar(initial)} ${
                  uid === uidRef.current ? 'player-avatar--self' : ''
                }`}
                title={player.name || 'ななしさん'}
              >
                <span>{initial}</span>
                <span className="player-avatar-score">{player.score}</span>
              </div>
            );
          })}
        </div>
      )}

      <div
        className="falling-field"
        style={{ '--combo-decay': comboDecay } as CSSProperties}
        ref={fallingFieldRef}
        onPointerDown={handleFieldPointerDown}
      >
        <div className={`field-status field-status--${feedbackClass(session.feedback)}`}>
          {feedbackMessage(session.feedback)}
        </div>
        {visibleFallingLetters.map((letter: FallingLetter) => {
          const progress = fallingProgress(letter, session.elapsedMs);
          return (
            <div
              key={letter.id}
              className="letter-chip-hit"
              style={{ left: `${letter.x * 100}%`, top: `${progress * 92 + 4}%` }}
            >
              <span className={`letter-chip letter-chip--${colorForChar(letter.char)}`}>{letter.char}</span>
            </div>
          );
        })}
      </div>

      <div className="current-word-bar">
        <div className="current-word-slots">
          {session.currentWord ? (
            [...session.currentWord].map((ch, i) => (
              <span key={i} className={`letter-chip letter-chip--${colorForChar(ch)}`}>
                {ch}
              </span>
            ))
          ) : (
            <span style={{ color: 'var(--text-soft)', fontSize: 13 }}>文字をタップしてあつめよう</span>
          )}
        </div>
      </div>

      <div className="word-controls">
        <button
          className="button button--primary button--confirm"
          disabled={!canConfirm}
          onPointerDown={(e) => {
            // 落下中の文字と同様、click(pointerup後の遅延あるイベント)ではなく
            // pointerdownで即座に確定させ、反応の悪さを解消する。
            e.preventDefault();
            if (canConfirm) session.confirmWord();
          }}
        >
          この単語で確定
        </button>
        <button
          className="button button--ghost button--clear-all"
          disabled={!session.currentWord}
          onPointerDown={(e) => {
            e.preventDefault();
            if (session.currentWord) session.clearWord();
          }}
        >
          ぜんぶクリア
        </button>
      </div>

      <div className="score-strip">
        <span>
          得点: <strong>{session.scoredWords.reduce((s, w) => s + w.totalPoints, 0)}</strong>
        </span>
        <span>
          成立: <strong>{session.scoredWords.length}</strong>語
        </span>
        {playerName && <span>プレイヤー: {playerName}</span>}
      </div>
    </div>
  );
}

function feedbackClass(feedback: ReturnType<typeof useGameSession>['feedback']): string {
  if (!feedback) return 'empty';
  if (feedback.status === 'valid') return 'valid';
  return 'unregistered';
}

function feedbackMessage(feedback: ReturnType<typeof useGameSession>['feedback']): string {
  if (!feedback) return '';
  if (feedback.status === 'valid') return `「${feedback.word}」+${feedback.points}点!`;
  if (feedback.status === 'unregistered') return `「${feedback.word}」はなかった!`;
  if (feedback.status === 'taken') return `「${feedback.word}」はほかのプレイヤーが先にとりました!`;
  return '';
}
