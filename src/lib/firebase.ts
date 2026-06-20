// Inicialização do Firebase — apenas Authentication.
// Firestore, Storage e Functions foram substituídos pela API REST (Cloud Run).
import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, connectAuthEmulator, getAuth } from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _emuladoresLigados = false;

function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  if (!config.projectId) {
    throw new Error("Firebase não configurado. Preencha VITE_FIREBASE_* em .env.local.");
  }
  _app = getApps()[0] ?? initializeApp(config);
  return _app;
}

function ligarEmuladores() {
  if (_emuladoresLigados) return;
  if (import.meta.env.VITE_USE_EMULATORS !== "1") return;
  _emuladoresLigados = true;
  if (_auth) connectAuthEmulator(_auth, "http://127.0.0.1:9099", { disableWarnings: true });
}

export function auth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  ligarEmuladores();
  return _auth;
}
