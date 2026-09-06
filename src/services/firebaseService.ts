import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  Firestore,
} from 'firebase/firestore';
import { CharacterMemory } from '../types';
import configJson from '../../firebase-applet-config.json';

// Firebase configuration with environment variable support & config file fallback
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || configJson.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || configJson.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || configJson.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || configJson.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || configJson.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || configJson.appId,
};

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || configJson.firestoreDatabaseId;

let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);
export const db: Firestore = databaseId ? getFirestore(app, databaseId) : getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface UserProfileData {
  uid: string;
  preferredName?: string;
  googleDisplayName?: string;
  googleEmail?: string;
  googlePhotoUrl?: string;
  createdAt: string;
  lastLoginAt: string;
}

export class FirebaseService {
  private currentUser: FirebaseUser | null = null;

  constructor() {
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
    });
  }

  public getCurrentUser(): FirebaseUser | null {
    return this.currentUser || auth.currentUser;
  }

  /**
   * Trigger Google Sign-In popup flow
   */
  public async signInWithGoogle(): Promise<{ user: FirebaseUser | null; isCancelled?: boolean; error?: string }> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Update user profile record in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      const now = new Date().toISOString();
      if (!userDocSnap.exists()) {
        const profileData: UserProfileData = {
          uid: user.uid,
          googleDisplayName: user.displayName || '',
          googleEmail: user.email || '',
          googlePhotoUrl: user.photoURL || '',
          createdAt: now,
          lastLoginAt: now,
        };
        await setDoc(userDocRef, { profile: profileData }, { merge: true });
      } else {
        await setDoc(
          userDocRef,
          {
            profile: {
              googleDisplayName: user.displayName || '',
              googleEmail: user.email || '',
              googlePhotoUrl: user.photoURL || '',
              lastLoginAt: now,
            },
          },
          { merge: true }
        );
      }

      return { user };
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.log('Google Sign-In popup closed by user.');
        return {
          user: null,
          isCancelled: true,
          error: 'Sign-in window was closed before completion.',
        };
      }

      console.warn('Google Sign-In notice:', err?.message || err);
      let userFriendlyError = 'Google Sign-In failed. Please try again.';
      if (err?.code === 'auth/popup-blocked') {
        userFriendlyError = 'Sign-in popup was blocked by your browser. Please allow popups.';
      } else if (err?.code === 'auth/network-request-failed') {
        userFriendlyError = 'Network error during authentication. Please check your connection.';
      }
      return { user: null, error: userFriendlyError };
    }
  }


  /**
   * Logout user from Firebase Auth
   */
  public async logout(): Promise<void> {
    try {
      await signOut(auth);
      this.currentUser = null;
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  /**
   * Fetch user profile from Firestore
   */
  public async getUserProfile(uid: string): Promise<UserProfileData | null> {
    try {
      const userDocRef = doc(db, 'users', uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists() && snap.data().profile) {
        return snap.data().profile as UserProfileData;
      }
    } catch (err) {
      console.warn('Failed to load user profile from Firestore:', err);
    }
    return null;
  }

  /**
   * Save user preferred name in Firestore
   */
  public async savePreferredName(uid: string, name: string): Promise<void> {
    try {
      const userDocRef = doc(db, 'users', uid);
      await setDoc(
        userDocRef,
        {
          profile: {
            preferredName: name.trim(),
            lastUpdated: new Date().toISOString(),
          },
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Failed to save preferred name to Firestore:', err);
    }
  }

  /**
   * Fetch isolated user memory from Firestore
   */
  public async getUserMemory(uid: string): Promise<CharacterMemory | null> {
    try {
      const userDocRef = doc(db, 'users', uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists() && snap.data().memory) {
        return snap.data().memory as CharacterMemory;
      }
    } catch (err) {
      console.warn('Failed to load user memory from Firestore:', err);
    }
    return null;
  }

  /**
   * Save isolated user memory to Firestore
   */
  public async saveUserMemory(uid: string, memory: CharacterMemory): Promise<void> {
    try {
      const userDocRef = doc(db, 'users', uid);
      await setDoc(
        userDocRef,
        {
          memory,
          lastUpdated: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Failed to save user memory to Firestore:', err);
    }
  }
}

export const firebaseService = new FirebaseService();
