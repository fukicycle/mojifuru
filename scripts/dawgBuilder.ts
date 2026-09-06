/**
 * public/dict.dawg の中身の型。ランタイム側の src/game/dawg.ts と形を一致させること。
 */
export interface DawgState {
  final: boolean;
  trans: Record<string, number>;
}

export interface DawgData {
  start: number;
  states: DawgState[];
}

/**
 * Daciuk 法によるDAWG(Directed Acyclic Word Graph)の増分構築。
 *
 * ソート済みの単語列を1件ずつ insert() すると、共通の接尾辞を持つ
 * 状態が自動的に共有・最小化される。仕組み:
 *  1. 直前の単語との共通接頭辞の長さを求める
 *  2. 共通接頭辞より深い「未確定」状態を後ろから順に確定させる
 *     (同じ shape の状態が既に登録済みなら再利用し、なければ新規登録)
 *  3. 共通接頭辞から先を新規状態として伸ばす
 * 最後に finish() で残った未確定状態をすべて確定させる。
 */
class BuilderNode {
  final = false;
  children = new Map<string, BuilderNode>();
}

interface UncheckedTransition {
  parent: BuilderNode;
  letter: string;
  child: BuilderNode;
}

export class DawgBuilder {
  private readonly root = new BuilderNode();
  private previousWord = '';
  private readonly unchecked: UncheckedTransition[] = [];
  private readonly minimizedNodes = new Map<string, BuilderNode>();
  private readonly registeredId = new Map<BuilderNode, number>();
  private nextId = 0;

  /** 単語は昇順(ソート済み)で渡すこと。重複は無視される。 */
  insert(word: string): void {
    if (word < this.previousWord) {
      throw new Error(`単語はソート済み順で渡す必要があります: "${word}" が "${this.previousWord}" の後に来ています`);
    }
    if (word === this.previousWord) return;

    let commonPrefixLen = 0;
    const maxLen = Math.min(word.length, this.previousWord.length);
    while (commonPrefixLen < maxLen && word[commonPrefixLen] === this.previousWord[commonPrefixLen]) {
      commonPrefixLen++;
    }

    this.minimize(commonPrefixLen);

    let node = this.unchecked.length === 0 ? this.root : this.unchecked[this.unchecked.length - 1].child;
    for (let i = commonPrefixLen; i < word.length; i++) {
      const letter = word[i];
      const next = new BuilderNode();
      node.children.set(letter, next);
      this.unchecked.push({ parent: node, letter, child: next });
      node = next;
    }
    node.final = true;
    this.previousWord = word;
  }

  finish(): DawgData {
    this.minimize(0);
    if (!this.registeredId.has(this.root)) {
      this.registeredId.set(this.root, this.nextId++);
    }

    const states: DawgState[] = new Array(this.nextId);
    for (const [node, id] of this.registeredId.entries()) {
      const trans: Record<string, number> = {};
      for (const [letter, child] of node.children.entries()) {
        trans[letter] = this.registeredId.get(child)!;
      }
      states[id] = { final: node.final, trans };
    }
    return { start: this.registeredId.get(this.root)!, states };
  }

  private signature(node: BuilderNode): string {
    const parts: string[] = [node.final ? '1' : '0'];
    const letters = [...node.children.keys()].sort();
    for (const letter of letters) {
      parts.push(letter, String(this.registeredId.get(node.children.get(letter)!)));
    }
    return parts.join('');
  }

  private minimize(downTo: number): void {
    for (let i = this.unchecked.length - 1; i >= downTo; i--) {
      const { parent, letter, child } = this.unchecked[i];
      const sig = this.signature(child);
      const existing = this.minimizedNodes.get(sig);
      if (existing) {
        parent.children.set(letter, existing);
      } else {
        this.registeredId.set(child, this.nextId++);
        this.minimizedNodes.set(sig, child);
      }
      this.unchecked.pop();
    }
  }
}

export function buildDawg(sortedUniqueWords: string[]): DawgData {
  const builder = new DawgBuilder();
  for (const word of sortedUniqueWords) builder.insert(word);
  return builder.finish();
}
