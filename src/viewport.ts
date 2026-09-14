/**
 * iOS PWA(standalone)でのビューポート計測。
 *
 * standaloneのiOSには、端末・OSバージョン・ホーム画面に追加した時点のメタタグによって
 * 2通りの挙動がある(どちらになるかはアプリ側から選べない)。
 *
 *  - 挙動A: WebViewがステータスバーの下から始まる。env(safe-area-inset-top)は0pxを返し、
 *           ステータスバーの帯はOSがtheme-colorで塗る。
 *  - 挙動B: WebViewが画面全体を覆う。env(safe-area-inset-top)は実値を返すが、
 *           レイアウトビューポート(innerHeight)だけがそのぶん短くなるため、
 *           画面下端に「文書が届いていない帯」が残る。
 *
 * ここでは挙動Bのズレを実測し、CSS変数 --ios-bottom-shim として公開する。
 * 決め打ちで伸ばす(min-height: calc(100% + env(safe-area-inset-top)))と、
 * ズレていない端末では逆に文書がはみ出してスクロールしてしまうため、
 * 「実際にズレているぶんだけ」伸ばすのが要点。
 */

/** ステータスバー相当を超える差分は測定ミス(ブラウザのUI等)とみなして無視する */
export const MAX_BOTTOM_SHIM_PX = 120;

/**
 * 画面の高さとレイアウトビューポートの高さの差(=挙動Bで下端に残る帯の高さ)を返す純粋関数。
 * 差が無い/負(ブラウザのタブ表示など)/大きすぎる場合は、伸ばさない意味の0を返す。
 */
export function measureBottomShim(screenHeight: number, innerHeight: number): number {
  const shortfall = Math.round(screenHeight - innerHeight);
  if (!Number.isFinite(shortfall) || shortfall <= 0 || shortfall > MAX_BOTTOM_SHIM_PX) return 0;
  return shortfall;
}

/** ホーム画面に追加したPWAとして起動しているか(iOS Safariは navigator.standalone を持つ) */
function isStandalone(): boolean {
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/**
 * --app-vh(ビューポートの実測高さ)と --ios-bottom-shim(挙動Bのズレ)をCSSへ反映し、
 * 復帰・回転のたびに測り直す。戻り値は後始末の関数。
 *
 * --app-vh: iOS PWAではマルチタスク復帰後などにWebKitが100dvhを再計算しないままになる
 * 既知バグがあるため、visualViewportの実測値で上書きして強制的に再計算させる。
 */
export function setupViewportMetrics(): () => void {
  const visualViewport = window.visualViewport;
  const root = document.documentElement;
  let rafId = 0;
  let orientationTimer = 0;

  const apply = () => {
    if (document.visibilityState === 'hidden') return;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      const height = visualViewport?.height ?? window.innerHeight;
      root.style.setProperty('--app-vh', `${height}px`);

      const shim = isStandalone() && window.screen ? measureBottomShim(window.screen.height, window.innerHeight) : 0;
      root.style.setProperty('--ios-bottom-shim', `${shim}px`);
      // 伸ばすときだけページ全体のスクロール禁止(overflow: hidden)を解く。
      // 解かないと伸ばしたぶんがビューポート端で切り取られ、下端の帯が戻ってしまう。
      root.classList.toggle('ios-bottom-shim', shim > 0);
    });
  };

  // 伸ばしたぶんだけ文書がビューポートより高くなるため、指で引っぱられても動かないよう原点に留める
  const pinScroll = () => {
    if (window.scrollY !== 0 && root.classList.contains('ios-bottom-shim')) {
      window.scrollTo(0, 0);
    }
  };

  const handleOrientationChange = () => {
    // 回転直後はまだ旧サイズが返るため、確定してから測り直す
    window.clearTimeout(orientationTimer);
    orientationTimer = window.setTimeout(apply, 300);
  };

  apply();
  visualViewport?.addEventListener('resize', apply);
  window.addEventListener('resize', apply);
  window.addEventListener('pageshow', apply);
  window.addEventListener('focus', apply);
  window.addEventListener('orientationchange', handleOrientationChange);
  document.addEventListener('visibilitychange', apply);
  window.addEventListener('scroll', pinScroll, { passive: true });

  return () => {
    cancelAnimationFrame(rafId);
    window.clearTimeout(orientationTimer);
    visualViewport?.removeEventListener('resize', apply);
    window.removeEventListener('resize', apply);
    window.removeEventListener('pageshow', apply);
    window.removeEventListener('focus', apply);
    window.removeEventListener('orientationchange', handleOrientationChange);
    document.removeEventListener('visibilitychange', apply);
    window.removeEventListener('scroll', pinScroll);
  };
}
