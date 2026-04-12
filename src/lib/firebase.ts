import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain:        import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.PUBLIC_FIREBASE_APP_ID,
  measurementId:     import.meta.env.PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Singleton — evita re-inicializar en HMR
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const auth         = getAuth(app);
export const db           = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Analytics solo en browser (falla en SSR/build)
export async function getAnalyticsInstance() {
  if (typeof window === 'undefined') return null;
  const { getAnalytics } = await import('firebase/analytics');
  return getAnalytics(app);
}
