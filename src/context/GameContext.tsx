import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Dawg, loadDawg } from '../game/dawg';
import type { ScoreSummary } from '../game/scoring';
import { generateDefaultName } from '../game/nameGenerator';
import { isFirebaseConfigured } from '../firebase/config';
import { isSoundEnabled, setSoundEnabled as persistSoundEnabled } from '../audio/sfx';

const PLAYER_NAME_KEY = 'mojifuru:playerName';

/** 未設定なら親しみやすいデフォルト名を生成し、以後も使えるよう保存する */
function loadStoredName(): string {
  try {
    const stored = localStorage.getItem(PLAYER_NAME_KEY);
    if (stored) return stored;
    const generated = generateDefaultName();
    localStorage.setItem(PLAYER_NAME_KEY, generated);
    return generated;
  } catch {
    return generateDefaultName();
  }
}

interface GameContextValue {
  dawg: Dawg | null;
  dawgError: string | null;
  firebaseEnabled: boolean;
  playerName: string;
  setPlayerName: (name: string) => void;
  lastResult: ScoreSummary | null;
  setLastResult: (result: ScoreSummary | null) => void;
  /** プレイ中はアップデート通知など操作の妨げになるUIを出さないようにするためのフラグ */
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  soundEnabled: boolean;
  toggleSound: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [dawg, setDawg] = useState<Dawg | null>(null);
  const [dawgError, setDawgError] = useState<string | null>(null);
  const [playerName, setPlayerNameState] = useState(loadStoredName);
  const [lastResult, setLastResult] = useState<ScoreSummary | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundEnabled, setSoundEnabledState] = useState(isSoundEnabled);

  const toggleSound = () => {
    setSoundEnabledState((prev) => {
      const next = !prev;
      persistSoundEnabled(next);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    loadDawg()
      .then((d) => {
        if (!cancelled) setDawg(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setDawgError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPlayerName = (name: string) => {
    setPlayerNameState(name);
    try {
      localStorage.setItem(PLAYER_NAME_KEY, name);
    } catch {
      // localStorageが使えない環境でも致命的ではないため無視する
    }
  };

  const value = useMemo<GameContextValue>(
    () => ({
      dawg,
      dawgError,
      firebaseEnabled: isFirebaseConfigured(),
      playerName,
      setPlayerName,
      lastResult,
      setLastResult,
      isPlaying,
      setIsPlaying,
      soundEnabled,
      toggleSound,
    }),
    [dawg, dawgError, playerName, lastResult, isPlaying, soundEnabled],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameContext は GameProvider の内側でのみ使用できます');
  return ctx;
}
