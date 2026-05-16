import { useCallback, useEffect, useState } from 'react';
import { auth } from '../config/firebase';
import type { ManagedAdmin, ManagedAdminRole } from '../types/admin';

const ADMIN_FUNCTION_REGION = 'asia-southeast1';

const getAdminFunctionEndpoint = (functionName: string) => {
  const configuredBaseUrl = import.meta.env.VITE_ADMIN_FUNCTIONS_BASE_URL?.trim().replace(/\/$/, '');
  if (configuredBaseUrl) {
    return `${configuredBaseUrl}/${functionName}`;
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const isBrowser = typeof window !== 'undefined';
  const hostname = isBrowser ? window.location.hostname : '';
  const usesFirebaseHosting = hostname.endsWith('.web.app') || hostname.endsWith('.firebaseapp.com');

  if (projectId && !usesFirebaseHosting) {
    return `https://${ADMIN_FUNCTION_REGION}-${projectId}.cloudfunctions.net/${functionName}`;
  }

  return `/api/${functionName}`;
};

const parseFunctionResponse = async <T>(response: Response): Promise<T> => {
  const responseText = await response.text();
  const payload = responseText
    ? JSON.parse(responseText) as T & { error?: string }
    : {} as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.');
  }

  return payload;
};

const getAdminFunctionErrorMessage = (functionName: string, error: unknown) => {
  if (error instanceof TypeError) {
    if (functionName === 'updateAdminProfile') {
      return 'Failed to reach the admin update service. Deploy Firebase Functions and verify VITE_ADMIN_FUNCTIONS_BASE_URL if the frontend runs outside Firebase Hosting.';
    }

    return 'Failed to reach the admin service. Deploy Firebase Functions and verify VITE_ADMIN_FUNCTIONS_BASE_URL if the frontend runs outside Firebase Hosting.';
  }

  return error instanceof Error ? error.message : 'Request failed.';
};

const invokeAdminFunction = async <T>(functionName: string, options?: { method?: 'GET' | 'POST'; body?: Record<string, unknown> }) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to manage admins.');
  }

  const idToken = await currentUser.getIdToken();
  let response: Response;

  try {
    response = await fetch(getAdminFunctionEndpoint(functionName), {
      method: options?.method || 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: options?.method === 'GET' ? undefined : JSON.stringify(options?.body || {}),
    });
  } catch (error) {
    throw new Error(getAdminFunctionErrorMessage(functionName, error));
  }

  return parseFunctionResponse<T>(response);
};

interface ListAdminsResponse {
  admins: ManagedAdmin[];
}

export const useAdminManagement = (enabled: boolean) => {
  const [admins, setAdmins] = useState<ManagedAdmin[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const loadAdmins = useCallback(async () => {
    if (!enabled) {
      setAdmins([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await invokeAdminFunction<ListAdminsResponse>('listAdmins', { method: 'GET' });
      setAdmins(response.admins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admins.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  const createAdmin = useCallback(async (payload: {
    email: string;
    password: string;
    displayName: string;
    role: ManagedAdminRole;
  }) => {
    await invokeAdminFunction('createAdmin', { body: payload });
    await loadAdmins();
  }, [loadAdmins]);

  const updateAdminRole = useCallback(async (uid: string, role: ManagedAdminRole) => {
    await invokeAdminFunction('updateAdminRole', { body: { uid, role } });
    await loadAdmins();
  }, [loadAdmins]);

  const updateAdminProfile = useCallback(async (payload: {
    uid: string;
    email: string;
    displayName: string;
  }) => {
    await invokeAdminFunction('updateAdminProfile', { body: payload });
    await loadAdmins();
  }, [loadAdmins]);

  const setAdminDisabled = useCallback(async (uid: string, disabled: boolean) => {
    await invokeAdminFunction('disableAdmin', { body: { uid, disabled } });
    await loadAdmins();
  }, [loadAdmins]);

  const deleteAdmin = useCallback(async (uid: string) => {
    await invokeAdminFunction('deleteAdmin', { body: { uid } });
    await loadAdmins();
  }, [loadAdmins]);

  return {
    admins,
    loading,
    error,
    refreshAdmins: loadAdmins,
    createAdmin,
    updateAdminProfile,
    updateAdminRole,
    setAdminDisabled,
    deleteAdmin,
  };
};