import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { logAnalyticsPageView } from './firebase/config';
import TitleScreen from './components/TitleScreen';
import GameScreen from './components/GameScreen';
import ResultScreen from './components/ResultScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import WordListScreen from './components/WordListScreen';
import LicensePage from './components/LicensePage';
import RoomLobbyScreen from './components/RoomLobbyScreen';
import RoomResultScreen from './components/RoomResultScreen';
import UpdateNotice from './components/UpdateNotice';
import ReleaseNotesDialog from './components/ReleaseNotesDialog';

/** react-router-dom側のルート遷移(履歴API)はページ再読み込みを伴わないため、GA4のpage_viewを都度手動送信する */
function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    logAnalyticsPageView(location.pathname);
  }, [location.pathname]);

  return null;
}

export default function App() {
  useEffect(() => {
    // 軽い抑止のみ(開発者ツール自体の無効化は実効性が低いため不採用)
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  useEffect(() => {
    // iOS PWA(standalone)ではマルチタスク復帰後などにWebKitが100dvhを
    // 再計算しないままになる既知バグがあるため、visualViewportの実測値で
    // --app-vh を上書きして復帰のたびに強制的に再計算させる(index.css参照)。
    const visualViewport = window.visualViewport;
    let rafId = 0;

    const applyHeight = () => {
      if (document.visibilityState === 'hidden') return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const height = visualViewport?.height ?? window.innerHeight;
        document.documentElement.style.setProperty('--app-vh', `${height}px`);
      });
    };

    applyHeight();
    visualViewport?.addEventListener('resize', applyHeight);
    window.addEventListener('pageshow', applyHeight);
    window.addEventListener('focus', applyHeight);
    document.addEventListener('visibilitychange', applyHeight);

    return () => {
      cancelAnimationFrame(rafId);
      visualViewport?.removeEventListener('resize', applyHeight);
      window.removeEventListener('pageshow', applyHeight);
      window.removeEventListener('focus', applyHeight);
      document.removeEventListener('visibilitychange', applyHeight);
    };
  }, []);

  return (
    <GameProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div className="app-shell">
          <AnalyticsTracker />
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
          <ReleaseNotesDialog />
        </div>
      </BrowserRouter>
    </GameProvider>
  );
}
