'use client';

/**
 * TEMPLATE: Dashboard Page (Client Component)
 *
 * Copy file này khi tạo dashboard page mới cho một role.
 *
 * Checklist:
 * [ ] 'use client' nếu cần useState/useEffect
 * [ ] Named function export (không default export nếu có metadata)
 * [ ] Dùng useAuth() để lấy user + token
 * [ ] Dùng apiClient từ @/lib/api/client — KHÔNG fetch trực tiếp
 * [ ] Loading state + Error state
 * [ ] Tên component = tên file (PascalCase)
 * [ ] Type đầy đủ — KHÔNG dùng any
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// Internal — dùng alias @/ (KHÔNG dùng relative ../../)
import { BatchTable } from '@/components/tables/BatchTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/lib/auth/useAuth';
import { apiClient } from '@/lib/api/client';

// Generated types từ openapi.yaml — chạy: npm run generate-api
import type { BatchResponse } from '@/lib/api/generated';

// ── Component ─────────────────────────────────────────────────────────────────

export default function FarmerDashboardPage() {
  const router   = useRouter();
  const { user, token } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────────
  const [batches, setBatches]     = useState<BatchResponse[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // ── Auth guard ─────────────────────────────────────────────────────────────
  // Middleware xử lý redirect nếu chưa login, nhưng guard thêm để an toàn
  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'FARMER') {
      router.replace('/dashboard');  // redirect về dashboard mặc định
    }
  }, [user, router]);

  // ── Data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();   // cleanup khi unmount

    async function loadBatches() {
      try {
        setLoading(true);
        setError(null);

        // ✅ ĐÚNG: dùng apiClient — KHÔNG gọi fetch trực tiếp
        const data = await apiClient.harvest.list({ token, signal: controller.signal });
        setBatches(data);

      } catch (err) {
        if ((err as Error).name === 'AbortError') return;  // ignore unmount cancel
        const message = err instanceof Error ? err.message : 'Đã xảy ra lỗi';
        setError(message);
        console.error('loadBatches error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadBatches();

    return () => controller.abort();   // cleanup — tránh memory leak
  }, [token]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleStatusUpdate(batchId: string, newStatus: string) {
    if (!token) return;
    try {
      await apiClient.harvest.updateStatus({ batchId, status: newStatus, token });
      // Refresh list sau khi update
      setBatches(prev =>
        prev.map(b => b.batchId === batchId ? { ...b, status: newStatus } : b)
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cập nhật thất bại';
      setError(message);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner />;

  if (error) return (
    <div className="error-state">
      <p>❌ {error}</p>
      <button onClick={() => setError(null)}>Thử lại</button>
    </div>
  );

  return (
    <main className="dashboard-page">
      <div className="page-header">
        <h1>Farmer Dashboard</h1>
        <button onClick={() => router.push('/dashboard/farmer/new')}>
          + Tạo HarvestBatch mới
        </button>
      </div>

      <BatchTable
        batches={batches}
        onStatusUpdate={handleStatusUpdate}
      />
    </main>
  );
}
