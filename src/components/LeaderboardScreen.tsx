import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { subscribeTopScores, type LeaderboardRow } from '../firebase/leaderboard';

const TOP_MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const navigate = useNavigate();
  const { firebaseEnabled } = useGameContext();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    if (!firebaseEnabled) return;
    return subscribeTopScores(undefined, setRows);
  }, [firebaseEnabled]);

  return (
    <div className="screen">
      <h2>ランキング</h2>

      {!firebaseEnabled && (
        <p style={{ color: 'var(--text-soft)', fontSize: 14 }}>Firebaseが未設定のため、ランキングは利用できません。</p>
      )}

      {firebaseEnabled && rows === null && <p>読み込み中...</p>}

      {firebaseEnabled && rows !== null && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {rows.length === 0 && <p style={{ color: 'var(--text-soft)' }}>まだ記録がありません。一番乗りを目指そう!</p>}
          {rows.map((row, i) => {
            const rank = i + 1;
            const isTop3 = rank <= 3;
            const isTop10 = rank <= 10;
            return (
              <div
                className={
                  'leaderboard-row' +
                  (isTop10 ? ' leaderboard-row--top10' : '') +
                  (isTop3 ? ` leaderboard-row--top${rank}` : '')
                }
                key={row.uid}
              >
                <div className="leaderboard-rank">{isTop3 ? TOP_MEDALS[rank - 1] : rank}</div>
                <div className="leaderboard-name">{row.name}</div>
                <div className="leaderboard-score">{row.bestScore}点</div>
              </div>
            );
          })}
        </div>
      )}

      <button className="button button--ghost button--block" onClick={() => navigate('/')}>
        タイトルへもどる
      </button>
    </div>
  );
}
