import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { subscribeTopScores, type LeaderboardPeriod, type LeaderboardRow } from '../firebase/leaderboard';

const TOP_MEDALS = ['🥇', '🥈', '🥉'];
// 表彰台の見た目の並び順(向かって左から2位・1位・3位)
const PODIUM_DISPLAY_ORDER = [1, 0, 2];

const PERIOD_TABS: { period: LeaderboardPeriod; label: string }[] = [
  { period: 'daily', label: 'デイリー' },
  { period: 'monthly', label: 'マンスリー' },
  { period: 'allTime', label: '全期間' },
];

export default function LeaderboardScreen() {
  const navigate = useNavigate();
  const { firebaseEnabled } = useGameContext();
  const [period, setPeriod] = useState<LeaderboardPeriod>('daily');
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    if (!firebaseEnabled) return;
    setRows(null);
    return subscribeTopScores(period, undefined, setRows);
  }, [firebaseEnabled, period]);

  const top3 = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];

  return (
    <div className="screen">
      <h2 className="leaderboard-title">
        <span aria-hidden="true">🎉</span> ランキング <span aria-hidden="true">🎉</span>
      </h2>

      <div className="tab-row" style={{ justifyContent: 'center' }}>
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.period}
            className={'tab-button' + (period === tab.period ? ' is-active' : '')}
            onClick={() => setPeriod(tab.period)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!firebaseEnabled && (
        <p style={{ color: 'var(--text-soft)', fontSize: 14 }}>Firebaseが未設定のため、ランキングは利用できません。</p>
      )}

      {firebaseEnabled && rows === null && <p>読み込み中...</p>}

      {firebaseEnabled && rows !== null && (
        <>
          {top3.length > 0 && (
            <div className="podium">
              {PODIUM_DISPLAY_ORDER.filter((i) => top3[i]).map((i) => {
                const row = top3[i];
                const rank = i + 1;
                return (
                  <div className={`podium-slot podium-slot--${rank}`} key={row.uid}>
                    {rank === 1 && (
                      <span className="podium-crown" aria-hidden="true">
                        👑
                      </span>
                    )}
                    <div className="podium-chip">
                      <span className="podium-chip-medal">{TOP_MEDALS[rank - 1]}</span>
                    </div>
                    <div className="podium-name">{row.name}</div>
                    <div className="podium-score">{row.bestScore}点</div>
                    <div className="podium-stand">{rank}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {rows.length === 0 && <p style={{ color: 'var(--text-soft)' }}>まだ記録がありません。一番乗りを目指そう!</p>}
            {rest.map((row, i) => {
              const rank = i + 4;
              const isTop10 = rank <= 10;
              return (
                <div className={'leaderboard-row' + (isTop10 ? ' leaderboard-row--top10' : '')} key={row.uid}>
                  <div className="leaderboard-rank">{rank}</div>
                  <div className="leaderboard-name">{row.name}</div>
                  <div className="leaderboard-score">{row.bestScore}点</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <button className="button button--ghost button--block" onClick={() => navigate('/')}>
        タイトルへもどる
      </button>
    </div>
  );
}
