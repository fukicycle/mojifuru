import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Dawg, loadDawg } from '../game/dawg';
import type { ScoreSummary } from '../game/scoring';
import { isFirebaseConfigured } from '../firebase/config';

const PLAYER_NAME_KEY = 'mojifuru:playerName';

function loadStoredName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) ?? '';
  } catch {
    return '';
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
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [dawg, setDawg] = useState<Dawg | null>(null);
  const [dawgError, setDawgError] = useState<string | null>(null);
  const [playerName, setPlayerNameState] = useState(loadStoredName);
  const [lastResult, setLastResult] = useState<ScoreSummary | null>(null);

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
    }),
    [dawg, dawgError, playerName, lastResult],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameContext は GameProvider の内側でのみ使用できます');
  return ctx;
}
