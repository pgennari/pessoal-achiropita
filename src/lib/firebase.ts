"use client";

import { FirebaseApp, getApps, initializeApp } from "firebase/app";
import { Auth, connectAuthEmulator, getAuth } from "firebase/auth";
import {
  Firestore,
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore";
import {
  FirebaseStorage,
  connectStorageEmulator,
  getStorage,
} from "firebase/storage";
import {
  Functions,
  connectFunctionsEmulator,
  getFunctions,
} from "firebase/functions";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;
let _functions: Functions | null = null;
let _emuladoresLigados = false;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  if (!config.projectId) {
    throw new Error(
      "Firebase não configurado. Preencha NEXT_PUBLIC_FIREBASE_* em .env.local."
    );
  }
  _app = getApps()[0] ?? initializeApp(config);
  return _app;
}

function ligarEmuladores() {
  if (_emuladoresLigados) return;
  if (process.env.NEXT_PUBLIC_USE_EMULATORS !== "1") return;
  if (typeof window === "undefined") return;
  _emuladoresLigados = true;
  if (_auth) connectAuthEmulator(_auth, "http://127.0.0.1:9099", { disableWarnings: true });
  if (_db) connectFirestoreEmulator(_db, "127.0.0.1", 8080);
  if (_storage) connectStorageEmulator(_storage, "127.0.0.1", 9199);
  if (_functions) connectFunctionsEmulator(_functions, "127.0.0.1", 5001);
}

export function getFirebaseAuth(): Auth {
  if (!_auth) _auth = getAuth(getFirebaseApp());
  ligarEmuladores();
  return _auth;
}

export function getDb(): Firestore {
  if (!_db) _db = getFirestore(getFirebaseApp());
  ligarEmuladores();
  return _db;
}

export function getStorageClient(): FirebaseStorage {
  if (!_storage) _storage = getStorage(getFirebaseApp());
  ligarEmuladores();
  return _storage;
}

export function getFunctionsClient(): Functions {
  if (!_functions) _functions = getFunctions(getFirebaseApp(), "southamerica-east1");
  ligarEmuladores();
  return _functions;
}
