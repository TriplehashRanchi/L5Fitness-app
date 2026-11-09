/**
 * Firebase: handles sign-up, login and Google sign-in.
 *
 * The project values come from .env.local, not from this file. They end up inside every app
 * build, so never put a private or service-account key here.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { Platform } from 'react-native';

// Each value is read from .env.local (see .env.example). They must be written exactly like this,
// as process.env.EXPO_PUBLIC_…, for Expo to put them into the app.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/** The "Web client ID" of Google sign-in for this Firebase project. Google's picker needs it. */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';

function createAuth(): Auth {
  const existing = getApps().length > 0;
  const app = existing ? getApp() : initializeApp(firebaseConfig);
  if (Platform.OS === 'web') return getAuth(app);
  if (existing) return getAuth(app);
  // On a phone the member stays signed in after the app is closed: Firebase keeps the login
  // in the app's storage.
  // Firebase includes this function in the phone build but leaves it out of the type
  // definitions that TypeScript reads by default, so it is looked up here instead.
  const { getReactNativePersistence } = FirebaseAuth as unknown as {
    getReactNativePersistence: (storage: typeof AsyncStorage) => FirebaseAuth.Persistence;
  };
  return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
}

export const auth = createAuth();
