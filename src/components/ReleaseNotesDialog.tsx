import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useGameContext } from '../context/GameContext';
import { ChipTitle } from './decor';
import { notesSince, RELEASE_NOTES, type ReleaseNote } from '../releaseNotes';

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
 * アップデート後の初回起動で、直前に見たバージョンより新しい変更点を一度だけ表示する。
 *
 * 現在のバージョンぶんだけを出すと、途中のバージョンを飛ばして更新した人
 * (例: 0.9.8 → 0.9.10、更新に気づかず何日か空いた場合など)がその間の変更点を
 * 一度も見られないため、溜まっているぶんをまとめて出す。
 * 初回インストール時(記録が何もない状態)は「アップデート」ではないため出さず、
 * 現在のバージョンを既読として記録するだけにする。
 */
export default function ReleaseNotesDialog() {
  const { isPlaying } = useGameContext();
  const [notes, setNotes] = useState<ReleaseNote[]>([]);

  // マウント後の最初のレンダーで一度だけ判定する(soloStartAtRefと同じ、
  // レンダー中に一回きりの遅延初期化をrefで済ませるパターン)。
  const checkedRef = useRef(false);
  if (!checkedRef.current) {
    checkedRef.current = true;
    const pending = notesSince(RELEASE_NOTES, loadLastSeenVersion(), __APP_VERSION__);
    if (pending.length > 0) {
      setNotes(pending);
    } else {
      // 初回インストール、または出す変更点がないバージョン。記録だけ現在に合わせておく
      // (合わせておかないと、次に変更点のあるバージョンで古いノートまで出てしまう)。
      saveLastSeenVersion(__APP_VERSION__);
    }
  }

  // プレイ中に出ると操作の妨げになるため、UpdateNoticeと同様プレイが終わるまで表示だけ保留する
  if (notes.length === 0 || isPlaying) return null;

  const handleClose = (e: ReactPointerEvent) => {
    e.preventDefault();
    saveLastSeenVersion(__APP_VERSION__);
    setNotes([]);
  };

  const caption =
    notes.length === 1 ? `v${notes[0].version} の変更点` : `v${__APP_VERSION__} までの変更点`;

  return (
    <div className="release-notes-backdrop">
      <div className="release-notes-panel">
        <ChipTitle text="こうしん" caption={caption} />
        {notes.map((note) => (
          <div className="release-notes-group" key={note.version}>
            {/* 1バージョンだけのときは、どの版かはキャプションで分かるので見出しを出さない */}
            {notes.length > 1 && <p className="release-notes-version">v{note.version}</p>}
            <ul className="release-notes-list">
              {note.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
        <button className="button button--primary button--block" onPointerDown={handleClose}>
          わかった!
        </button>
      </div>
    </div>
  );
}
