/*
 * アイコン(丸くてつやのある3色の文字チップ)の意匠を、どの画面でも同じテイストで
 * 使い回すための飾りパーツ。見た目だけの要素なので、いずれも操作を妨げないこと
 * (背景の飾りは pointer-events: none、読み上げ対象からも外す)。
 */

import { CHIP_COLORS } from './chipColors';

const DEFAULT_DECO_CHARS = ['も', 'じ', 'ふ', 'る', 'も', 'じ'] as const;

/** 画面の背景に薄い文字チップを浮かべる(中身より下のレイヤ) */
export function DecoChips({ chars = DEFAULT_DECO_CHARS }: { chars?: readonly string[] }) {
  return (
    <div className="deco-layer" aria-hidden="true">
      {chars.map((char, i) => (
        <span key={i} className={`deco-chip deco-chip--${CHIP_COLORS[i % CHIP_COLORS.length]}`}>
          {char}
        </span>
      ))}
    </div>
  );
}

interface ChipTitleProps {
  /** 1文字ずつチップにして並べる見出し */
  text: string;
  /** 見出しの下に添える小さな説明 */
  caption?: string;
  /** 両脇にきらめきを置くか */
  spark?: boolean;
}

/** 見出しをアイコンと同じ丸チップで組む */
export function ChipTitle({ text, caption, spark = true }: ChipTitleProps) {
  const chars = Array.from(text);
  return (
    <div className="chip-title-block">
      <h2 className="chip-title" aria-label={text}>
        {spark && (
          <span className="chip-title-spark" aria-hidden="true">
            ✨
          </span>
        )}
        <span className="chip-title-chips" aria-hidden="true">
          {chars.map((char, i) => (
            <span key={i} className={`chip-title-chip chip-title-chip--${CHIP_COLORS[i % CHIP_COLORS.length]}`}>
              {char}
            </span>
          ))}
        </span>
        {spark && (
          <span className="chip-title-spark chip-title-spark--right" aria-hidden="true">
            ✨
          </span>
        )}
      </h2>
      {caption && <p className="chip-title-caption">{caption}</p>}
    </div>
  );
}

/** 読み込み中に弾む3つのチップ */
export function ChipLoader({ text = 'よみこみ中...' }: { text?: string }) {
  return (
    <div className="chip-loader">
      <span className="chip-loader-chip chip-loader-chip--magenta">も</span>
      <span className="chip-loader-chip chip-loader-chip--orange">じ</span>
      <span className="chip-loader-chip chip-loader-chip--aqua">ふ</span>
      <p className="chip-loader-text">{text}</p>
    </div>
  );
}

/** 中身が空のときのプレースホルダー(大きなチップ+ひとこと) */
export function EmptyChip({ mark = '?', text }: { mark?: string; text: string }) {
  return (
    <div className="empty-chip-block">
      <span className="empty-chip" aria-hidden="true">
        {mark}
      </span>
      <p className="empty-chip-text">{text}</p>
    </div>
  );
}
