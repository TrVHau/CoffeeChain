'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_DASHBOARD, type UserRole } from './AuthContext';
import { useAuth } from './useAuth';

interface UseRoleGuardResult {
  ready: boolean;
}

export function useRoleGuard(requiredRole: UserRole): UseRoleGuardResult {
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuth();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }
    if (user.role !== requiredRole) {
      router.replace(ROLE_DASHBOARD[user.role]);
    }
  }, [isHydrated, isAuthenticated, user, requiredRole, router]);

  const ready = isHydrated && !!user && isAuthenticated && user.role === requiredRole;
  return { ready };
}
