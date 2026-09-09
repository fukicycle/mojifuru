import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import {
  currentDailyKey,
  currentMonthlyKey,
  subscribeTopScores,
  type LeaderboardPeriod,
  type LeaderboardRow,
} from '../firebase/leaderboard';

const TOP_MEDALS = ['🥇', '🥈', '🥉'];
// 表彰台の見た目の並び順(向かって左から2位・1位・3位)
const PODIUM_DISPLAY_ORDER = [1, 0, 2];

const PERIOD_TABS: { period: LeaderboardPeriod; label: string }[] = [
  { period: 'daily', label: 'デイリー' },
  { period: 'monthly', label: 'マンスリー' },
  { period: 'allTime', label: '全期間' },
];

// タイトルもアイコンと同じ「丸い文字チップ」で組む。色はアイコンの3色を順に割り当てる。
const TITLE_CHIPS = ['ラ', 'ン', 'キ', 'ン', 'グ'];
const CHIP_COLORS = ['magenta', 'orange', 'aqua'];
// 背景に浮かべる飾りの文字(アプリ名の文字を散らす)
const DECO_CHARS = ['も', 'じ', 'ふ', 'る', 'も', 'じ'];

function periodCaption(period: LeaderboardPeriod): string {
  if (period === 'daily') return `${currentDailyKey()} のきろく`;
  if (period === 'monthly') return `${currentMonthlyKey()} のきろく`;
  return 'これまでのすべてのきろく';
}

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
    <div className="screen leaderboard-screen">
      {/* 背景の飾り。アイコンと同じ丸チップを薄く散らす(操作の邪魔はしない) */}
      <div className="lb-deco" aria-hidden="true">
        {DECO_CHARS.map((char, i) => (
          <span key={i} className={`lb-deco-chip lb-deco-chip--${CHIP_COLORS[i % CHIP_COLORS.length]}`}>
            {char}
          </span>
        ))}
      </div>

      <div className="leaderboard-header">
        <h2 className="leaderboard-title">
          <span className="lb-title-spark lb-title-spark--left" aria-hidden="true">
            ✨
          </span>
          <span className="lb-title-chips">
            {TITLE_CHIPS.map((char, i) => (
              <span key={i} className={`lb-title-chip lb-title-chip--${CHIP_COLORS[i % CHIP_COLORS.length]}`}>
                {char}
              </span>
            ))}
          </span>
          <span className="lb-title-spark lb-title-spark--right" aria-hidden="true">
            ✨
          </span>
        </h2>
        <p className="leaderboard-caption">{periodCaption(period)}</p>
      </div>

      <div className="tab-row lb-tab-row">
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

      {firebaseEnabled && rows === null && (
        <div className="lb-loading">
          <span className="lb-loading-chip lb-loading-chip--magenta">も</span>
          <span className="lb-loading-chip lb-loading-chip--orange">じ</span>
          <span className="lb-loading-chip lb-loading-chip--aqua">ふ</span>
          <p className="lb-loading-text">よみこみ中...</p>
        </div>
      )}

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

          <div className="leaderboard-list">
            {rows.length === 0 && (
              <div className="lb-empty">
                <span className="lb-empty-chip" aria-hidden="true">
                  ?
                </span>
                <p className="lb-empty-text">まだ記録がありません。一番乗りを目指そう!</p>
              </div>
            )}
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

          {rows.length > 0 && <p className="leaderboard-footnote">ぜんぶで {rows.length}人 のきろく</p>}
        </>
      )}

      <button className="button button--ghost button--block" onClick={() => navigate('/')}>
        タイトルへもどる
      </button>
    </div>
  );
}
