'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import { ROLE_DASHBOARD } from '@/lib/auth/AuthContext';

/**
 * /dashboard → redirect sang /dashboard/{role} dựa trên user hiện tại.
 * Nếu chưa đăng nhập → middleware đã chặn trước, nhưng vẫn fallback về /login.
 */
export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    } else if (user) {
      router.replace(ROLE_DASHBOARD[user.role]);
    }
  }, [isAuthenticated, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-amber-50">
      <p className="text-sm text-gray-500">Đang chuyển hướng...</p>
    </div>
  );
}
