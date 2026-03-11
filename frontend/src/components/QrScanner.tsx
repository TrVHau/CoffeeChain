'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserMultiFormatReader } from '@zxing/browser';

type ScanState = 'idle' | 'scanning' | 'success' | 'error';

/**
 * Trích publicCode từ kết quả QR:
 * - URL đầy đủ: https://example.com/trace/PKG-001  → "PKG-001"
 * - Chỉ publicCode: PKG-001                        → "PKG-001"
 */
function extractPublicCode(text: string): string {
  const match = text.match(/\/trace\/([^/?#\s]+)/);
  return match ? match[1] : text.trim();
}

export function QrScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const router   = useRouter();

  const [state,      setState]      = useState<ScanState>('idle');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    if (!videoRef.current) return;
    let readerRef: BrowserMultiFormatReader | null = null;

    setState('scanning');

    const reader = new BrowserMultiFormatReader();
    readerRef = reader;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result) {
          setState('success');
          const code = extractPublicCode(result.getText());
          router.push(`/trace/${encodeURIComponent(code)}`);
        }
        // NotFoundException = không thấy QR trong frame — bình thường, bỏ qua
        if (err && err.name !== 'NotFoundException') {
          setState('error');
          setErrorMsg(err.message);
        }
      })
      .catch((err: unknown) => {
        setState('error');
        setErrorMsg(
          err instanceof Error ? err.message : 'Không thể truy cập camera.',
        );
      });

    return () => {
      BrowserMultiFormatReader.releaseAllStreams();
    };
  }, [router]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = manualCode.trim();
    if (code) router.push(`/trace/${encodeURIComponent(code)}`);
  }

  return (
    <div className="space-y-4">
      {/* Camera viewfinder */}
      <div className="relative overflow-hidden rounded-xl border-2 border-amber-300 bg-black">
        <video
          ref={videoRef}
          className="w-full"
          playsInline
          muted
          aria-label="Camera để quét mã QR"
        />
        {/* Scanning overlay */}
        {state === 'scanning' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-lg border-4 border-amber-400 opacity-70" />
          </div>
        )}
        {state === 'success' && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-900/60">
            <p className="text-lg font-bold text-white">✅ Đã nhận dạng — đang chuyển hướng…</p>
          </div>
        )}
      </div>

      {/* Camera error */}
      {state === 'error' && (
        <p className="text-sm text-orange-600">
          ⚠️ {errorMsg || 'Không thể khởi động camera.'}{' '}
          <button
            onClick={() => window.location.reload()}
            className="underline hover:text-orange-800"
          >
            Thử lại
          </button>
        </p>
      )}

      {/* Manual fallback */}
      <div>
        <p className="mb-1 text-xs text-gray-500">Hoặc nhập mã sản phẩm thủ công:</p>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="VD: PKG-20240403-001"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-40"
          >
            Tra cứu
          </button>
        </form>
      </div>
    </div>
  );
}
