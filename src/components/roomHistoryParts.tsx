/*
 * 戦績まわりの表示パーツ。対戦の結果画面(そのラウンド)と戦績画面(過去のラウンド)で
 * 同じ見た目を使い回す。ことばは、プレイ中と同じ丸い文字チップで並べて見せる。
 */

import { useState } from 'react';
import {
  aggregatePlayerTotals,
  rankRoundPlayers,
  type RankedRoundPlayer,
  type RoundRecord,
} from '../game/roomStats';
import type { BonusTier, ScoredWord } from '../game/scoring';
import { colorForChar } from './chipColors';
import { EmptyChip } from './decor';

const TOP_MEDALS = ['🥇', '🥈', '🥉'];

function tierLabel(tier: BonusTier): string {
  if (tier === 'grand-bonus') return '大ボーナス';
  if (tier === 'bonus') return 'ボーナス';
  return '';
}

/** 順位の丸(上位3位はメダル)。ボタンの中にも置くためspanで組む */
function RankMark({ rank }: { rank: number }) {
  return (
    <span className="leaderboard-rank">
      {rank <= 3 ? <span className="rank-medal">{TOP_MEDALS[rank - 1]}</span> : rank}
    </span>
  );
}

/** 成立した単語を、プレイ中と同じ丸チップで並べる */
function WordPillList({ words }: { words: readonly ScoredWord[] }) {
  return (
    <ul className="word-pill-list">
      {words.map((w, i) => (
        <li className="word-pill" key={i}>
          <span className="word-pill-chips" aria-label={w.word}>
            {[...w.word].map((char, j) => (
              <span key={j} className={`word-chip word-chip--${colorForChar(char)}`} aria-hidden="true">
                {char}
              </span>
            ))}
          </span>
          {w.bonusTier !== 'none' && (
            <span className={`tier-tag tier-tag--${w.bonusTier}`}>{tierLabel(w.bonusTier)}</span>
          )}
          <span className="word-pill-points">+{w.totalPoints}</span>
        </li>
      ))}
    </ul>
  );
}

interface RoundPlayerListProps {
  players: RankedRoundPlayer[];
  /** 自分の行を強調するためのuid */
  selfUid?: string | null;
  /** 最初から開いておくプレイヤー(結果画面では自分のことばをすぐ見せる) */
  defaultOpenUid?: string | null;
}

/**
 * 1ラウンドの順位表。行をタップすると、そのプレイヤーが作ったことばが開く。
 * 対戦相手がどんなことばを組み立てていたのかを、ここで見せる。
 */
export function RoundPlayerList({ players, selfUid, defaultOpenUid }: RoundPlayerListProps) {
  const [openUid, setOpenUid] = useState<string | null>(defaultOpenUid ?? null);

  return (
    <div className="round-player-list">
      {players.map((player) => {
        const isOpen = openUid === player.uid;
        const hasWords = player.words.length > 0;
        return (
          <div
            className={'round-player' + (player.uid === selfUid ? ' round-player--self' : '')}
            key={player.uid}
          >
            <button
              type="button"
              className="round-player-row"
              aria-expanded={isOpen}
              onClick={() => setOpenUid(isOpen ? null : player.uid)}
            >
              <RankMark rank={player.rank} />
              <span
                className={`player-avatar player-avatar--${colorForChar(player.name[0] ?? 'も')}`}
                aria-hidden="true"
              >
                {player.name[0] ?? 'も'}
              </span>
              <span className="round-player-name">{player.name}</span>
              <span className="round-player-score">{player.score}点</span>
              <span className="round-player-open">
                {hasWords ? `${player.words.length}語` : 'ことばなし'}
                <span className={'round-player-caret' + (isOpen ? ' is-open' : '')} aria-hidden="true">
                  ▾
                </span>
              </span>
            </button>
            {isOpen &&
              (hasWords ? (
                <WordPillList words={player.words} />
              ) : (
                <p className="round-player-empty">このラウンドはことばができませんでした</p>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function formatRoundTime(startedAt: number): string {
  if (!startedAt) return '';
  const d = new Date(startedAt);
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${minutes}`;
}

interface HistoryListProps {
  rounds: RoundRecord[];
  selfUid?: string | null;
  /** 記録が1つもないときの文言(ルームコードで探しに来たときは言い回しを変える) */
  emptyText?: string;
}

const DEFAULT_EMPTY_TEXT = 'まだ このルームの きろくは ありません';

/** ラウンドごとの記録(新しいラウンドを上に出す) */
export function RoundHistoryList({ rounds, selfUid, emptyText }: HistoryListProps) {
  if (rounds.length === 0) {
    return <EmptyChip text={emptyText ?? DEFAULT_EMPTY_TEXT} />;
  }

  return (
    <div className="history-round-list">
      {[...rounds].reverse().map((round, i) => (
        <section className="history-round" key={round.id}>
          <header className="history-round-head">
            <span className="history-round-no">ラウンド {rounds.length - i}</span>
            <span className="history-round-time">{formatRoundTime(round.startedAt)}</span>
          </header>
          <RoundPlayerList players={rankRoundPlayers(round.players)} selfUid={selfUid} />
        </section>
      ))}
    </div>
  );
}

/** プレイヤーごとの通算成績 */
export function PlayerTotalsList({ rounds, selfUid, emptyText }: HistoryListProps) {
  const totals = aggregatePlayerTotals(rounds);

  if (totals.length === 0) {
    return <EmptyChip text={emptyText ?? DEFAULT_EMPTY_TEXT} />;
  }

  return (
    <div className="totals-list">
      {totals.map((player, i) => (
        <div className={'totals-row' + (player.uid === selfUid ? ' totals-row--self' : '')} key={player.uid}>
          <RankMark rank={i + 1} />
          <div className="totals-body">
            <div className="totals-head">
              <span className="totals-name">{player.name}</span>
              <span className="count-badge totals-wins">{player.wins}勝</span>
            </div>
            <div className="totals-sub">
              {player.rounds}ラウンド ・ 合計 {player.totalScore}点 ・ 最高 {player.bestScore}点
            </div>
            {player.longestWord && (
              <div className="totals-best-word">
                いちばん長いことば「{player.longestWord}」({player.wordCount}語つくった)
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
