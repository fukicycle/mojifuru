import { useState } from 'react';
import type { OAuthCredential } from 'firebase/auth';
import {
  continueWithGoogle,
  describeAccountError,
  signOutAccount,
  switchToGoogleAccount,
} from '../firebase/account';
import { useAuthAccount } from '../hooks/useAuthAccount';

/**
 * タイトル画面の「Googleでつづける」。押さなくても今までどおり遊べる(任意)。
 *
 * ボタンは pointerdown ではなく click で受ける。タッチの pointerdown はブラウザが
 * ユーザー操作とみなさず、ポップアップがブロックされるため(ほかの画面の方針の例外)。
 */
export default function AccountPanel() {
  const { ready, account, refresh } = useAuthAccount(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<OAuthCredential | null>(null);

  const signedInWithGoogle = account !== null && !account.isAnonymous;

  async function handleContinue() {
    setBusy(true);
    setError(null);
    try {
      const result = await continueWithGoogle();
      if (result.kind === 'conflict') setConflict(result.credential);
      refresh();
    } catch (err) {
      setError(describeAccountError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSwitch() {
    if (!conflict) return;
    setBusy(true);
    setError(null);
    try {
      await switchToGoogleAccount(conflict);
    } catch (err) {
      setError(describeAccountError(err));
    } finally {
      setConflict(null);
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setError(null);
    try {
      await signOutAccount();
    } catch (err) {
      setError(describeAccountError(err));
    } finally {
      setBusy(false);
    }
  }

  // 復元前はどちらの表示になるか分からないため、ちらつかないよう場所だけ確保する
  if (!ready) return <div className="account-panel" aria-hidden />;

  return (
    <div className="account-panel">
      {signedInWithGoogle ? (
        <p className="account-status">
          Googleで ログイン中
          <button className="text-link-button" disabled={busy} onClick={handleSignOut}>
            ログアウト
          </button>
        </p>
      ) : (
        <>
          <button className="google-button" disabled={busy} onClick={handleContinue}>
            <GoogleMark />
            Googleでつづける
          </button>
          <p className="account-hint">きろくを ほかの端末にも ひきつげます</p>
        </>
      )}
      {error && <p className="form-error">{error}</p>}

      {conflict && (
        <div className="release-notes-backdrop">
          <div className="release-notes-panel account-conflict">
            <p className="account-conflict-title">ほかの端末の きろくに きりかえますか?</p>
            <p className="account-conflict-body">
              このGoogleアカウントは、ほかの端末ですでに つかわれています。
              きりかえると、この端末で いままで遊んだぶんの きろくは ひきつがれません。
            </p>
            <div className="button-row">
              <button className="button button--primary button--block" disabled={busy} onClick={handleSwitch}>
                きりかえる
              </button>
              <button
                className="button button--ghost button--block"
                disabled={busy}
                onClick={() => setConflict(null)}
              >
                やめる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Googleの「G」マーク(ブランドガイドラインの4色)。画像ファイルを増やさないためSVGを直書きする */
function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
