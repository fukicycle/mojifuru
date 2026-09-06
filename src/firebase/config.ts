import { type FirebaseApp, initializeApp } from 'firebase/app';
import { type Auth, getAuth, signInAnonymously } from 'firebase/auth';
import { type Database, getDatabase } from 'firebase/database';

/**
 * Firebase設定。バックエンドサーバーを持たない構成のため、
 * 認証・データ永続化・対戦同期はすべてFirebase(Anonymous Auth + RTDB)で完結させる。
 *
 * .env.local に VITE_FIREBASE_* を設定して使う(.env.example 参照)。
 * 未設定の場合、対戦モード・ランキングは無効化され、ひとりで遊ぶモードのみ動作する。
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;

function ensureApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebaseが設定されていません(.env.local に VITE_FIREBASE_* を設定してください)');
  }
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) auth = getAuth(ensureApp());
  return auth;
}

export function getFirebaseDb(): Database {
  if (!db) db = getDatabase(ensureApp());
  return db;
}

let anonymousSignInPromise: Promise<string> | null = null;

/** 匿名認証でサインインし、uidを返す(既にサインイン済みなら即座に返す) */
export function signInAnonymouslyOnce(): Promise<string> {
  if (!anonymousSignInPromise) {
    anonymousSignInPromise = new Promise((resolve, reject) => {
      const auth = getFirebaseAuth();
      if (auth.currentUser) {
        resolve(auth.currentUser.uid);
        return;
      }
      signInAnonymously(auth)
        .then((cred) => resolve(cred.user.uid))
        .catch(reject);
    });
  }
  return anonymousSignInPromise;
}
