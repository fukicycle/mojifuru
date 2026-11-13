import { createContext } from 'react';
import type { ReleaseNote } from '../releaseNotes';

export interface UpdateState {
  /** 新しい版が待っている */
  updateAvailable: boolean;
  /** 新しい版のバージョン(変更点が読み込めなかったときは null) */
  nextVersion: string | null;
  /** 新しい版の変更点(新しい順)。読み込み中・失敗時は空 */
  pendingNotes: ReleaseNote[];
  notesStatus: 'idle' | 'loading' | 'ready' | 'error';
  /** まだ開いていないおしらせがある(風鈴の点) */
  unread: boolean;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  applyUpdate: () => void;
}

export const UpdateContext = createContext<UpdateState | null>(null);
