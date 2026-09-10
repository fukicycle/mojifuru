/**
 * 効果音エンジン。
 *
 * 静的ホスティングのみという制約とライセンス表記の手間を避けるため、音声ファイルは
 * 一切使わず Web Audio API のオシレーターでその場に音を合成する(ちいさなピコピコ音)。
 * AudioContextはブラウザの自動再生制限により、実際のユーザー操作(タップ)から
 * 生成・resumeしないと suspended のままになるため、最初のpointerdownで先に用意する
 * (primeAudio)。対戦モードのカウントダウン音はrAF由来で鳴るため、これがないと
 * iOS Safariではラウンドまるごと無音になる。
 *
 * iOSのサイレントスイッチ(マナーモード)対策:
 * Web Audioだけで音を出すとiOSのaudio sessionは既定で 'ambient' 扱いになり、
 * 本体のサイレントスイッチONで完全に無音化される。スイッチの状態を読み取るWeb APIは
 * 存在せず「マナーモードに自動追従」は実装不可能なため、Audio Session APIで
 * 'playback' を宣言してスイッチを無視し、音の有無はアプリ内の🔊トグルに委ねる。
 *
 * ただし 'playback' は非ミックスで、宣言している間はユーザーが裏で流している音楽を
 * 止めてしまう。そのため常時ではなく、プレイ画面にいる間だけ beginGameAudio() で
 * 'playback' を取得し、離れたら endGameAudio() で 'auto' に戻してセッションも手放す。
 */

/** navigator.audioSession はまだ lib.dom に無いため最小限の型を用意する */
interface AudioSessionLike {
  type: 'auto' | 'playback' | 'transient' | 'transient-solo' | 'transient-passthrough' | 'ambient' | 'play-and-record';
}

const STORAGE_KEY = 'mojifuru:soundEnabled';

let audioCtx: AudioContext | null = null;
let enabled = loadEnabled();
/** プレイ画面に居る間だけ true。'playback' を主張してよい区間の判定に使う */
let inGameScreen = false;
/** 直近でスケジュールした音の終了時刻(AudioContext#currentTime基準)。suspend()を早めすぎないために使う */
let busyUntil = 0;
let pendingSuspendTimer: ReturnType<typeof setTimeout> | null = null;

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
  // プレイ中にオフにされたら 'playback' の主張も取り下げる(他アプリの音楽を巻き添えにしない)
  applyAudioSession();
  // トグル操作自体がユーザー操作なので、オンにした瞬間にアンロックを済ませておく
  if (value) primeAudio();
}

/**
 * Audio Session APIの種別を宣言する。Safari 16.4+ / iOS 16.4+ のみ対応で、
 * 未対応環境では何も起きない(従来どおりサイレントスイッチに従う)。
 */
function setAudioSessionType(type: AudioSessionLike['type']): void {
  const session = (navigator as unknown as { audioSession?: AudioSessionLike }).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    // 未知の値を弾く実装でも致命的ではないため無視する
  }
}

/**
 * 現在の状況に見合ったセッション種別を宣言し直す。
 * プレイ中かつ音がオンのときだけ 'playback'(=マナーモードを無視)を主張し、
 * それ以外は 'auto' に戻して他アプリの音楽と共存できる状態にしておく。
 */
function applyAudioSession(): void {
  setAudioSessionType(inGameScreen && enabled ? 'playback' : 'auto');
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    // AudioContextを作る前に種別を確定させておく
    applyAudioSession();
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') void audioCtx.resume();
  return audioCtx;
}

/**
 * ユーザー操作の中でAudioContextを起こしておく。iOSはジェスチャ外のresume()が効かないため、
 * 「最初のタップ」でこれを済ませておかないと、以降どのタイミングの音も鳴らなくなる。
 */
export function primeAudio(): void {
  getAudioContext();
}

/**
 * プレイ画面に入った(=これから効果音を鳴らす)ことを宣言する。
 * ここで初めて 'playback' を取得するので、タイトルやランキングを眺めている間は
 * ユーザーが裏で流している音楽を止めない。
 */
export function beginGameAudio(): void {
  inGameScreen = true;
  if (pendingSuspendTimer !== null) {
    clearTimeout(pendingSuspendTimer);
    pendingSuspendTimer = null;
  }
  applyAudioSession();
  if (enabled) primeAudio();
}

/**
 * プレイ画面を離れたので 'auto' に戻す。あわせてAudioContextをsuspendして
 * audio sessionを手放し、中断していた他アプリの音楽が再開できるようにする。
 *
 * ただし終了音(timeUp等)がまだ鳴り終わっていない場合、即suspendすると波形が
 * 途中で打ち切られ「ぶちっ」というノイズになる。鳴らし終わるまではsuspendを遅らせる。
 */
export function endGameAudio(): void {
  inGameScreen = false;
  if (pendingSuspendTimer !== null) {
    clearTimeout(pendingSuspendTimer);
    pendingSuspendTimer = null;
  }
  const ctx = audioCtx;
  const remainingSec = ctx && ctx.state === 'running' ? busyUntil - ctx.currentTime : 0;
  if (ctx && remainingSec > 0) {
    // 'auto'への切り替えもsuspend()も、鳴り終わるまで遅らせて途中で打ち切らないようにする
    pendingSuspendTimer = setTimeout(() => {
      pendingSuspendTimer = null;
      if (inGameScreen) return;
      applyAudioSession();
      if (ctx.state === 'running') void ctx.suspend();
    }, remainingSec * 1000);
  } else {
    applyAudioSession();
    if (ctx?.state === 'running') void ctx.suspend();
  }
}

if (typeof window !== 'undefined') {
  // 最初のユーザー操作でアンロックする。captureで拾い、他のハンドラのstopPropagationに負けないようにする。
  // 音がオフの間は不要なAudioContext(=iOSでの他アプリ音楽の中断)を作らず、オンになるまで待ち続ける。
  const unlockOnFirstGesture = () => {
    if (!enabled) return;
    primeAudio();
    window.removeEventListener('pointerdown', unlockOnFirstGesture, true);
  };
  window.addEventListener('pointerdown', unlockOnFirstGesture, true);
  // PWAをバックグラウンドに送るとAudioContextはsuspendされ、自動では戻らない。
  // ただしendGameAudio()による意図的なsuspendを起こさないよう、プレイ中に限る。
  document.addEventListener('visibilitychange', () => {
    if (!inGameScreen || !enabled) return;
    if (document.visibilityState === 'visible' && audioCtx?.state === 'suspended') void audioCtx.resume();
  });
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
    const stopAt = end + 0.02;
    osc.stop(stopAt);
    if (stopAt > busyUntil) busyUntil = stopAt;
  }
}

export type SfxName =
  | 'collect'
  | 'confirmValid'
  | 'confirmBonus'
  | 'confirmGrandBonus'
  | 'confirmUnregistered'
  | 'claimFailed'
  | 'deleteChar'
  | 'clearAll'
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
    case 'deleteChar':
      // 1文字だけ消える軽い音。「ぜんぶクリア」との違いが分かるよう単発・短めにする
      playTones([{ freq: 340, startOffset: 0, duration: 0.07, type: 'triangle', gain: 0.14 }]);
      break;
    case 'clearAll':
      // 3音の下降で「まとめて消えた」感を出し、deleteChar(単発)と明確に区別する
      playTones([
        { freq: 420, startOffset: 0, duration: 0.08, type: 'sawtooth', gain: 0.16 },
        { freq: 300, startOffset: 0.06, duration: 0.08, type: 'sawtooth', gain: 0.16 },
        { freq: 180, startOffset: 0.12, duration: 0.18, type: 'sawtooth', gain: 0.18 },
      ]);
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
