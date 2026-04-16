'use client';

import { useState } from 'react';
import { TraceTimeline } from '@/components/TraceTimeline';
import { QrScanner } from '@/components/QrScanner';
import { MOCK_TRACE_DEMO_RESPONSE } from '@/lib/mock/traceMockData';

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'timeline' | 'qr';

// ─── Demo page ────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('timeline');

  return (
    <main className="min-h-screen bg-amber-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="mb-6 rounded-2xl bg-amber-100 px-5 py-4 border border-amber-300">
          <h1 className="text-2xl font-bold text-amber-800">☕ CoffeeChain — UI Demo</h1>
          <p className="mt-1 text-sm text-amber-700">
            Trang xem trước giao diện (không cần backend).
            Để đăng nhập test:{' '}
            <a href="/login" className="underline font-medium hover:text-amber-900">
              /login
            </a>{' '}
            với user <code className="font-mono text-xs bg-amber-200 px-1 rounded">farmer_alice</code> / mật khẩu{' '}
            <code className="font-mono text-xs bg-amber-200 px-1 rounded">pw123</code>
          </p>
          <p className="mt-1 text-xs text-amber-600">
            Trace thật với mock data:{' '}
            <a href="/trace/DEMO-001" className="underline hover:text-amber-900 font-mono">
              /trace/DEMO-001
            </a>
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === 'timeline'
              ? 'bg-amber-700 text-white shadow'
              : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
              }`}
          >
            📋 TraceTimeline
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeTab === 'qr'
              ? 'bg-amber-700 text-white shadow'
              : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
              }`}
          >
            📷 QR Scanner
          </button>
        </div>

        {/* TraceTimeline tab */}
        {activeTab === 'timeline' && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-amber-800">
              Truy Xuất Nguồn Gốc — DEMO-001
            </h2>
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-teal-100 text-teal-700 px-3 py-0.5 text-xs font-medium">
                Trong kho
              </span>
              <span className="text-xs text-gray-400">4 bước sản xuất · 3 sự kiện canh tác</span>
            </div>
            <TraceTimeline
              batches={[...MOCK_TRACE_DEMO_RESPONSE.parentChain, MOCK_TRACE_DEMO_RESPONSE.batch]}
              farmActivities={MOCK_TRACE_DEMO_RESPONSE.farmActivities}
              ledgerRefs={MOCK_TRACE_DEMO_RESPONSE.ledgerRefs}
            />
          </section>
        )}

        {/* QrScanner tab */}
        {activeTab === 'qr' && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-amber-800">Quét Mã QR</h2>
            <p className="mb-4 text-sm text-gray-500">
              Quét mã QR chứa URL sản phẩm hoặc mã công khai (publicCode).
              Sau khi quét sẽ chuyển đến trang truy xuất.
            </p>
            <QrScanner />
          </section>
        )}
      </div>
    </main>
  );
}
