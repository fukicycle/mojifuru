/**
 * DAWG検索による単語判定(純粋関数 + Dawgインスタンス)。
 * 辞書にない単語は「エラー」ではなく「未登録・0点」として扱い、プレイを止めない。
 */
import type { Dawg } from './dawg';
import { scoreWord, type ScoredWord } from './scoring';

export const MIN_WORD_LENGTH = 2;
export const MAX_WORD_LENGTH = 8;

export type ValidationStatus = 'valid' | 'too-short' | 'too-long' | 'unregistered';

export interface ValidationResult {
  status: ValidationStatus;
  word: string;
  scored?: ScoredWord;
}

export function validateWord(dawg: Dawg, word: string): ValidationResult {
  if (word.length < MIN_WORD_LENGTH) return { status: 'too-short', word };
  if (word.length > MAX_WORD_LENGTH) return { status: 'too-long', word };
  if (!dawg.isWord(word)) return { status: 'unregistered', word };
  return { status: 'valid', word, scored: scoreWord(word) };
}

/** 構成中の単語がまだ辞書上の単語に繋がる余地があるか(UIの早期フィードバック用) */
export function canStillFormWord(dawg: Dawg, partialWord: string): boolean {
  if (partialWord.length === 0) return true;
  if (partialWord.length > MAX_WORD_LENGTH) return false;
  return dawg.hasPrefix(partialWord);
}
