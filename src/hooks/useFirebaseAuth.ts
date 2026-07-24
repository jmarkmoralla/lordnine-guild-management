import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import type { AppRole } from '../types/admin';

const INSUFFICIENT_ROLE_CODE = 'auth/insufficient-role';
const DISABLED_ADMIN_CODE = 'auth/disabled-admin';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isGuildAdmin: boolean;
  role: AppRole;
  canManageAdmins: boolean;
  guild: string;
}

interface AuthContextReturn extends AuthState {
  loginAdmin: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useFirebaseAuth = (): AuthContextReturn => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
    isAdmin: false,
    isGuildAdmin: false,
    role: 'guest',
    canManageAdmins: false,
    guild: '',
  });
  // Listen to auth state changes
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const adminAccess = user ? await getAdminAccess(user) : {
        isAdmin: false,
        isGuildAdmin: false,
        isEnabled: false,
        role: 'guest' as AppRole,
        canManageAdmins: false,
        guild: '',
      };
      if (!isMounted) return;

      setAuthState({
        user,
        loading: false,
        error: null,
        isAdmin: adminAccess.isAdmin,
        isGuildAdmin: adminAccess.isGuildAdmin,
        role: adminAccess.role,
        canManageAdmins: adminAccess.canManageAdmins,
        guild: adminAccess.guild,
      });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginAdmin = async (email: string, password: string): Promise<void> => {
    try {
      setAuthState((prev) => ({ ...prev, error: null, loading: true }));
      await signInWithEmailAndPassword(auth, email, password);

      const currentUser = auth.currentUser;
      const adminAccess = currentUser ? await getAdminAccess(currentUser) : {
        isAdmin: false,
        isGuildAdmin: false,
        isEnabled: false,
        role: 'guest' as AppRole,
        canManageAdmins: false,
      };
      if (!adminAccess.isAdmin && !adminAccess.isGuildAdmin) {
        await signOut(auth);
        const authRoleError = new Error(
          !adminAccess.isEnabled
            ? 'This admin account is disabled.'
            : 'This account does not have admin access.'
        ) as Error & { code: string };
        authRoleError.code = !adminAccess.isEnabled
          ? DISABLED_ADMIN_CODE
          : INSUFFICIENT_ROLE_CODE;
        throw authRoleError;
      }

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
    'auth/disabled-admin': 'This admin account is disabled.',
    'auth/insufficient-role': 'This account does not have the admin role.',
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

async function getAdminAccess(user: User): Promise<{
  isAdmin: boolean;
  isGuildAdmin: boolean;
  isEnabled: boolean;
  role: AppRole;
  canManageAdmins: boolean;
  guild: string;
}> {
  if (user.isAnonymous) {
    return { isAdmin: false, isGuildAdmin: false, isEnabled: false, role: 'guest', canManageAdmins: false, guild: '' };
  }

  try {
    const adminDocRef = doc(db, 'admins', user.uid);
    const adminDoc = await getDoc(adminDocRef);
    if (!adminDoc.exists()) {
      return { isAdmin: false, isGuildAdmin: false, isEnabled: false, role: 'guest', canManageAdmins: false, guild: '' };
    }

    const data = adminDoc.data()
    const isEnabled = data?.enabled === true;
    const guild = typeof data?.guild === 'string' ? data.guild : '';
    const role = isEnabled
      ? normalizeAdminRole(data?.role, true)
      : normalizeAdminRole(data?.role, false);

    const isGuildAdmin = isEnabled && role === 'guild_admin';
    const isAdmin = isEnabled && (role === 'admin' || role === 'super_admin');

    return {
      isAdmin,
      isGuildAdmin,
      isEnabled,
      role: isEnabled ? role : 'guest',
      canManageAdmins: isEnabled && role === 'super_admin',
      guild,
    };
  } catch {
    return { isAdmin: false, isGuildAdmin: false, isEnabled: false, role: 'guest', canManageAdmins: false, guild: '' };
  }
}

function normalizeAdminRole(role: unknown, fallbackToSuperAdmin: boolean): Exclude<AppRole, 'guest'> {
  if (role === 'super_admin') return 'super_admin';
  if (role === 'admin') return 'admin';
  if (role === 'guild_admin') return 'guild_admin';
  return fallbackToSuperAdmin ? 'super_admin' : 'admin';
}
