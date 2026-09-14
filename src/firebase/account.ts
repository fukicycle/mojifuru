import {
  type OAuthCredential,
  GoogleAuthProvider,
  linkWithPopup,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { getFirebaseAuth } from './config';

/**
 * Googleアカウント連携(任意)。匿名認証のuidはブラウザごとに別になるため、
 * 記録(ランキングの自己ベスト・ルームの戦績)をほかの端末へ引き継ぎたい人だけが使う。
 *
 * - 匿名ユーザーは `linkWithPopup` でGoogleを結びつける。uidが変わらないので、それまでの記録はそのまま残る
 * - 未サインインなら、そのままGoogleでサインインする
 * - リダイレクト方式は使わない。authDomain(firebaseapp.com)と配信元のドメインが違うと、
 *   ブラウザのサードパーティストレージ制限でログイン結果を受け取れないことがあるため
 *
 * ポップアップはユーザー操作の直後に開かないとブロックされる。呼び出し側は `authStateReady` を
 * 待ち終えてから(= ボタンを押せる状態にしてから)呼び、ここでは開く前にawaitを挟まないこと。
 */

export type GoogleContinueResult =
  | { kind: 'linked' }
  | { kind: 'signed-in' }
  | { kind: 'cancelled' }
  /** そのGoogleアカウントは別のuidに結びついている。切り替えるとこのブラウザの匿名uidの記録は引き継げない */
  | { kind: 'conflict'; credential: OAuthCredential };

const CANCELLED_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);

export async function continueWithGoogle(): Promise<GoogleContinueResult> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const current = auth.currentUser;

  try {
    if (!current) {
      await signInWithPopup(auth, provider);
      return { kind: 'signed-in' };
    }
    if (!current.isAnonymous) return { kind: 'signed-in' };
    await linkWithPopup(current, provider);
    // 連携してもuidは変わらないためonAuthStateChangedは発火しない。表示を更新するのは呼び出し側の責務
    return { kind: 'linked' };
  } catch (err) {
    if (err instanceof FirebaseError) {
      if (CANCELLED_CODES.has(err.code)) return { kind: 'cancelled' };
      if (err.code === 'auth/credential-already-in-use') {
        const credential = GoogleAuthProvider.credentialFromError(err);
        if (credential) return { kind: 'conflict', credential };
      }
    }
    throw err;
  }
}

/** 別のuidに結びついたGoogleアカウントへ切り替える(このブラウザの匿名uidは手放す) */
export async function switchToGoogleAccount(credential: OAuthCredential): Promise<void> {
  await signInWithCredential(getFirebaseAuth(), credential);
}

/** ログアウトする。次にランキング送信や対戦をすると、新しい匿名ユーザーとして扱われる */
export async function signOutAccount(): Promise<void> {
  await signOut(getFirebaseAuth());
}

export function describeAccountError(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === 'auth/popup-blocked') {
      return 'ポップアップがブロックされました。ブラウザの設定で許可してから、もう一度おしてください';
    }
    if (err.code === 'auth/network-request-failed') {
      return 'つうしんに失敗しました。電波のよいところで、もう一度おしてください';
    }
    if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/unauthorized-domain') {
      return 'いまはGoogleでログインできません(設定を確認中です)';
    }
  }
  return 'Googleでのログインに失敗しました';
}
