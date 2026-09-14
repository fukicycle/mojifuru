import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { signInAnonymouslyOnce } from '../firebase/config';
import { useRoomHistory } from '../hooks/useRoomHistory';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { ChipLoader, ChipTitle, DecoChips, EmptyChip } from './decor';
import { PlayerTotalsList, RoundHistoryList } from './roomHistoryParts';

type HistoryTab = 'totals' | 'rounds';

/** ルームコードを頼りに探しに来る画面なので、空のときは「見つからなかった」と伝える */
const NOT_FOUND_TEXT = 'このルームコードの きろくは みつかりませんでした';

const HISTORY_TABS: { tab: HistoryTab; label: string }[] = [
  { tab: 'totals', label: 'つうさん' },
  { tab: 'rounds', label: 'ラウンドごと' },
];

/**
 * ルームコードを頼りに、そのルームの戦績を見る画面。
 * ルーム自体は全員が退出すると消えるが、戦績は残るため、
 * あとから「あのときのルーム」を振り返れる。
 */
export default function RoomHistoryScreen() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { firebaseEnabled } = useGameContext();
  const [uid, setUid] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [tab, setTab] = useState<HistoryTab>('totals');

  useDocumentMeta(
    'ルームの戦績',
    'もじふるのルーム対戦の戦績です。ルームコードを入れると、ラウンドごとの順位とみんなが作った単語を見返せます。',
  );

  useEffect(() => {
    if (!firebaseEnabled) return;
    signInAnonymouslyOnce().then(setUid, () => setAuthFailed(true));
  }, [firebaseEnabled]);

  // 戦績の読み取りには匿名認証が要るため、uidが確定してから購読を始める
  const { rounds, error } = useRoomHistory(roomId, firebaseEnabled && uid !== null);

  if (!roomId) return null;

  // 直接このURLを開いた場合(履歴がない場合)は「もどる」先が無いのでタイトルへ返す
  const canGoBack = location.key !== 'default';

  if (!firebaseEnabled) {
    return (
      <div className="screen screen--center screen--decorated">
        <DecoChips />
        <EmptyChip mark="!" text="Firebaseが未設定のため、戦績は利用できません。" />
        <button className="button button--ghost button--block" onClick={() => navigate('/')}>
          タイトルへもどる
        </button>
      </div>
    );
  }

  return (
    <div className="screen screen--decorated">
      <DecoChips />

      <ChipTitle text="せんせき" caption={`ルーム ${roomId} のきろく`} />

      <div className="tab-row tab-row--track">
        {HISTORY_TABS.map((item) => (
          <button
            key={item.tab}
            className={'tab-button' + (tab === item.tab ? ' is-active' : '')}
            onClick={() => setTab(item.tab)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(error || authFailed) && (
        <p className="form-error" style={{ textAlign: 'center' }}>
          {error ?? '接続できませんでした。しばらくしてからもう一度ためしてください。'}
        </p>
      )}

      {rounds === null && !error && !authFailed && <ChipLoader text="きろくを よみこみ中..." />}

      {rounds !== null && (
        <>
          <div className="panel panel--scroll">
            {tab === 'totals' ? (
              <PlayerTotalsList rounds={rounds} selfUid={uid} emptyText={NOT_FOUND_TEXT} />
            ) : (
              <RoundHistoryList rounds={rounds} selfUid={uid} emptyText={NOT_FOUND_TEXT} />
            )}
          </div>
          {rounds.length > 0 && (
            <p className="screen-footnote">
              {tab === 'rounds'
                ? 'なまえをタップすると、そのひとの作ったことばが見られます'
                : `ぜんぶで ${rounds.length}ラウンドのきろく`}
            </p>
          )}
        </>
      )}

      <button
        className="button button--ghost button--block"
        style={{ margin: '0 auto' }}
        onClick={() => (canGoBack ? navigate(-1) : navigate('/'))}
      >
        {canGoBack ? 'もどる' : 'タイトルへもどる'}
      </button>
    </div>
  );
}
