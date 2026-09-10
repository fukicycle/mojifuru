import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useGameContext } from '../context/GameContext';
import { ChipTitle } from './decor';
import { RELEASE_NOTES } from '../releaseNotes';

const LAST_SEEN_VERSION_KEY = 'mojifuru:lastSeenVersion';

function loadLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_VERSION_KEY);
  } catch {
    return null;
  }
}

function saveLastSeenVersion(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
  } catch {
    // localStorageが使えない環境でも致命的ではないため無視する
  }
}

/**
 * アップデート後の初回起動で、直前に見たバージョンと現在のバージョンを比べて
 * 変更点を一度だけ表示する。初回インストール時(記録が何もない状態)は
 * 「アップデート」ではないため出さず、現在のバージョンを既読として記録するだけにする。
 */
export default function ReleaseNotesDialog() {
  const { isPlaying } = useGameContext();
  const [visible, setVisible] = useState(false);

  // マウント後の最初のレンダーで一度だけ判定する(soloStartAtRefと同じ、
  // レンダー中に一回きりの遅延初期化をrefで済ませるパターン)。
  const checkedRef = useRef(false);
  if (!checkedRef.current) {
    checkedRef.current = true;
    const lastSeen = loadLastSeenVersion();
    if (lastSeen === null) {
      // 初回インストール時はアップデートではないため出さず、既読として記録するだけにする
      saveLastSeenVersion(__APP_VERSION__);
    } else if (lastSeen !== __APP_VERSION__) {
      setVisible(true);
    }
  }

  const note = RELEASE_NOTES.find((n) => n.version === __APP_VERSION__);

  // プレイ中に出ると操作の妨げになるため、UpdateNoticeと同様プレイが終わるまで表示だけ保留する
  if (!visible || isPlaying || !note) return null;

  const handleClose = (e: ReactPointerEvent) => {
    e.preventDefault();
    saveLastSeenVersion(__APP_VERSION__);
    setVisible(false);
  };

  return (
    <div className="release-notes-backdrop">
      <div className="release-notes-panel">
        <ChipTitle text="こうしん" caption={`v${__APP_VERSION__} の変更点`} />
        <ul className="release-notes-list">
          {note.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
        <button className="button button--primary button--block" onPointerDown={handleClose}>
          わかった!
        </button>
      </div>
    </div>
  );
}
