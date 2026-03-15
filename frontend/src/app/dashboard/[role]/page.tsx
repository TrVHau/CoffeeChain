'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/useAuth';
import { QrScanner } from '@/components/QrScanner';

const ROLE_LABELS: Record<string, string> = {
  FARMER:    '🌱 Nông dân',
  PROCESSOR: '🌿 Nhà sơ chế',
  ROASTER:   '🔥 Nhà rang',
  PACKAGER:  '📦 Nhà đóng gói',
  RETAILER:  '🏪 Nhà bán lẻ',
};

export default function RoleDashboardPage({
  params,
}: {
  params: { role: string };
}) {
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-50">
        <p className="text-sm text-gray-500">Đang kiểm tra xác thực…</p>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[user.role] ?? user.role;

  return (
    <div className="min-h-screen bg-amber-50">

      {/* Top nav */}
      <header className="bg-white border-b border-amber-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-amber-800">☕ CoffeeChain</span>
          <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-700">
            {roleLabel}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user.userId}</span>
          <button
            onClick={() => {
              logout();
              router.replace('/login');
            }}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-amber-800">Dashboard — {roleLabel}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Xin chào <span className="font-semibold text-amber-700">{user.userId}</span>!
            Đây là giao diện demo cho vai trò {roleLabel}.
          </p>
        </div>

        {/* Quick-access links */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <a
            href="/demo"
            className="rounded-xl bg-white border border-amber-200 p-4 hover:bg-amber-50 transition shadow-sm"
          >
            <p className="font-medium text-amber-800">📋 TraceTimeline</p>
            <p className="mt-0.5 text-xs text-gray-500">Xem giao diện truy xuất nguồn gốc</p>
          </a>
          <a
            href="/trace/DEMO-001"
            className="rounded-xl bg-white border border-amber-200 p-4 hover:bg-amber-50 transition shadow-sm"
          >
            <p className="font-medium text-amber-800">🔍 Trace DEMO-001</p>
            <p className="mt-0.5 text-xs text-gray-500">Trang truy xuất với dữ liệu mẫu</p>
          </a>
        </div>

        {/* QR Scanner */}
        <div className="rounded-2xl bg-white p-6 shadow">
          <h2 className="mb-3 text-lg font-semibold text-amber-800">📷 Quét Mã QR Sản Phẩm</h2>
          <p className="mb-4 text-sm text-gray-500">
            Quét mã QR trên bao bì để xem hành trình sản xuất của lô hàng.
          </p>
          <QrScanner />
        </div>
      </main>
    </div>
  );
}
