import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError, getMe, logout as apiLogout, requestMagicLink, User } from '@/lib/api';

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return 'Request failed';
}

type AuthSessionContextValue = {
  user: User | null;
  isLoading: boolean;
  error: string;
  message: string;
  requestLogin: (email: string) => Promise<void>;
  refreshAuth: () => Promise<User | null>;
  clearAuth: () => void;
  signOut: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const clearAuth = useCallback(() => {
    setUser(null);
    setMessage('');
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const { user: currentUser } = await getMe();
      setUser(currentUser);
      return currentUser;
    } catch (caughtError) {
      setUser(null);

      if (caughtError instanceof ApiError && caughtError.status === 401) {
        return null;
      }

      setError(getErrorMessage(caughtError));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadAuth() {
      try {
        const { user: currentUser } = await getMe();

        if (!isMounted) {
          return;
        }

        setUser(currentUser);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        setUser(null);

        if (!(caughtError instanceof ApiError && caughtError.status === 401)) {
          setError(getErrorMessage(caughtError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const requestLogin = useCallback(async (email: string) => {
    setError('');
    setMessage('');

    try {
      await requestMagicLink(email);
      setMessage('Link sent. Check your email.');
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  }, []);

  const signOut = useCallback(async () => {
    setError('');
    setMessage('');
    await apiLogout();
    clearAuth();
  }, [clearAuth]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      error,
      message,
      requestLogin,
      refreshAuth,
      clearAuth,
      signOut,
    }),
    [clearAuth, error, isLoading, message, refreshAuth, requestLogin, signOut, user]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider');
  }

  return context;
}
