'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

export type UserRole =
  | 'FARMER'
  | 'PROCESSOR'
  | 'ROASTER'
  | 'PACKAGER'
  | 'RETAILER';

export const ROLE_DASHBOARD: Record<UserRole, string> = {
  FARMER: '/dashboard/farmer',
  PROCESSOR: '/dashboard/processor',
  ROASTER: '/dashboard/roaster',
  PACKAGER: '/dashboard/packager',
  RETAILER: '/dashboard/retailer',
};

interface AuthUser {
  userId: string;
  role: UserRole;
  token: string;
  org: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (userId: string, token: string, role: UserRole, org?: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isHydrated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'auth_user';

function normalizeToken(token: string): string {
  return token.replace(/^Bearer\s+/i, '').trim();
}

function roleToOrg(role: UserRole): string {
  return role === 'PACKAGER' || role === 'RETAILER' ? 'Org2' : 'Org1';
}

async function setSessionCookie(token: string): Promise<void> {
  try {
    await fetch('/api/auth/set-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Fallback: set non-HttpOnly cookie if route unavailable (dev without full Next.js server)
    document.cookie = `auth_token=${token}; path=/; SameSite=Lax`;
  }
}

async function clearSessionCookie(): Promise<void> {
  try {
    await fetch('/api/auth/set-session', { method: 'DELETE' });
  } catch {
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<AuthUser>;
        if (parsed.userId && parsed.role && parsed.token) {
          setUser({
            userId: parsed.userId,
            role: parsed.role,
            token: parsed.token,
            org: parsed.org?.trim() || roleToOrg(parsed.role),
          });
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsHydrated(true);
  }, []);

  const login = (userId: string, token: string, role: UserRole, org?: string) => {
    const normalizedToken = normalizeToken(token);
    const authUser: AuthUser = {
      userId,
      token: normalizedToken,
      role,
      org: org?.trim() || roleToOrg(role),
    };
    setUser(authUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    // Set auth_token as HttpOnly cookie via server route (protects against XSS).
    // user_role and user_org are UI-only state — not used for backend authorization.
    void setSessionCookie(normalizedToken);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    void clearSessionCookie();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, isHydrated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
