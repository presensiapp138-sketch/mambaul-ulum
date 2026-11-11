import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthUser } from '../types/index.ts';
import { apiRequest, getStoredToken, setStoredToken } from '../lib/api.ts';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes idle timeout

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const idleTimerRef = useRef<number | null>(null);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  // Idle timer listener
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current);
    }
    if (user) {
      idleTimerRef.current = window.setTimeout(() => {
        console.info('Auto-logged out due to inactivity.');
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [user, logout]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, resetIdleTimer));
    resetIdleTimer();

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetIdleTimer));
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, [resetIdleTimer]);

  const refreshUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await apiRequest<{ user: AuthUser }>('/api/auth/me');
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        logout();
      }
    } catch {
      logout();
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      if (res.success && res.token && res.user) {
        setStoredToken(res.token);
        setUser(res.user);
        return { success: true };
      }
      return { success: false, error: res.error || 'Login gagal.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal terhubung ke server.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
