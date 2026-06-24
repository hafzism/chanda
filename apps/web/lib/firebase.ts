'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

function readFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !appId || !authDomain || !projectId) {
    throw new Error('Firebase client configuration is unavailable.');
  }

  return { apiKey, appId, authDomain, projectId };
}

function firebaseApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(readFirebaseConfig());
}

export function firebaseAuth(): Auth {
  return getAuth(firebaseApp());
}
