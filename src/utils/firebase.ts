import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  linkWithCredential,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import configJson from '../../firebase-applet-config.json';

const config = {
  ...configJson,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || configJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || configJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || configJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || configJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || configJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || configJson.appId,
};

const app = initializeApp(config);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Ensure Google provider requests email profile
googleProvider.addScope('email');
googleProvider.addScope('profile');

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const firebaseUser = auth.currentUser;
  if (firebaseUser) {
    try {
      const token = await firebaseUser.getIdToken();
      if (token) {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init.headers = headers;
      }
    } catch (err) {
      console.error('Erro ao injetar Token JWT de autenticação no Fetch:', err);
    }
  }
  return fetch(input, init);
}

export {
  GoogleAuthProvider,
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  linkWithCredential,
  onAuthStateChanged,
  updateProfile
};
