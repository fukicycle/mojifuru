import { useRegisterSW } from 'virtual:pwa-register/react';
import { useGameContext } from '../context/GameContext';

// GitHub Pagesの静的配信ではSWの更新確認がページ遷移時などに限られ、
// タブを開きっぱなしのユーザには新バージョンが長時間届かないことがあるため、
// 一定間隔でも能動的に更新を確認する。
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export default function UpdateNotice() {
  const { isPlaying } = useGameContext();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        registration.update();
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  // プレイ中に出るとリロードを誘発して操作の妨げになるため、
  // 検知はしておきつつプレイが終わるまで表示だけ保留する
  if (!needRefresh || isPlaying) return null;

  return (
    <div className="update-notice">
      <p>新しいバージョンがあります</p>
      <button className="button button--secondary" onClick={() => updateServiceWorker(true)}>
        今すぐ更新
      </button>
    </div>
  );
}
