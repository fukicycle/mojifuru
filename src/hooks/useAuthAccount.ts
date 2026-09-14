import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { getFirebaseAuth } from '../firebase/config';

export interface AuthAccount {
  uid: string;
  isAnonymous: boolean;
}

/** Userはその場で書き換わる(連携しても同じ参照のまま)ため、表示に要る値だけを取り出して新しい値として持つ */
function toAccount(user: User | null): AuthAccount | null {
  return user ? { uid: user.uid, isAnonymous: user.isAnonymous } : null;
}

/**
 * いまのサインイン状態を購読する。購読するだけで匿名認証は走らせない
 * (「ひとりで遊ぶ」だけの人にはユーザーを作らないという、これまでの挙動を保つ)。
 *
 * `ready` は保存済みのログイン状態の復元が済んだかどうか。済むまではGoogleのボタンを押させない
 * (復元前にポップアップを開くと、連携すべき匿名ユーザーを取り違えるため)。
 */
export function useAuthAccount(enabled: boolean) {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<AuthAccount | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (user) => {
      setAccount(toAccount(user));
      setReady(true);
    });
  }, [enabled]);

  /** 連携(linkWithPopup)はuidが変わらずonAuthStateChangedが発火しないため、終わったら呼んで反映する */
  const refresh = useCallback(() => {
    if (enabled) setAccount(toAccount(getFirebaseAuth().currentUser));
  }, [enabled]);

  return { ready, account, refresh };
}
