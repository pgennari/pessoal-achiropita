import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, connectAuthEmulator, getAuth } from "firebase/auth";
import {
  Firestore,
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore";
import {
  Functions,
  connectFunctionsEmulator,
  getFunctions,
} from "firebase/functions";
import {
  FirebaseStorage,
  connectStorageEmulator,
  getStorage,
} from "firebase/storage";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env
    .VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _functions: Functions | null = null;
let _emuladoresLigados = false;

function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  if (!config.projectId) {
    throw new Error(
      "Firebase não configurado. Preencha VITE_FIREBASE_* em .env.local."
    );
  }
  _app = getApps()[0] ?? initializeApp(config);
  return _app;
}

function ligarEmuladores() {
  if (_emuladoresLigados) return;
  if (import.meta.env.VITE_USE_EMULATORS !== "1") return;
  _emuladoresLigados = true;
  if (_auth)
    connectAuthEmulator(_auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
  if (_db) connectFirestoreEmulator(_db, "127.0.0.1", 8080);
  if (_storage) connectStorageEmulator(_storage, "127.0.0.1", 9199);
}

export function auth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  ligarEmuladores();
  return _auth;
}

export function db(): Firestore {
  if (!_db) _db = getFirestore(getFirebaseApp());
  ligarEmuladores();
  return _db;
}

export function storage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(getFirebaseApp());
  ligarEmuladores();
  return _storage;
}

export function functions(): Functions {
  if (!_functions) {
    _functions = getFunctions(getFirebaseApp());
    if (import.meta.env.VITE_USE_EMULATORS === "1") {
      connectFunctionsEmulator(_functions, "127.0.0.1", 5001);
    }
  }
  return _functions;
}
