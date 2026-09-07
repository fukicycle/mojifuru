import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import TitleScreen from './components/TitleScreen';
import GameScreen from './components/GameScreen';
import ResultScreen from './components/ResultScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import WordListScreen from './components/WordListScreen';
import LicensePage from './components/LicensePage';
import RoomLobbyScreen from './components/RoomLobbyScreen';
import RoomResultScreen from './components/RoomResultScreen';
import UpdateNotice from './components/UpdateNotice';

export default function App() {
  useEffect(() => {
    // 軽い抑止のみ(開発者ツール自体の無効化は実効性が低いため不採用)
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  return (
    <GameProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<TitleScreen />} />
            <Route path="/game" element={<GameScreen mode="solo" />} />
            <Route path="/result" element={<ResultScreen />} />
            <Route path="/leaderboard" element={<LeaderboardScreen />} />
            <Route path="/wordlist" element={<WordListScreen />} />
            <Route path="/license" element={<LicensePage />} />
            <Route path="/room/:roomId" element={<RoomLobbyScreen />} />
            <Route path="/room/:roomId/play" element={<GameScreen mode="room" />} />
            <Route path="/room/:roomId/result" element={<RoomResultScreen />} />
          </Routes>
          <UpdateNotice />
        </div>
      </BrowserRouter>
    </GameProvider>
  );
}
