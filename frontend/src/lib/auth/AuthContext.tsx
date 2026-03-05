'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

// 5 roles khớp với certificate attribute trong Fabric CA (docs/02_roles_and_orgs.md)
export type UserRole =
  | 'FARMER'
  | 'PROCESSOR'
  | 'ROASTER'
  | 'PACKAGER'
  | 'RETAILER';

// Mapping role → dashboard path — dùng chung ở login page, dashboard redirect, middleware
export const ROLE_DASHBOARD: Record<UserRole, string> = {
  FARMER:    '/dashboard/farmer',
  PROCESSOR: '/dashboard/processor',
  ROASTER:   '/dashboard/roaster',
  PACKAGER:  '/dashboard/packager',
  RETAILER:  '/dashboard/retailer',
};

interface AuthUser {
  userId: string;
  role: UserRole;
  token: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (userId: string, token: string, role: UserRole) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  // Rehydrate từ localStorage khi app load lại
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setUser(JSON.parse(stored) as AuthUser);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const login = (userId: string, token: string, role: UserRole) => {
    const authUser: AuthUser = { userId, token, role };
    setUser(authUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    // Set cookies để Next.js middleware đọc được (middleware không access localStorage)
    document.cookie = `auth_token=${token}; path=/; SameSite=Lax`;
    document.cookie = `user_role=${role}; path=/; SameSite=Lax`;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
