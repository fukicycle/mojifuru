import { describe, expect, it } from 'vitest';
import {
  FALL_DURATION_MS,
  FALL_EXIT_BUFFER_MS,
  SPAWN_INTERVAL_MS,
  advanceFallingLetters,
  createInitialFallingLettersState,
  createRng,
  fallingProgress,
  pickWeightedChar,
  removeLetterById,
} from './fallingLetters';

describe('createRng', () => {
  it('同じseedからは同じ数列を生成する(対戦モードの同期の要)', () => {
    const rngA = createRng(42);
    const rngB = createRng(42);
    const seqA = Array.from({ length: 20 }, () => rngA());
    const seqB = Array.from({ length: 20 }, () => rngB());
    expect(seqA).toEqual(seqB);
  });

  it('異なるseedからは異なる数列を生成する', () => {
    const rngA = createRng(1);
    const rngB = createRng(2);
    expect(rngA()).not.toBe(rngB());
  });

  it('0〜1の範囲の値を返す', () => {
    const rng = createRng(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('pickWeightedChar', () => {
  it('重みに応じた頻度で文字を選ぶ', () => {
    const rng = createRng(1);
    const weights = [
      ['あ', 90],
      ['ん', 10],
    ] as const;
    const counts: Record<string, number> = { あ: 0, ん: 0 };
    for (let i = 0; i < 1000; i++) counts[pickWeightedChar(rng, weights)]++;
    expect(counts['あ']).toBeGreaterThan(counts['ん']);
  });
});

describe('advanceFallingLetters', () => {
  it('経過時間に応じて文字が出現する', () => {
    const rng = createRng(1);
    let state = createInitialFallingLettersState();
    state = advanceFallingLetters(state, SPAWN_INTERVAL_MS * 3, rng);
    expect(state.letters.length).toBe(3);
  });

  it('同じseed・同じelapsedMsなら常に同じ結果になる(決定的)', () => {
    const runOnce = () => {
      const rng = createRng(123);
      let state = createInitialFallingLettersState();
      state = advanceFallingLetters(state, SPAWN_INTERVAL_MS * 5, rng);
      return state.letters.map((l) => ({ char: l.char, x: l.x }));
    };
    expect(runOnce()).toEqual(runOnce());
  });

  it('FALL_DURATION_MS + FALL_EXIT_BUFFER_MSを超えた文字は取りこぼしとして除去される', () => {
    const rng = createRng(1);
    let state = createInitialFallingLettersState();
    state = advanceFallingLetters(state, SPAWN_INTERVAL_MS, rng);
    expect(state.letters.length).toBe(1);
    // バッファ時間内はまだ画面外へ抜けきっていないので残っている
    state = advanceFallingLetters(state, SPAWN_INTERVAL_MS + FALL_DURATION_MS + 1, rng);
    expect(state.letters.some((l) => l.spawnedAt === SPAWN_INTERVAL_MS)).toBe(true);
    state = advanceFallingLetters(state, SPAWN_INTERVAL_MS + FALL_DURATION_MS + FALL_EXIT_BUFFER_MS + 1, rng);
    expect(state.letters.some((l) => l.spawnedAt === SPAWN_INTERVAL_MS)).toBe(false);
  });

  it('複数回に分けて呼んでも一度に呼んだ場合と同じ本数が出現する(フレームレート非依存)', () => {
    const targetMs = SPAWN_INTERVAL_MS * 10 + 1;

    const rngOnce = createRng(9);
    let stateOnce = createInitialFallingLettersState();
    stateOnce = advanceFallingLetters(stateOnce, targetMs, rngOnce);

    const rngStepped = createRng(9);
    let stateStepped = createInitialFallingLettersState();
    for (let t = 0; t <= targetMs; t += 33) {
      stateStepped = advanceFallingLetters(stateStepped, t, rngStepped);
    }
    stateStepped = advanceFallingLetters(stateStepped, targetMs, rngStepped);

    expect(stateStepped.letters.length).toBe(stateOnce.letters.length);
  });
});

describe('fallingProgress', () => {
  it('出現直後は0、画面下端到達時点で1、その後バッファ分だけ進んでからクランプされる', () => {
    const letter = { id: 'l0', char: 'あ', x: 0.5, spawnedAt: 1000 };
    const maxProgress = (FALL_DURATION_MS + FALL_EXIT_BUFFER_MS) / FALL_DURATION_MS;
    expect(fallingProgress(letter, 1000)).toBe(0);
    expect(fallingProgress(letter, 1000 + FALL_DURATION_MS)).toBe(1);
    expect(fallingProgress(letter, 1000 + FALL_DURATION_MS + FALL_EXIT_BUFFER_MS)).toBeCloseTo(maxProgress);
    expect(fallingProgress(letter, 1000 + FALL_DURATION_MS * 2)).toBeCloseTo(maxProgress); // clamp
  });
});

describe('removeLetterById', () => {
  it('指定したidの文字だけを取り除く(タップで取得した時の処理)', () => {
    const rng = createRng(1);
    let state = createInitialFallingLettersState();
    state = advanceFallingLetters(state, SPAWN_INTERVAL_MS * 3, rng);
    const targetId = state.letters[0].id;
    const next = removeLetterById(state, targetId);
    expect(next.letters.length).toBe(state.letters.length - 1);
    expect(next.letters.some((l) => l.id === targetId)).toBe(false);
  });
});
