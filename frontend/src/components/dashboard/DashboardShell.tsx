'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import type { UserRole } from '@/lib/auth/AuthContext';

const ROLE_LINKS: Array<{ role: UserRole; href: string; label: string }> = [
  { role: 'FARMER', href: '/dashboard/farmer', label: 'Nông dân' },
  { role: 'PROCESSOR', href: '/dashboard/processor', label: 'Sơ chế' },
  { role: 'ROASTER', href: '/dashboard/roaster', label: 'Rang xay' },
  { role: 'PACKAGER', href: '/dashboard/packager', label: 'Đóng gói' },
  { role: 'RETAILER', href: '/dashboard/retailer', label: 'Bán lẻ' },
];

interface DashboardShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function CoffeeIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M4 11h11a4 4 0 0 1 0 8H8a4 4 0 0 1-4-4z" />
      <path d="M15 12h2a2 2 0 1 1 0 4h-1" />
      <path d="M8 8c0-1.2 1-1.6 1-2.8" />
      <path d="M12 8c0-1.2 1-1.6 1-2.8" />
    </svg>
  );
}

function UserIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  );
}

function LogoutIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M10 6H6v12h4" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </svg>
  );
}

function RoleIcon({ role, className = 'h-4 w-4' }: { role: UserRole; className?: string }) {
  if (role === 'FARMER') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
        <path d="M12 4v16" />
        <path d="M12 12c4 0 7-3 7-7-4 0-7 3-7 7Z" />
        <path d="M12 14c-4 0-7-3-7-7 4 0 7 3 7 7Z" />
      </svg>
    );
  }
  if (role === 'PROCESSOR') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </svg>
    );
  }
  if (role === 'ROASTER') {
    return <CoffeeIcon className={className} />;
  }
  if (role === 'PACKAGER') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
        <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M4 10h16v9H4z" />
      <path d="M7 10V7a5 5 0 0 1 10 0v3" />
      <path d="M12 14v2" />
    </svg>
  );
}

export function DashboardShell({ title, subtitle, children }: DashboardShellProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const roleLinks = user ? ROLE_LINKS.filter((item) => item.role === user.role) : [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-stone-50 text-slate-900">
      <header className="border-b border-amber-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-amber-800">
                <CoffeeIcon className="h-3.5 w-3.5" />
                PTIT CoffeeChain
              </p>
              <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">{title}</h1>
              {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
            </div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-right text-xs">
                <p className="flex items-center justify-end gap-1 font-semibold text-amber-900">
                  <UserIcon className="h-3.5 w-3.5" />
                  {user?.userId}
                </p>
                <p className="text-amber-800">{user?.role}</p>
                <p className="font-medium text-amber-900">Tổ chức: {user?.org ?? 'UNKNOWN'}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-amber-900 sm:w-auto"
              >
                <LogoutIcon className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            {roleLinks.map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.role}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${active
                    ? 'bg-amber-800 text-white'
                    : 'border border-amber-200 bg-white text-amber-900 hover:bg-amber-50'
                    }`}
                >
                  <RoleIcon role={item.role} className="h-4 w-4" />
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
