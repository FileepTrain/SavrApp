import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { Platform } from "react-native";

/** Matches server Firebase project (see server/app.js). Override via env if needed. */
const defaultProjectId = "savr-6ab25";
const defaultFirebaseWebConfig = {
  apiKey: "AIzaSyDZk4dq29XZEJpkY1ZQg4JRAMWt8hMdYnA",
  messagingSenderId: "396753555804",
  appId: "1:396753555804:web:da9c18dfb026ade8da7199",
};

const projectId =
  process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? defaultProjectId;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? defaultFirebaseWebConfig.apiKey,
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    `${projectId}.firebasestorage.app`,
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    defaultFirebaseWebConfig.messagingSenderId,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? defaultFirebaseWebConfig.appId,
};

let authSingleton = null;

/** Initializes Firebase auth with persistence support on native. */
function initAuth() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

  if (Platform.OS === "web") {
    return getAuth(app);
  }

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (e) {
    if (e?.code === "auth/already-initialized") {
      return getAuth(app);
    }
    throw e;
  }
}

export function getFirebaseAuth() {
  if (!authSingleton) {
    authSingleton = initAuth();
  }
  return authSingleton;
}

export const auth = getFirebaseAuth();
