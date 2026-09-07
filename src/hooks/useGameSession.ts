import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  advanceFallingLetters,
  createInitialFallingLettersState,
  createRng,
  removeLetterById,
  type FallingLetter,
} from '../game/fallingLetters';
import { Dawg } from '../game/dawg';
import { MAX_WORD_LENGTH, validateWord, type ValidationStatus } from '../game/wordValidator';
import { summarizeScore, type ScoreSummary, type ScoredWord } from '../game/scoring';

export interface WordFeedback {
  word: string;
  status: ValidationStatus | 'taken';
  points?: number;
}

export interface UseGameSessionOptions {
  dawg: Dawg | null;
  durationSec?: number;
  /** 対戦モード用の共有シード。省略時はランダム(ソロプレイ) */
  seed?: number;
  /**
   * 対戦モード用: ゲーム開始時刻(epoch ms)。指定すると経過時間を
   * `Date.now() - startAtEpochMs` から計算し、全員が同じ経過時間を共有できるようにする。
   * 省略時(ソロプレイ)は初回フレームからの相対時間を使う。
   */
  startAtEpochMs?: number;
  /** 対戦モード: 文字取得の排他制御(早い者勝ち)。falseを返した場合は取得できない */
  claimLetter?: (letterId: string) => Promise<boolean>;
  /** 対戦モードの参加人数。人数に応じて文字の出現量をスケールする(省略時は1人分) */
  playerCount?: number;
  onWordConfirmed?: (scored: ScoredWord) => void;
  onUnregisteredWord?: (word: string) => void;
  onFinish: (summary: ScoreSummary) => void;
}

export interface GameSession {
  remainingSeconds: number;
  elapsedMs: number;
  fallingLetters: FallingLetter[];
  currentWord: string;
  scoredWords: ScoredWord[];
  feedback: WordFeedback | null;
  isFinished: boolean;
  collectLetter: (letterId: string, char: string) => void;
  confirmWord: () => void;
  clearWord: () => void;
}

export function useGameSession(options: UseGameSessionOptions): GameSession {
  const { dawg, durationSec = 60, seed, startAtEpochMs, claimLetter, playerCount, onWordConfirmed, onUnregisteredWord, onFinish } = options;
  const durationMs = durationSec * 1000;

  // 対戦モードでは room.seed がFirebaseから届くまで `seed` がundefinedのまま
  // 最初のレンダリングを迎える。useRefの初期値はマウント時に一度きりしか
  // 評価されないため、ここでランダムseedを生成してしまうと対戦相手と食い違う
  // (もじふる降下パターンが対戦相手ごとに異なって見えるバグの原因だった)。
  // 実際に文字を降らせ始めるtickエフェクト側で、その時点の最新seedを使って
  // 遅延生成することで、room.seed確定後にのみrngを作るようにする。
  const rngRef = useRef<(() => number) | null>(null);
  // idPrefixも同じ理由(startAtEpochMsがマウント直後はまだ未確定)で、
  // useStateの遅延初期化に直接渡さずtickエフェクト側で確定させる。
  const idPrefixRef = useRef<string | null>(null);
  const [fallingState, setFallingState] = useState(() => createInitialFallingLettersState());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [scoredWords, setScoredWords] = useState<ScoredWord[]>([]);
  const [feedback, setFeedback] = useState<WordFeedback | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  const scoredWordsRef = useRef(scoredWords);
  scoredWordsRef.current = scoredWords;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const finishedRef = useRef(false);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!dawg) return;
    if (!rngRef.current) {
      rngRef.current = createRng(seed ?? Math.floor(Math.random() * 2 ** 31));
    }
    if (idPrefixRef.current === null) {
      idPrefixRef.current = startAtEpochMs !== undefined ? `t${startAtEpochMs}-` : '';
    }
    const rng = rngRef.current;
    const idPrefix = idPrefixRef.current;
    const lettersPerSpawn = Math.max(1, Math.min(6, playerCount ?? 1));
    let raf = 0;
    const tick = (now: number) => {
      let elapsed: number;
      if (startAtEpochMs !== undefined) {
        elapsed = Math.max(0, Date.now() - startAtEpochMs);
      } else {
        if (startRef.current === null) startRef.current = now;
        elapsed = now - startRef.current;
      }
      const clamped = Math.min(elapsed, durationMs);
      setElapsedMs(clamped);
      setFallingState((s) =>
        advanceFallingLetters(s.idPrefix === idPrefix ? s : { ...s, idPrefix }, clamped, rng, { lettersPerSpawn }),
      );
      if (elapsed < durationMs) {
        raf = requestAnimationFrame(tick);
      } else if (!finishedRef.current) {
        finishedRef.current = true;
        setIsFinished(true);
        onFinishRef.current(summarizeScore(scoredWordsRef.current));
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // dawgが読み込まれた時点でループを開始する(それまで文字は降ってこない)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dawg, durationMs]);

  const collectLetter = useCallback(
    (letterId: string, char: string) => {
      if (finishedRef.current) return;
      if (currentWord.length >= MAX_WORD_LENGTH) return;

      const applyLocally = () => {
        setFallingState((s) => removeLetterById(s, letterId));
        setCurrentWord((w) => w + char);
      };

      if (claimLetter) {
        claimLetter(letterId).then((ok) => {
          if (ok) {
            applyLocally();
          } else {
            // 対戦相手が先にこの文字を取得済み。タップが無反応に見えないよう、
            // 取れなかったことを明示的にフィードバックする。
            setFeedback({ word: char, status: 'taken' });
          }
        });
      } else {
        applyLocally();
      }
    },
    [claimLetter, currentWord.length],
  );

  const clearWord = useCallback(() => setCurrentWord(''), []);

  const confirmWord = useCallback(() => {
    if (!dawg || finishedRef.current || currentWord.length === 0) return;
    const result = validateWord(dawg, currentWord, scoredWordsRef.current);
    if (result.status === 'valid' && result.scored) {
      setScoredWords((words) => [...words, result.scored!]);
      setFeedback({ word: currentWord, status: 'valid', points: result.scored.totalPoints });
      onWordConfirmed?.(result.scored);
    } else {
      setFeedback({ word: currentWord, status: result.status });
      if (result.status === 'unregistered') onUnregisteredWord?.(currentWord);
    }
    setCurrentWord('');
  }, [currentWord, dawg, onUnregisteredWord, onWordConfirmed]);

  const remainingSeconds = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));

  return useMemo(
    () => ({
      remainingSeconds,
      elapsedMs,
      fallingLetters: fallingState.letters,
      currentWord,
      scoredWords,
      feedback,
      isFinished,
      collectLetter,
      confirmWord,
      clearWord,
    }),
    [remainingSeconds, elapsedMs, fallingState.letters, currentWord, scoredWords, feedback, isFinished, collectLetter, confirmWord, clearWord],
  );
}
