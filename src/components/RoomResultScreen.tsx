import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { leaveRoom, resetOwnRoundState, restartRoom, subscribeRoom, type Room } from '../firebase/room';
import { roundHistoryKey } from '../firebase/roomHistory';
import { useGameContext } from '../context/GameContext';
import { ensureSignedIn } from '../firebase/config';
import { useRoomHistory } from '../hooks/useRoomHistory';
import { rememberRoom } from '../storage/recentRooms';
import { rankRoundPlayers, type RoundPlayerRecord } from '../game/roomStats';
import { ChipLoader, ChipTitle, DecoChips, EmptyChip } from './decor';
import { PlayerTotalsList, RoundHistoryList, RoundPlayerList } from './roomHistoryParts';

type ResultTab = 'round' | 'totals' | 'history';

const RESULT_TABS: { tab: ResultTab; label: string }[] = [
  { tab: 'round', label: 'このラウンド' },
  { tab: 'totals', label: 'つうさん' },
  { tab: 'history', label: 'きろく' },
];

function tabCaption(tab: ResultTab): string {
  if (tab === 'totals') return 'このルームの つうさん成績';
  if (tab === 'history') return 'これまでの ラウンド';
  return 'このラウンドのじゅんい';
}

export default function RoomResultScreen() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { firebaseEnabled, lastResult, playerName } = useGameContext();
  const [room, setRoom] = useState<Room | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [tab, setTab] = useState<ResultTab>('round');
  // ゲーム終了間際の「確定」連打の残りタップが、同じ画面位置にある
  // 「もう一度あそぶ」を誤って発火させないよう、遷移直後は操作を受け付けない。
  // ルーム対戦では全員を巻き込む再戦になるため、ソロ版より重要な対策。
  const [controlsReady, setControlsReady] = useState(false);
  // この結果画面に到達した時点のstartAt(今表示しているラウンドのもの)。
  // 誰かが再戦してstartAtが更新されたら、全員のこの画面がそれを検知し、
  // 自分のスコアだけリセットした上で(セキュリティルール上、本人のuidでしか書けない)
  // ロビーを経由せず直接プレイ画面へ進む。
  const initialStartAtRef = useRef<number | null | undefined>(undefined);
  const rematchHandledRef = useRef(false);

  useEffect(() => {
    if (!firebaseEnabled) return;
    ensureSignedIn().then(setUid);
  }, [firebaseEnabled]);

  useEffect(() => {
    const timer = setTimeout(() => setControlsReady(true), 800);
    return () => clearTimeout(timer);
  }, []);

  // 遊んだルームほど上に出したいので、ラウンドが終わるたびに控え直す
  useEffect(() => {
    if (roomId) rememberRoom(roomId);
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !firebaseEnabled) return;
    return subscribeRoom(roomId, setRoom, (error) =>
      setSyncError(`ルームの同期に失敗しました: ${error.message}`),
    );
  }, [roomId, firebaseEnabled]);

  // 戦績(過去のラウンド)の読み取りには匿名認証が要るため、uidが確定してから購読する
  const { rounds, error: historyError } = useRoomHistory(roomId, firebaseEnabled && uid !== null);

  // 誰か1人が「もう一度あそぶ」を押してstartAtが更新されたら、全員のこの画面が
  // それを検知する。ロビーには戻さず、自分のスコア・成立単語をリセットしてから
  // (セキュリティルール上、本人のuidでしか書き込めないため各自がここで行う)
  // 直接プレイ画面(カウントダウン)へ進む。
  useEffect(() => {
    if (!room) return;
    if (initialStartAtRef.current === undefined) {
      initialStartAtRef.current = room.startAt;
      return;
    }
    if (rematchHandledRef.current || !roomId || !uid) return;
    if (room.startAt !== initialStartAtRef.current) {
      rematchHandledRef.current = true;
      void resetOwnRoundState(roomId, uid);
      navigate(`/room/${roomId}/play`);
    }
  }, [room, roomId, uid, navigate]);

  /*
   * このラウンドの順位表。
   * ルーム上の players はリアルタイムだが、先にタイトルへ戻った人は消えてしまう。
   * 一方、戦績に残した記録はラウンド終了時点のまま残る。両方を重ね、
   * 「まだ記録が届いていない人は生の値・退出した人は記録」で表示できるようにする。
   */
  const roundStartAt = room?.startAt ?? null;
  const livePlayers = room?.players;

  const archivedRound = useMemo(() => {
    if (!rounds || roundStartAt === null) return undefined;
    const key = roundHistoryKey(roundStartAt);
    return rounds.find((r) => r.id === key);
  }, [rounds, roundStartAt]);

  const roundPlayers = useMemo(() => {
    const merged: Record<string, RoundPlayerRecord> = {};
    for (const [playerUid, player] of Object.entries(livePlayers ?? {})) {
      merged[playerUid] = { name: player.name, score: player.score, words: player.wordsFormed };
    }
    Object.assign(merged, archivedRound?.players ?? {});
    // 自分のぶんだけは手元の結果を優先する(Firebaseへの書き込みが遅れていても、
    // 自分の作ったことばはすぐ出す)
    if (uid && lastResult) {
      const mine = merged[uid];
      if ((mine?.words?.length ?? 0) < lastResult.words.length) {
        merged[uid] = {
          name: mine?.name || playerName.trim(),
          score: Math.max(mine?.score ?? 0, lastResult.totalScore),
          words: lastResult.words.map((w) => w.word),
        };
      }
    }
    return rankRoundPlayers(merged);
  }, [livePlayers, archivedRound, uid, lastResult, playerName]);

  if (!roomId) return null;

  async function handleRematch() {
    setRestarting(true);
    try {
      await restartRoom(roomId!);
    } catch (error) {
      setSyncError(`再戦の開始に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRestarting(false);
    }
  }

  if (!firebaseEnabled) {
    return (
      <div className="screen screen--center screen--decorated">
        <DecoChips />
        <EmptyChip mark="!" text="Firebaseが未設定のため、対戦モードは利用できません。" />
        <button className="button button--ghost button--block" onClick={() => navigate('/')}>
          タイトルへもどる
        </button>
      </div>
    );
  }

  return (
    <div className="screen screen--decorated">
      <DecoChips />

      <ChipTitle text="けっか" caption={tabCaption(tab)} />

      <div className="tab-row tab-row--track">
        {RESULT_TABS.map((item) => (
          <button
            key={item.tab}
            className={'tab-button' + (tab === item.tab ? ' is-active' : '')}
            onClick={() => setTab(item.tab)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="panel panel--scroll">
        {/* uidは匿名認証のあとに届く。keyで作り直して「自分の行を開いた状態」を反映させる */}
        {tab === 'round' && (
          <RoundPlayerList key={uid ?? 'anon'} players={roundPlayers} selfUid={uid} defaultOpenUid={uid} />
        )}
        {/* 戦績(過去のラウンド)はFirebaseから届くまで空にせず、読み込み中を見せる */}
        {tab !== 'round' && rounds === null && <ChipLoader text="きろくを よみこみ中..." />}
        {tab === 'totals' && rounds !== null && <PlayerTotalsList rounds={rounds} selfUid={uid} />}
        {tab === 'history' && rounds !== null && <RoundHistoryList rounds={rounds} selfUid={uid} />}
      </div>

      {tab !== 'totals' && (
        <p className="screen-footnote">なまえをタップすると、そのひとの作ったことばが見られます</p>
      )}

      {(syncError || historyError) && (
        <p className="form-error" style={{ textAlign: 'center' }}>{syncError ?? historyError}</p>
      )}

      <div className="button-row" style={{ margin: '4px auto 0' }}>
        <button
          className="button button--primary button--block"
          onClick={handleRematch}
          disabled={restarting || !controlsReady}
        >
          もう一度あそぶ
        </button>
        <button
          className="button button--ghost button--block"
          disabled={!controlsReady}
          onClick={() => {
            if (roomId && uid) void leaveRoom(roomId, uid);
            navigate('/');
          }}
        >
          タイトルへ
        </button>
      </div>
    </div>
  );
}
