import { useState, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { attendanceAuth } from '../config/firebase';

interface SecondAuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isReady: boolean;
}

export const useSecondFirebaseAuth = (): SecondAuthState => {
  const [state, setState] = useState<SecondAuthState>({
    user: null,
    loading: true,
    error: null,
    isReady: false,
  });

  useEffect(() => {
    if (!attendanceAuth) {
      setState({ user: null, loading: false, error: 'Second Firebase project not configured', isReady: false });
      return;
    }

    const auth = attendanceAuth;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setState({ user, loading: false, error: null, isReady: true });
      } else {
        signInAnonymously(auth)
          .then(() => {
            setState((prev) => ({ ...prev, loading: false }));
          })
          .catch((err) => {
            const message = err instanceof Error ? err.message : 'Failed to authenticate with attendance Firebase.';
            setState({ user: null, loading: false, error: message, isReady: false });
          });
      }
    });

    return () => unsubscribe();
  }, []);

  return state;
};
