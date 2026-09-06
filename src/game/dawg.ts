/**
 * DAWG (Directed Acyclic Word Graph) — 判定用辞書のランタイム表現。
 *
 * public/dict.dawg は { start: number, states: DawgState[] } という
 * JSON を保持している(生成は scripts/buildDict.ts の DawgBuilder)。
 * 各 state は文字ごとの遷移テーブルと、そこが単語の終端かどうかを持つ。
 * 同じ接尾辞を持つ状態はビルド時に共有・最小化されているため、
 * 素朴な trie よりも大幅に小さいサイズで完全な単語集合を表現できる。
 */
export interface DawgState {
  final: boolean;
  trans: Record<string, number>;
}

export interface DawgData {
  start: number;
  states: DawgState[];
}

export class Dawg {
  private readonly data: DawgData;

  constructor(data: DawgData) {
    this.data = data;
  }

  /** kana が辞書に登録された単語として完全一致するか */
  isWord(kana: string): boolean {
    const state = this.walk(kana);
    return state !== null && this.data.states[state].final;
  }

  /** kana がいずれかの単語の先頭部分(またはそれ自体)として存在しうるか */
  hasPrefix(kana: string): boolean {
    return this.walk(kana) !== null;
  }

  private walk(kana: string): number | null {
    let cur = this.data.start;
    for (const ch of kana) {
      const next = this.data.states[cur].trans[ch];
      if (next === undefined) return null;
      cur = next;
    }
    return cur;
  }
}

export async function loadDawg(url = `${import.meta.env.BASE_URL}dict.dawg`): Promise<Dawg> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`辞書データの読み込みに失敗しました: ${res.status} ${url}`);
  }
  const data = (await res.json()) as DawgData;
  return new Dawg(data);
}
