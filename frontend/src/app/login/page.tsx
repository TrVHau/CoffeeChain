'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import { type UserRole } from '@/lib/auth/AuthContext';

interface LoginResponse {
  token: string;
  role: UserRole;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, user, isHydrated } = useAuth();

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;
    if (isAuthenticated && user) {
      const redirectTo = searchParams.get('redirectTo');
      router.replace(redirectTo ?? '/dashboard');
    }
  }, [isHydrated, isAuthenticated, user, router, searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
      });

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-rose-100 via-red-50 to-white px-4 py-8">
      <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-rose-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-red-400/20 blur-3xl" />

      <div className="w-full max-w-sm rounded-3xl border border-rose-200 bg-white/90 p-8 shadow-xl backdrop-blur">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-rose-900">☕ CoffeeChain</h1>
          <p className="mt-1 text-sm text-slate-500">Truy xuất nguồn gốc cà phê</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="userId" className="mb-1 block text-sm font-medium text-slate-700">
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
              className="w-full rounded-xl border border-rose-200 px-3 py-2 text-sm transition focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-rose-200 px-3 py-2 text-sm transition focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <details className="mt-6">
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600">
            Tài khoản demo
          </summary>
          <p className="mt-2 text-xs text-slate-500">
            Mật khẩu mặc định: <span className="font-semibold text-rose-700">pw123</span>
          </p>
          <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
            {(['farmer_alice', 'processor_bob', 'roaster_charlie', 'packager_dave', 'retailer_eve'] as const).map(u => (
              <li key={u}>
                <button
                  type="button"
                  onClick={() => setUserId(u)}
                  className="underline hover:text-rose-700"
                >
                  {u}
                </button>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-rose-50">
          <p className="text-sm text-slate-500">Đang tải...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
