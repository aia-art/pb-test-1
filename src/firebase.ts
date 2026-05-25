/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, type User } from 'firebase/auth';
import { getDatabase, ref, set, onValue, push, update, type Database, child, get } from 'firebase/database';

let app;
let auth: ReturnType<typeof getAuth> | null = null;
let database: Database | null = null;
let isFirebaseConnected = false;

// Attempt optional loading (will connect if config is supplied via firebase-applet-config.json or matching process envs)
const fallbackConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

try {
  // Check if we can find config in localStorage or standard env injection
  const storedConfig = localStorage.getItem('firebase_config_override');
  const firebaseConfig = storedConfig ? JSON.parse(storedConfig) : fallbackConfig;

  if (firebaseConfig.apiKey && firebaseConfig.databaseURL) {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }
    auth = getAuth(app);
    database = getDatabase(app);
    isFirebaseConnected = true;
    console.log("Firebase Realtime Database initialized successfully!");
  }
} catch (error) {
  console.warn("Firebase not active in this development turn. Falling back to high-fidelity Simulated Arena Mode.", error);
}

export { auth, database, isFirebaseConnected };

// Custom helper to quickly configure custom firebase details in the client UI
export function overrideFirebaseConfig(config: typeof fallbackConfig) {
  try {
    localStorage.setItem('firebase_config_override', JSON.stringify(config));
    window.location.reload();
  } catch (err) {
    console.error("Failed to store custom config", err);
  }
}

export async function loginWithGoogle(): Promise<User | null> {
  if (!auth) return null;
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Google authentication failed:", error);
    return null;
  }
}

export async function logoutUser() {
  if (!auth) return;
  await signOut(auth);
}
