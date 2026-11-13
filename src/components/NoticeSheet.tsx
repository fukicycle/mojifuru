import { useUpdate } from '../update/useUpdate';
import { ChipTitle, EmptyChip } from './decor';

/**
 * おしらせの中身。新しい版があれば、その変更点と[こうしんする]を出す。
 * 閉じるとシートが消えるので、ReleaseNotesDialog と同じ理由で click で受ける。
 */
export default function NoticeSheet() {
  const { sheetOpen, closeSheet, updateAvailable, nextVersion, pendingNotes, notesStatus, applyUpdate } = useUpdate();
  if (!sheetOpen) return null;

  return (
    <div className="release-notes-backdrop" onClick={closeSheet}>
      <div
        className="release-notes-panel notice-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="おしらせ"
        onClick={(e) => e.stopPropagation()}
      >
        <ChipTitle text="おしらせ" spark={false} />

        {updateAvailable ? (
          <>
            <p className="notice-update-title">
              {nextVersion ? `あたらしい版 v${nextVersion} があります` : 'あたらしい版があります'}
            </p>
            {notesStatus === 'loading' && <p className="notice-note">変更点を よみこみ中...</p>}
            {notesStatus === 'error' && (
              <p className="notice-note">変更点を よみこめませんでした。更新したあとに見られます。</p>
            )}
            {pendingNotes.map((note) => (
              <div className="release-notes-group" key={note.version}>
                {pendingNotes.length > 1 && <p className="release-notes-version">v{note.version}</p>}
                <ul className="release-notes-list">
                  {note.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="notice-note">更新すると、アプリが読みこみ直されます。</p>
            <div className="notice-actions">
              <button className="button button--primary button--block" onClick={applyUpdate}>
                こうしんする
              </button>
              <button className="button button--ghost button--block" onClick={closeSheet}>
                あとで
              </button>
            </div>
          </>
        ) : (
          <>
            <EmptyChip mark="ふ" text="いまは おしらせはありません" />
            <p className="notice-note">いまの版は v{__APP_VERSION__} です。</p>
            <button className="button button--ghost button--block" onClick={closeSheet}>
              とじる
            </button>
          </>
        )}
      </div>
    </div>
  );
}
