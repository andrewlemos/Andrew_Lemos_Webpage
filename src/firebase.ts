import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup as firebaseSignInWithPopup, signOut } from 'firebase/auth';
import { initializeFirestore, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc, where, or, and, limit, getDocs, getDocsFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
} as any, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// Safe signInWithPopup wrapper to prevent concurrent calls which trigger Firebase Auth's
// "INTERNAL ASSERTION FAILED: Pending promise was never set" error.
let activeSignInPromise: Promise<any> | null = null;

const signInWithPopup = async (authInstance: any, provider: any) => {
  if (activeSignInPromise) {
    console.warn("[Safe Auth] Uma tentativa de login com Google já está em andamento. Ignorando chamada duplicada.");
    return activeSignInPromise;
  }

  activeSignInPromise = (async () => {
    try {
      return await firebaseSignInWithPopup(authInstance, provider);
    } catch (error: any) {
      if (error?.message?.includes("INTERNAL ASSERTION FAILED") || error?.message?.includes("Pending promise was never set")) {
        console.error("[Safe Auth] Erro interno do Firebase interceptado com sucesso.");
      }
      throw error;
    } finally {
      // Short delay before allowing another authentication attempt
      setTimeout(() => {
        activeSignInPromise = null;
      }, 1500);
    }
  })();

  return activeSignInPromise;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { signInWithPopup, signOut, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc, where, or, and, limit, getDocs, getDocsFromServer };

