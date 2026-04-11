'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import { type UserRole } from '@/lib/auth/AuthContext';

interface LoginResponse {
  token: string;
  role: UserRole;
}

// Tách riêng phần dùng useSearchParams để wrap Suspense (Next.js 14 requirement)
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, user } = useAuth();

  const [userId, setUserId]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Nếu đã đăng nhập → redirect thẳng vào dashboard (tránh re-login)
  useEffect(() => {
    if (isAuthenticated && user) {
      const redirectTo = searchParams.get('redirectTo');
      router.replace(redirectTo ?? '/dashboard');
    }
  }, [isAuthenticated, user, router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ''}/api/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, password }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        setError(data.message ?? 'Đăng nhập thất bại. Kiểm tra lại userId / mật khẩu.');
        return;
      }

      const data = await res.json() as LoginResponse;
      login(userId, data.token, data.role);

      const redirectTo = searchParams.get('redirectTo');
      router.push(redirectTo ?? '/dashboard');
    } catch {
      setError('Không thể kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-amber-50">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-amber-800">☕ CoffeeChain</h1>
          <p className="mt-1 text-sm text-gray-500">Truy xuất nguồn gốc cà phê</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* User ID */}
          <div>
            <label
              htmlFor="userId"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              User ID
            </label>
            <input
              id="userId"
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="farmer_alice"
              required
              autoComplete="username"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Error message */}
          {error && (
            <p
              role="alert"
              className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600"
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        {/* Test users hint — chỉ hiện khi dev */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6">
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
              Test users (dev only)
            </summary>
            <ul className="mt-2 space-y-0.5 text-xs text-gray-500">
              {(['farmer_alice', 'processor_bob', 'roaster_charlie', 'packager_dave', 'retailer_eve'] as const).map(u => (
                <li key={u}>
                  <button
                    type="button"
                    onClick={() => setUserId(u)}
                    className="underline hover:text-amber-700"
                  >
                    {u}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </main>
  );
}

// Page wrapper — bắt buộc wrap Suspense vì LoginForm dùng useSearchParams()
// https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-amber-50">
        <p className="text-sm text-gray-400">Đang tải...</p>
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}
