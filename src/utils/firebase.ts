import { 
  EmailAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  linkWithCredential,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider
} from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { app, auth, googleProvider } from '../firebase';

export const storage = getStorage(app);

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
  auth,
  googleProvider,
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
