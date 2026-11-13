import { useUpdate } from '../update/useUpdate';
import Icon from './Icon';

/**
 * おしらせ(風鈴)。タイトル画面の右上に常に置く。
 * 新しい版があり、まだ開いていないときは点を1つ付ける(数字は出さない)。
 *
 * 開くと画面の上にシートが重なるため、操作方針の例外として click で受ける
 * (pointerdown で開くと、同じタップの click が開いたシートの膜に届いて、すぐ閉じてしまう)。
 */
export default function NoticeButton() {
  const { unread, openSheet } = useUpdate();
  return (
    <button
      type="button"
      className="notice-button"
      aria-label={unread ? 'おしらせ(新しいおしらせがあります)' : 'おしらせ'}
      onClick={openSheet}
    >
      <Icon name="notify" size={22} />
      {unread && <span className="notice-badge" aria-hidden="true" />}
    </button>
  );
}
