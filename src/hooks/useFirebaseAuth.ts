import { useState, useEffect, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  signInAnonymously,
  onAuthStateChanged,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../config/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
}

interface AuthContextReturn extends AuthState {
  signUpAdmin: (email: string, password: string) => Promise<void>;
  loginAdmin: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useFirebaseAuth = (): AuthContextReturn => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    isAdmin: false,
  });
  const autoGuestAttemptedRef = useRef(false);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthState({
        user,
        loading: false,
        error: null,
        isAdmin: user ? !user.isAnonymous : false, // Admin = authenticated user (not anonymous)
      });
    });

    return () => unsubscribe();
  }, []);

  // Auto sign-in as anonymous for read-only guest access
  useEffect(() => {
    if (!authState.loading && !authState.user && !autoGuestAttemptedRef.current) {
      autoGuestAttemptedRef.current = true;
      signInAnonymously(auth)
        .catch((err) => {
          const { code, message } = normalizeAuthError(err);
          const errorMessage = `${getErrorMessage(code)} (${code})`;
          console.error('Auto anonymous sign-in failed:', code, message, err);
          console.warn(errorMessage);
        });
    }
  }, [authState.loading, authState.user]);

  const signUpAdmin = async (email: string, password: string): Promise<void> => {
    try {
      setAuthState((prev) => ({ ...prev, error: null, loading: true }));
      await createUserWithEmailAndPassword(auth, email, password);
      setAuthState((prev) => ({ ...prev, loading: false }));
    } catch (err) {
      const { code } = normalizeAuthError(err);
      const errorMessage = getErrorMessage(code);
      setAuthState((prev) => ({ ...prev, error: errorMessage, loading: false }));
      throw new Error(errorMessage);
    }
  };

  const loginAdmin = async (email: string, password: string): Promise<void> => {
    try {
      setAuthState((prev) => ({ ...prev, error: null, loading: true }));
      await signInWithEmailAndPassword(auth, email, password);
      setAuthState((prev) => ({ ...prev, loading: false }));
    } catch (err) {
      const { code } = normalizeAuthError(err);
      const errorMessage = getErrorMessage(code);
      setAuthState((prev) => ({ ...prev, error: errorMessage, loading: false }));
      throw new Error(errorMessage);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setAuthState((prev) => ({ ...prev, error: null, loading: true }));
      await signOut(auth);
      // Re-sign in as anonymous after logout
      await signInAnonymously(auth);
      autoGuestAttemptedRef.current = true;
      setAuthState((prev) => ({ ...prev, loading: false }));
    } catch (err) {
      const { code } = normalizeAuthError(err);
      const errorMessage = getErrorMessage(code);
      setAuthState((prev) => ({ ...prev, error: errorMessage, loading: false }));
      throw new Error(errorMessage);
    }
  };

  return {
    ...authState,
    signUpAdmin,
    loginAdmin,
    logout,
  };
};

/**
 * Convert Firebase auth error codes to user-friendly messages
 */
function getErrorMessage(code: string): string {
  const errors: { [key: string]: string } = {
    'auth/email-already-in-use': 'This email is already registered. Please log in instead.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-not-found': 'No account found with this email. Please sign up.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/too-many-requests': 'Too many login attempts. Please try again later.',
    'auth/operation-not-allowed': 'Authentication method is not enabled in Firebase.',
    'auth/admin-restricted-operation': 'This action is restricted. Create the user in Firebase Console or enable email/password sign-up.',
  };

  return errors[code] || 'Authentication failed. Please try again.';
}

function normalizeAuthError(err: unknown): { code: string; message: string } {
  if (typeof err === 'object' && err !== null) {
    const code = 'code' in err ? String((err as { code?: unknown }).code ?? 'auth/unknown') : 'auth/unknown';
    const message = 'message' in err ? String((err as { message?: unknown }).message ?? '') : '';
    return { code, message };
  }

  return { code: 'auth/unknown', message: String(err) };
}
