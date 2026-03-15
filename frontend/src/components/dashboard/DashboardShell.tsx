'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import type { UserRole } from '@/lib/auth/AuthContext';

const ROLE_LINKS: Array<{ role: UserRole; href: string; label: string }> = [
  { role: 'FARMER', href: '/dashboard/farmer', label: 'Farmer' },
  { role: 'PROCESSOR', href: '/dashboard/processor', label: 'Processor' },
  { role: 'ROASTER', href: '/dashboard/roaster', label: 'Roaster' },
  { role: 'PACKAGER', href: '/dashboard/packager', label: 'Packager' },
  { role: 'RETAILER', href: '/dashboard/retailer', label: 'Retailer' },
];

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function DashboardShell({ title, subtitle, children }: DashboardShellProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 via-red-50 to-white text-slate-900">
      <header className="border-b border-rose-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-rose-700">PTIT CoffeeChain</p>
              <h1 className="text-xl font-bold text-rose-900 sm:text-2xl">{title}</h1>
              {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-right text-xs">
                <p className="font-semibold text-rose-800">{user?.userId}</p>
                <p className="text-rose-700">{user?.role}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-800"
              >
                Dang xuat
              </button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            {ROLE_LINKS.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.role}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? 'bg-rose-700 text-white'
                      : 'border border-rose-200 bg-white text-rose-800 hover:bg-rose-50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
