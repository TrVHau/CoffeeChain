'use client';

import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import { type UserRole } from '@/lib/auth/AuthContext';
import { authenticateDevUser, DEV_LOGIN_PASSWORD, DEV_USERS } from '@/lib/mock/authMockData';

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
      await new Promise((resolve) => setTimeout(resolve, 0));
      const result = authenticateDevUser(userId.trim(), password);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      login(result.userId, result.token, result.role as UserRole);

      const redirectTo = searchParams.get('redirectTo');
      router.push(redirectTo ?? '/dashboard');
    } catch {
      setError('Không thể xử lý đăng nhập. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-amber-50 via-stone-100 to-yellow-100 px-4 py-8">
      <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-amber-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-stone-500/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(120,53,15,0.08),_transparent_40%)]" />

      <div className="relative flex w-full max-w-sm flex-col items-center gap-4">
        <div className="w-full rounded-[28px] border border-amber-200 bg-white/90 p-8 shadow-[0_24px_80px_rgba(120,53,15,0.18)] backdrop-blur">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-900 text-2xl text-amber-50 shadow-lg shadow-amber-900/20">
              ☕
            </div>
            <h1 className="text-3xl font-bold text-stone-900">CoffeeChain</h1>
            <p className="mt-1 text-sm text-stone-600">Truy xuất nguồn gốc cà phê</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="userId" className="mb-1 block text-sm font-medium text-stone-700">
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
                className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-stone-900 transition placeholder:text-stone-400 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-stone-700">
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-stone-900 transition placeholder:text-stone-400 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <details className="mt-6 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
            <summary className="cursor-pointer text-xs font-medium text-stone-500 hover:text-stone-700">
              Tài khoản demo
            </summary>
            <p className="mt-2 text-xs text-stone-600">
              Mật khẩu mặc định:
              <span className="font-semibold text-amber-900">{DEV_LOGIN_PASSWORD}</span>
            </p>
            <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
              {(Object.keys(DEV_USERS) as Array<keyof typeof DEV_USERS>).map((u) => (
                <li key={u}>
                  <button
                    type="button"
                    onClick={() => setUserId(u)}
                    className="underline decoration-amber-400 underline-offset-2 hover:text-amber-900"
                  >
                    {u}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>

        <Link
          href="/"
          className="inline-flex items-center rounded-lg border border-amber-300 bg-white/70 px-3 py-1.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
        >
          Quay lại danh sách minh chứng và giao dịch
        </Link>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-amber-50">
          <p className="text-sm text-stone-500">Đang tải...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
