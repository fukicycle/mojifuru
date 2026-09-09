/**
 * 文字チップの配色。アイコンと同じパステル3色を使い、同じ文字にはいつも同じ色が
 * 割り当たるよう文字コードのハッシュで決める(デザイン確定事項)。
 */
export const CHIP_COLORS = ['magenta', 'orange', 'aqua'] as const;

export type ChipColor = (typeof CHIP_COLORS)[number];

export function colorForChar(char: string): ChipColor {
  let hash = 0;
  for (let i = 0; i < char.length; i++) hash = (hash * 31 + char.charCodeAt(i)) >>> 0;
  return CHIP_COLORS[hash % CHIP_COLORS.length];
}
