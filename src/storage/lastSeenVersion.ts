/**
 * 変更点(リリースノート)を見たところまでのバージョン。
 * アップデート後の初回起動で出すリリースノート(ReleaseNotesDialog)と、
 * おしらせから更新したとき(更新前にもう読んでいるので、更新後に同じものを出さない)の両方で使う。
 */
const LAST_SEEN_VERSION_KEY = 'mojifuru:lastSeenVersion';

export function loadLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_VERSION_KEY);
  } catch {
    return null;
  }
}

export function saveLastSeenVersion(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
  } catch {
    // localStorageが使えない環境でも致命的ではないため無視する
  }
}
