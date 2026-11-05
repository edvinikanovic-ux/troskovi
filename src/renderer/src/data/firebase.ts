import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore
} from 'firebase/firestore'

// The project settings come from .env (see .env.example and docs/firebase-setup.md). They are not
// secrets: access is protected by sign-in and the rules in firestore.rules. Without them the app
// simply stays local-only.
const env = import.meta.env
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined
}

export const cloudConfigured = Boolean(config.apiKey && config.projectId && config.appId)

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined

const getApp = (): FirebaseApp => (app ??= getApps()[0] ?? initializeApp(config))

export function firebaseAuth(): Auth {
  return (auth ??= getAuth(getApp()))
}

// opened only after sign-in; keeps a copy on the device, so the app also works offline
export function firebaseDb(): Firestore {
  return (db ??= initializeFirestore(getApp(), {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  }))
}
