import { createUserWithEmailAndPassword, signOut, signInAnonymously } from 'firebase/auth';
import { auth } from '../config/firebase';

export const DEFAULT_ADMIN_EMAIL = import.meta.env.VITE_DEFAULT_ADMIN_EMAIL || '';
export const DEFAULT_ADMIN_PASSWORD = import.meta.env.VITE_DEFAULT_ADMIN_PASSWORD || '';
const FLAG_KEY = 'defaultAdminCreatedV1';

export async function createDefaultAdminUser(): Promise<void> {
  if (!DEFAULT_ADMIN_EMAIL || !DEFAULT_ADMIN_PASSWORD) {
    return;
  }

  try {
    if (typeof window !== 'undefined' && localStorage.getItem(FLAG_KEY)) {
      return; // already attempted
    }

    // Attempt to create the user
    await createUserWithEmailAndPassword(auth, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD);
    // If creation succeeds, sign out and fall back to anonymous
    await signOut(auth);
    await signInAnonymously(auth).catch(() => {});

    if (typeof window !== 'undefined') {
      localStorage.setItem(FLAG_KEY, '1');
    }
    console.log('Default admin user created successfully');
  } catch (err: unknown) {
    // If the email already exists, mark as done and continue
    const code = getAuthErrorCode(err);
    if (code === 'auth/email-already-in-use') {
      if (typeof window !== 'undefined') localStorage.setItem(FLAG_KEY, '1');
      console.log('Default admin already exists');
      return;
    }

    // For operation-not-allowed (email/password disabled), log guidance
    if (code === 'auth/operation-not-allowed') {
      console.warn('Email/password auth not enabled. Enable it in Firebase Console.');
      return;
    }

    console.error('Failed to create default admin user:', err);
    // Do not rethrow - non-fatal for app
  }
}

function getAuthErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return String((err as { code?: unknown }).code ?? 'auth/unknown');
  }

  return 'auth/unknown';
}
