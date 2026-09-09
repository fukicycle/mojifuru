import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { useGameSession, type WordFeedback } from '../hooks/useGameSession';
import { fallingProgress, type FallingLetter } from '../game/fallingLetters';
import { MIN_WORD_LENGTH } from '../game/wordValidator';
import {
  bonusTierForLength,
  currentComboMultiplier,
  BONUS_MIN_LENGTH,
  GRAND_BONUS_MIN_LENGTH,
  type BonusTier,
  type ScoreSummary,
} from '../game/scoring';
import { reportUnregisteredWord } from '../firebase/wordCandidates';
import {
  claimLetter as claimLetterInRoom,
  ROOM_COUNTDOWN_SECONDS,
  subscribeRoom,
  submitRoomWord,
  type Room,
} from '../firebase/room';
import { signInAnonymouslyOnce } from '../firebase/config';
import { beginGameAudio, endGameAudio, playSfx } from '../audio/sfx';

const CHIP_COLORS = ['magenta', 'orange', 'aqua'] as const;
const MAX_VISIBLE_AVATARS = 5;

function colorForChar(char: string): (typeof CHIP_COLORS)[number] {
  let hash = 0;
  for (let i = 0; i < char.length; i++) hash = (hash * 31 + char.charCodeAt(i)) >>> 0;
  return CHIP_COLORS[hash % CHIP_COLORS.length];
}

/**
 * 収集中の単語欄の色調。文字数が増えるほど、ボーナス成立(5文字)・大ボーナス成立(7文字)の
 * 配色に近づけていくことで、「あと何文字でボーナスか」を欄の色だけでも直感的に伝える。
 */
function wordHeatClass(length: number): 'empty' | 'cool' | 'warm' | BonusTier {
  if (length === 0) return 'empty';
  if (length >= GRAND_BONUS_MIN_LENGTH) return 'grand-bonus';
  if (length >= BONUS_MIN_LENGTH) return 'bonus';
  if (length >= 4) return 'warm';
  return 'cool';
}

interface GameScreenProps {
  mode: 'solo' | 'room';
}

export default function GameScreen({ mode }: GameScreenProps) {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { dawg, dawgError, setLastResult, firebaseEnabled, setIsPlaying, soundEnabled, toggleSound } =
    useGameContext();

  const [room, setRoom] = useState<Room | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const uidRef = useRef<string | null>(null);
  const fallingFieldRef = useRef<HTMLDivElement | null>(null);
  const roomReady = mode === 'solo' || (room !== null && room.startAt !== null);
  const isPlayfieldReady = Boolean(dawg) && roomReady;

  // 対戦モードでは「ゲーム開始」が押された瞬間(room.startAtが確定した瞬間)から
  // 一定秒数のカウントダウンを挟んでからプレイを始める。全員が同じroom.startAtから
  // 逆算するため、追加の同期なしにカウントダウンも全員一致する。
  const roomStartAt = mode === 'room' ? (room?.startAt ?? undefined) : undefined;
  // ソロプレイには同期対象がないため、辞書読み込み完了(dawgが揃った最初のレンダー)を
  // 起点にその場でカウントダウンの終了時刻を確定させる。useGameSession側のrng/idPrefix
  // 遅延生成(下記コメント参照)と同じ理由で、dawgが揃うのと同じレンダーで値を確定させる
  // 必要があるため、effectではなくレンダー中にrefへ書き込む一回きりの遅延初期化にしている。
  const soloStartAtRef = useRef<number | undefined>(undefined);
  if (mode === 'solo' && dawg && soloStartAtRef.current === undefined) {
    soloStartAtRef.current = Date.now() + ROOM_COUNTDOWN_SECONDS * 1000;
  }
  const gameStartAtEpochMs =
    mode === 'room'
      ? roomStartAt !== undefined
        ? roomStartAt + ROOM_COUNTDOWN_SECONDS * 1000
        : undefined
      : soloStartAtRef.current;
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (gameStartAtEpochMs === undefined) {
      setCountdownSeconds(null);
      return;
    }
    let raf = 0;
    const tick = () => {
      const remaining = gameStartAtEpochMs - Date.now();
      if (remaining <= 0) {
        setCountdownSeconds(null);
        return;
      }
      setCountdownSeconds(Math.ceil(remaining / 1000));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [gameStartAtEpochMs]);

  // カウントダウンの数字が切り替わるたびに音を鳴らし、0になった(=ゲーム開始)瞬間だけ
  // 別のスタート音を鳴らす。ソロ・対戦どちらもgameStartAtEpochMs起点で共通に動く。
  const prevCountdownRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevCountdownRef.current;
    prevCountdownRef.current = countdownSeconds;
    if (countdownSeconds !== null && countdownSeconds !== prev) {
      playSfx('countdownTick');
    } else if (countdownSeconds === null && prev !== null) {
      playSfx('countdownGo');
    }
  }, [countdownSeconds]);

  // iOSのサイレントスイッチを無視する 'playback' セッションは、宣言している間ユーザーが
  // 裏で流している音楽を止めてしまう。効果音を鳴らすのはこの画面だけなので、
  // 取得もこの画面の滞在中だけに限る(カウントダウン音に間に合うようマウント時から)。
  useEffect(() => {
    beginGameAudio();
    return () => endGameAudio();
  }, []);

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
      unsubscribe = subscribeRoom(roomId, setRoom, (error) =>
        setSyncError(`ルームの同期に失敗しました: ${error.message}`),
      );
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
    startAtEpochMs: gameStartAtEpochMs,
    claimLetter: mode === 'room' ? handleClaimLetter : undefined,
    playerCount: mode === 'room' ? room?.playerCountAtStart : undefined,
    onWordConfirmed: handleWordConfirmed,
    onUnregisteredWord: handleUnregisteredWord,
    onFinish: handleFinish,
  });

  // session.feedbackは確定のたびに新しいオブジェクトになる。これを検知してkeyを
  // 更新することで、同じ単語が連続してもポップアップが毎回再マウント→アニメーション
  // 再生されるようにする(レンダー中にrefと比較して更新する公式パターン)。
  const prevFeedbackRef = useRef<typeof session.feedback>(null);
  const [feedbackKey, setFeedbackKey] = useState(0);
  if (session.feedback && session.feedback !== prevFeedbackRef.current) {
    prevFeedbackRef.current = session.feedback;
    setFeedbackKey((k) => k + 1);
  }

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
        {syncError && <p style={{ color: 'crimson', fontSize: 13 }}>{syncError}</p>}
      </div>
    );
  }

  const canConfirm = session.currentWord.length >= MIN_WORD_LENGTH;
  const comboDecay = 1 - currentComboMultiplier(session.scoredWords);
  const players = mode === 'room' ? Object.entries(room?.players ?? {}) : [];
  const totalScore = session.scoredWords.reduce((s, w) => s + w.totalPoints, 0);

  // 対戦相手は補助情報のため、人数が増えても行が潰れないよう表示数の上限を設ける。
  // 自分のアバターは常に表示対象に含める(上位に入っていなければ枠を1つ譲る)。
  const sortedPlayers = [...players].sort(([, a], [, b]) => b.score - a.score);
  let visiblePlayers = sortedPlayers.slice(0, MAX_VISIBLE_AVATARS);
  if (uidRef.current && !visiblePlayers.some(([uid]) => uid === uidRef.current)) {
    const selfEntry = sortedPlayers.find(([uid]) => uid === uidRef.current);
    if (selfEntry) visiblePlayers = [...visiblePlayers.slice(0, MAX_VISIBLE_AVATARS - 1), selfEntry];
  }
  const hiddenPlayerCount = sortedPlayers.length - visiblePlayers.length;

  return (
    <div className="screen">
      <div className="hud-bar">
        <div className="score-display">
          <span className="score-display-label">とくてん</span>
          <span key={totalScore} className="score-display-value">
            {totalScore}
          </span>
          <span className="score-display-count">{session.scoredWords.length}語</span>
        </div>
        <div className="bonus-badge">5字でボーナス・7字で大ボーナス</div>
        <div className={`timer ${session.remainingSeconds <= 10 ? 'timer--urgent' : ''}`}>
          {session.remainingSeconds}秒
        </div>
        <button
          type="button"
          className="sound-toggle"
          aria-label={soundEnabled ? '効果音をオフにする' : '効果音をオンにする'}
          onClick={toggleSound}
        >
          {soundEnabled ? '🔊' : '🔇'}
        </button>
      </div>

      <div className="next-letters-preview">
        <span className="next-letters-label">つぎ</span>
        <div className="next-letters-chips">
          {session.upcomingChars.map((ch, i) => (
            <span
              key={i}
              className={`letter-chip letter-chip--${colorForChar(ch)} next-letters-chip next-letters-chip--${i}`}
            >
              {ch}
            </span>
          ))}
        </div>
      </div>

      {mode === 'room' && players.length > 0 && (
        <div className="player-avatars">
          {visiblePlayers.map(([uid, player]) => {
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
          {hiddenPlayerCount > 0 && (
            <div className="player-avatar player-avatar--more" title={`ほかに${hiddenPlayerCount}人`}>
              <span>+{hiddenPlayerCount}</span>
            </div>
          )}
        </div>
      )}

      <div
        className="falling-field"
        style={{ '--combo-decay': comboDecay } as CSSProperties}
        ref={fallingFieldRef}
        onPointerDown={handleFieldPointerDown}
      >
        {countdownSeconds !== null && (
          <div className="countdown-overlay">
            <span key={countdownSeconds} className="countdown-number">
              {countdownSeconds}
            </span>
          </div>
        )}
        {session.feedback && (
          <div
            key={feedbackKey}
            className={`field-status field-status--${feedbackClass(session.feedback)} field-status--tier-${feedbackTier(session.feedback)}`}
            style={{ '--pop-scale': feedbackPopScale(session.feedback) } as CSSProperties}
          >
            <span className="field-status-word">「{session.feedback.word}」</span>
            {session.feedback.status === 'valid' ? (
              <span className="field-status-points">+{session.feedback.points}点</span>
            ) : (
              <span className="field-status-message">{feedbackSubMessage(session.feedback)}</span>
            )}
          </div>
        )}
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
        <div className={`current-word-slots current-word-slots--${wordHeatClass(session.currentWord.length)}`}>
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
    </div>
  );
}

function feedbackClass(feedback: WordFeedback | null): string {
  if (!feedback) return 'empty';
  if (feedback.status === 'valid') return 'valid';
  if (feedback.status === 'taken') return 'taken';
  return 'unregistered';
}

function feedbackSubMessage(feedback: WordFeedback | null): string {
  if (!feedback) return '';
  if (feedback.status === 'unregistered') return 'はなかった!';
  if (feedback.status === 'taken') return 'はほかのプレイヤーが先にとりました!';
  return '';
}

/** 得点成立時のみボーナス段階を返す。マリオの1UPのように、段階が上がるほど演出を派手にする。 */
function feedbackTier(feedback: WordFeedback | null): BonusTier {
  if (!feedback || feedback.status !== 'valid') return 'none';
  return bonusTierForLength(feedback.word.length);
}

/** 得点が大きいほどポップ演出を大きく見せるための拡大率。 */
function feedbackPopScale(feedback: WordFeedback | null): number {
  if (!feedback || feedback.status !== 'valid' || !feedback.points) return 1;
  return Math.min(1.6, 1 + feedback.points / 200);
}
