/**
 * 効果音エンジン。
 *
 * 静的ホスティングのみという制約とライセンス表記の手間を避けるため、音声ファイルは
 * 一切使わず Web Audio API のオシレーターでその場に音を合成する(ちいさなピコピコ音)。
 * AudioContextはブラウザの自動再生制限により、実際にユーザー操作(タップ)から呼ばれる
 * playSfx() の初回呼び出し時に遅延生成する。
 */

const STORAGE_KEY = 'mojifuru:soundEnabled';

let audioCtx: AudioContext | null = null;
let enabled = loadEnabled();

function loadEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === '1';
  } catch {
    return true;
  }
}

function persistEnabled(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // localStorageが使えない環境でも致命的ではないため無視する
  }
}

export function isSoundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
  persistEnabled(value);
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

interface Tone {
  /** 周波数(Hz) */
  freq: number;
  /** 再生開始までの遅延(秒) */
  startOffset: number;
  /** 音の長さ(秒) */
  duration: number;
  type?: OscillatorType;
  /** ピーク音量(0〜1) */
  gain?: number;
}

function playTones(tones: readonly Tone[]): void {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = tone.type ?? 'sine';
    osc.frequency.value = tone.freq;
    const start = now + tone.startOffset;
    const end = start + tone.duration;
    const peakGain = tone.gain ?? 0.2;
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(peakGain, start + Math.min(0.012, tone.duration / 4));
    gainNode.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

export type SfxName =
  | 'collect'
  | 'confirmValid'
  | 'confirmBonus'
  | 'confirmGrandBonus'
  | 'confirmUnregistered'
  | 'claimFailed'
  | 'countdownTick'
  | 'countdownGo'
  | 'timerUrgent'
  | 'timeUp';

export function playSfx(name: SfxName): void {
  switch (name) {
    case 'collect':
      // 文字ごとに少し音程をゆらして、連打が単調にならないようにする
      playTones([{ freq: 720 + Math.random() * 160, startOffset: 0, duration: 0.06, type: 'triangle', gain: 0.12 }]);
      break;
    case 'confirmValid':
      playTones([
        { freq: 523.25, startOffset: 0, duration: 0.1, type: 'sine', gain: 0.18 },
        { freq: 659.25, startOffset: 0.08, duration: 0.14, type: 'sine', gain: 0.18 },
      ]);
      break;
    case 'confirmBonus':
      playTones([
        { freq: 523.25, startOffset: 0, duration: 0.09, type: 'triangle', gain: 0.2 },
        { freq: 659.25, startOffset: 0.07, duration: 0.09, type: 'triangle', gain: 0.2 },
        { freq: 783.99, startOffset: 0.14, duration: 0.2, type: 'triangle', gain: 0.22 },
      ]);
      break;
    case 'confirmGrandBonus':
      playTones([
        { freq: 523.25, startOffset: 0, duration: 0.08, type: 'triangle', gain: 0.22 },
        { freq: 659.25, startOffset: 0.06, duration: 0.08, type: 'triangle', gain: 0.22 },
        { freq: 783.99, startOffset: 0.12, duration: 0.08, type: 'triangle', gain: 0.22 },
        { freq: 1046.5, startOffset: 0.18, duration: 0.26, type: 'triangle', gain: 0.25 },
      ]);
      break;
    case 'confirmUnregistered':
      playTones([
        { freq: 220, startOffset: 0, duration: 0.14, type: 'sawtooth', gain: 0.11 },
        { freq: 174.61, startOffset: 0.1, duration: 0.2, type: 'sawtooth', gain: 0.11 },
      ]);
      break;
    case 'claimFailed':
      playTones([{ freq: 180, startOffset: 0, duration: 0.1, type: 'square', gain: 0.09 }]);
      break;
    case 'countdownTick':
      playTones([{ freq: 440, startOffset: 0, duration: 0.09, type: 'sine', gain: 0.16 }]);
      break;
    case 'countdownGo':
      playTones([
        { freq: 440, startOffset: 0, duration: 0.08, type: 'triangle', gain: 0.2 },
        { freq: 880, startOffset: 0.08, duration: 0.24, type: 'triangle', gain: 0.24 },
      ]);
      break;
    case 'timerUrgent':
      playTones([{ freq: 660, startOffset: 0, duration: 0.06, type: 'square', gain: 0.1 }]);
      break;
    case 'timeUp':
      playTones([
        { freq: 392, startOffset: 0, duration: 0.14, type: 'sine', gain: 0.2 },
        { freq: 329.63, startOffset: 0.13, duration: 0.14, type: 'sine', gain: 0.2 },
        { freq: 261.63, startOffset: 0.26, duration: 0.34, type: 'sine', gain: 0.2 },
      ]);
      break;
  }
}
