'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import { ROLE_DASHBOARD } from '@/lib/auth/AuthContext';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuth();

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated || !user) {
      router.replace('/login');
      return;
    }
    router.replace(ROLE_DASHBOARD[user.role]);
  }, [isHydrated, isAuthenticated, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-rose-50">
      <p className="text-sm text-rose-700/70">Dang chuyen huong...</p>
    </div>
  );
}
