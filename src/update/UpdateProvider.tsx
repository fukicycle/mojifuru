import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { pendingUpdateNotes, type ReleaseNote } from '../releaseNotes';
import { saveLastSeenVersion } from '../storage/lastSeenVersion';
import { UpdateContext, type UpdateState } from './updateContext';

/*
 * 新しい版のおしらせ。
 * - 新しい版は自動で切り替えない。バナーやポップアップも出さない
 * - 見つけたら、タイトル画面右上の風鈴(おしらせ)に点を付けて気づかせる
 * - おしらせを開くと、新しい版の変更点を読んでから、すきなときに[こうしんする]を押せる
 * - タイトル画面のバージョン表示の横にも「あたらしい版があります」を出す
 */

// GitHub Pagesの静的配信ではSWの更新確認がページ遷移時などに限られ、
// タブを開きっぱなしのユーザには新バージョンが長時間届かないことがあるため、
// 一定間隔でも能動的に更新を確認する。
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** おしらせを開いて読んだ、新しい版のバージョン(点を消すための記録) */
const NOTICE_READ_KEY = 'mojifuru:noticeReadVersion';
/** 新しい版のバージョンが読み込めなかったときの、読んだ印 */
const UNKNOWN_VERSION = 'unknown';

function loadNoticeRead(): string | null {
  try {
    return localStorage.getItem(NOTICE_READ_KEY);
  } catch {
    return null;
  }
}

function saveNoticeRead(version: string): void {
  try {
    localStorage.setItem(NOTICE_READ_KEY, version);
  } catch {
    // 保存できなくても、点が次回も出るだけなので無視する
  }
}

export function UpdateProvider({ children }: { children: ReactNode }) {
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

  // 新しい版の変更点を読んだ結果。まだ無ければ「読み込み中」
  const [notesResult, setNotesResult] = useState<{ status: 'ready' | 'error'; notes: ReleaseNote[] } | null>(null);
  const [noticeRead, setNoticeRead] = useState(loadNoticeRead);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 新しい版を見つけたら、その版の変更点を配信先から読む。
  // release-notes.json はSWの事前キャッシュにも入るが、クエリを付けると事前キャッシュと
  // 一致しなくなり、配信中の最新が届く。
  useEffect(() => {
    if (!needRefresh) return;
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}release-notes.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<{ notes: ReleaseNote[] }>) : Promise.reject(res.status)))
      .then((data) => {
        if (!cancelled) setNotesResult({ status: 'ready', notes: pendingUpdateNotes(data.notes ?? [], __APP_VERSION__) });
      })
      .catch(() => {
        if (!cancelled) setNotesResult({ status: 'error', notes: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [needRefresh]);

  const notesStatus: UpdateState['notesStatus'] = !needRefresh ? 'idle' : (notesResult?.status ?? 'loading');
  const pendingNotes = useMemo(() => notesResult?.notes ?? [], [notesResult]);
  const nextVersion = pendingNotes[0]?.version ?? null;
  const readMark = nextVersion ?? UNKNOWN_VERSION;
  const unread = needRefresh && notesStatus !== 'loading' && noticeRead !== readMark;

  const openSheet = useCallback(() => {
    setSheetOpen(true);
    if (needRefresh && notesStatus !== 'loading') {
      saveNoticeRead(readMark);
      setNoticeRead(readMark);
    }
  }, [needRefresh, notesStatus, readMark]);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const applyUpdate = useCallback(() => {
    // 変更点は更新する前に読んでいるので、更新後のリリースノートでは同じものを出さない
    // (版が分からなかったときは、更新後にリリースノートで見せる)
    if (nextVersion) saveLastSeenVersion(nextVersion);
    void updateServiceWorker(true);
  }, [nextVersion, updateServiceWorker]);

  const value = useMemo<UpdateState>(
    () => ({
      updateAvailable: needRefresh,
      nextVersion,
      pendingNotes,
      notesStatus,
      unread,
      sheetOpen,
      openSheet,
      closeSheet,
      applyUpdate,
    }),
    [needRefresh, nextVersion, pendingNotes, notesStatus, unread, sheetOpen, openSheet, closeSheet, applyUpdate],
  );

  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>;
}
