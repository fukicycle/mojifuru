/**
 * 文字の生成・降下ロジック(純粋関数)。
 *
 * 副作用や `Date.now()` を内部で呼ばず、外部から渡された経過時間(elapsedMs)と
 * 乱数列(rng)だけで状態が決まるようにしてある。これにより:
 *   - 対戦モードでは全員が同じ seed から同じ rng を作れば、
 *     ネットワークで個々の文字を同期しなくても全員に同じ降下パターンが再現できる
 *     (`/rooms/{roomId}/seed` を共有するだけでよい)
 *   - フレームレートや呼び出し間隔に依存せず、どのタイミングで advance を呼んでも
 *     同じ elapsedMs に対しては同じ結果になる
 */

export const FALL_DURATION_MS = 6500;
/**
 * FALL_DURATION_MS到達(進捗100%)後も、実際に画面外へ完全に抜けきるまで
 * 少し猶予を持たせるための追加時間。これがないと、チップがまだ枠内に
 * 見えている途中で突然消える(先に state から除去されてしまう)ことになる。
 */
export const FALL_EXIT_BUFFER_MS = 900;
export const SPAWN_INTERVAL_MS = 650;

export interface FallingLetter {
  id: string;
  char: string;
  /** 0(左端)〜1(右端)の相対水平位置 */
  x: number;
  /** ゲーム開始からの出現時刻(ms) */
  spawnedAt: number;
}

export interface FallingLettersState {
  letters: FallingLetter[];
  lastSpawnedAt: number;
  nextId: number;
  /**
   * 生成するidの接頭辞。対戦モードで同じルームを再戦する際、
   * ラウンドごとに異なる接頭辞を渡すことで、前回ラウンドの
   * `takenLetters`(既に取得済みの文字)と今回のidが衝突しないようにする。
   */
  idPrefix: string;
}

export function createInitialFallingLettersState(idPrefix = ''): FallingLettersState {
  return { letters: [], lastSpawnedAt: 0, nextId: 0, idPrefix };
}

/** mulberry32: シンプルで高速な決定的擬似乱数生成器 */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type WeightedChar = readonly [char: string, weight: number];

/**
 * 出題辞書(public/wordlist.json)中のかな文字の出現頻度。
 * 実際に単語を作れる可能性が高い文字ほど出現しやすくすることで、
 * 「取れても使い道がない文字ばかり降ってくる」体験を避ける。
 * scripts/buildDict.ts の生成結果が大きく変わった場合は再集計すること。
 */
export const DEFAULT_KANA_WEIGHTS: readonly WeightedChar[] = [
  ['ん', 16262], ['う', 15847], ['い', 14682], ['し', 10538], ['く', 8699],
  ['か', 8098], ['き', 7943], ['ょ', 5869], ['り', 5525], ['こ', 5199],
  ['つ', 4942], ['じ', 4783], ['る', 4413], ['た', 4329], ['ち', 4222],
  ['が', 3625], ['と', 3624], ['お', 3576], ['せ', 3532], ['ま', 3468],
  ['け', 3296], ['さ', 3215], ['み', 3150], ['あ', 3088], ['す', 3042],
  ['ゅ', 3016], ['な', 2945], ['ら', 2861], ['は', 2527], ['て', 2524],
  ['も', 2369], ['め', 2364], ['え', 2360], ['っ', 2278], ['だ', 2235],
  ['の', 2209], ['ひ', 2104], ['ぶ', 2088], ['わ', 2086], ['そ', 2023],
  ['ど', 2017], ['ば', 2014], ['ろ', 1986], ['や', 1902], ['ふ', 1887],
  ['ぎ', 1858], ['に', 1800], ['ゃ', 1725], ['れ', 1707], ['よ', 1639],
  ['げ', 1611], ['ご', 1591], ['ほ', 1573], ['む', 1555], ['び', 1410],
  ['ね', 1336], ['ず', 1172], ['ぼ', 1171], ['ざ', 1135], ['ぐ', 1103],
  ['ゆ', 988], ['で', 838], ['ぜ', 666], ['を', 663], ['ぞ', 628],
  ['へ', 591], ['べ', 560], ['づ', 494], ['ぬ', 488], ['ぱ', 322],
  ['ぽ', 286], ['ぴ', 175], ['ぷ', 158], ['ぺ', 96], ['ぢ', 35],
];

export function pickWeightedChar(rng: () => number, weights: readonly WeightedChar[]): string {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let r = rng() * total;
  for (const [char, weight] of weights) {
    r -= weight;
    if (r < 0) return char;
  }
  return weights[weights.length - 1][0];
}

export interface AdvanceOptions {
  weights?: readonly WeightedChar[];
  /** 一度の advance で無限ループしないための安全弁(通常は到達しない) */
  maxSpawnsPerAdvance?: number;
  /**
   * 1回のスポーンタイミングで同時に降らせる文字数。対戦モードで参加人数が
   * 増えると1人あたりが取れる文字が相対的に減ってしまうため、人数に応じて
   * 増やすことを想定している(既定は1=ソロプレイと同じ密度)。
   */
  lettersPerSpawn?: number;
}

/**
 * elapsedMs 時点までの状態に進める。
 * 画面下端(FALL_DURATION_MS 経過)に達した文字は取りこぼしとして除去される。
 */
export function advanceFallingLetters(
  state: FallingLettersState,
  elapsedMs: number,
  rng: () => number,
  options: AdvanceOptions = {},
): FallingLettersState {
  const weights = options.weights ?? DEFAULT_KANA_WEIGHTS;
  const maxSpawns = options.maxSpawnsPerAdvance ?? 10_000;
  const lettersPerSpawn = Math.max(1, Math.floor(options.lettersPerSpawn ?? 1));

  const letters = state.letters.filter((l) => elapsedMs - l.spawnedAt < FALL_DURATION_MS + FALL_EXIT_BUFFER_MS);
  let { lastSpawnedAt, nextId } = state;

  const spawned: FallingLetter[] = [];
  let guard = 0;
  while (lastSpawnedAt + SPAWN_INTERVAL_MS <= elapsedMs && guard < maxSpawns) {
    lastSpawnedAt += SPAWN_INTERVAL_MS;
    // 同時スポーン分は横方向をレーン分割してから乱数で散らし、
    // 複数人数分に増やしても同じ位置に重なって見えないようにする。
    for (let lane = 0; lane < lettersPerSpawn; lane++) {
      spawned.push({
        id: `${state.idPrefix}l${nextId++}`,
        char: pickWeightedChar(rng, weights),
        x: (lane + rng()) / lettersPerSpawn,
        spawnedAt: lastSpawnedAt,
      });
    }
    guard++;
  }

  return {
    letters: spawned.length === 0 ? letters : [...letters, ...spawned],
    lastSpawnedAt,
    nextId,
    idPrefix: state.idPrefix,
  };
}

/**
 * 0(出現直後)〜1(画面下端到達)の降下進捗。
 * 1を超えて FALL_EXIT_BUFFER_MS 分だけ進み続けることで、
 * 見た目上チップが完全に画面外へ抜けきってから state から除去されるようにする
 * (`.falling-field` の overflow:hidden により、100%を超えた位置は自動的に隠れる)。
 */
export function fallingProgress(letter: FallingLetter, elapsedMs: number): number {
  const maxProgress = (FALL_DURATION_MS + FALL_EXIT_BUFFER_MS) / FALL_DURATION_MS;
  return Math.min(maxProgress, Math.max(0, (elapsedMs - letter.spawnedAt) / FALL_DURATION_MS));
}

export function removeLetterById(state: FallingLettersState, id: string): FallingLettersState {
  const letters = state.letters.filter((l) => l.id !== id);
  if (letters.length === state.letters.length) return state;
  return { ...state, letters };
}
