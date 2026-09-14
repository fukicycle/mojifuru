import { describe, expect, it } from 'vitest';
import { measureBottomShim, MAX_BOTTOM_SHIM_PX } from './viewport';

describe('measureBottomShim', () => {
  it('挙動B(WebViewが画面全体を覆い、レイアウトビューポートだけが短い)ではズレぶんを返す', () => {
    // iPhone 14 Pro相当: 画面852pt / ステータスバーぶん(59pt)短いビューポート
    expect(measureBottomShim(852, 793)).toBe(59);
  });

  it('ズレていない端末では0(決め打ちで伸ばすと逆に文書がはみ出すため)', () => {
    expect(measureBottomShim(852, 852)).toBe(0);
  });

  it('ビューポートのほうが高い(ブラウザのタブ表示など)場合は0', () => {
    expect(measureBottomShim(852, 900)).toBe(0);
  });

  it('ステータスバー相当を超える差は測定ミスとみなして0', () => {
    expect(measureBottomShim(852, 852 - MAX_BOTTOM_SHIM_PX - 1)).toBe(0);
    expect(measureBottomShim(852, 852 - MAX_BOTTOM_SHIM_PX)).toBe(MAX_BOTTOM_SHIM_PX);
  });

  it('小数の実測値は整数に丸める', () => {
    expect(measureBottomShim(852, 804.6)).toBe(47);
  });

  it('値が取れない環境(NaN)では0', () => {
    expect(measureBottomShim(Number.NaN, 793)).toBe(0);
  });
});
