export function LoadingState({ text = 'Đang tải dữ liệu...' }: { text?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-white p-6 text-sm text-amber-800 shadow-sm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 animate-spin" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 9 9" />
      </svg>
      {text}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 h-4 w-4" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" />
      </svg>
      {message}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
        <path d="M4 7h16v10H4z" />
        <path d="M9 11h6M9 14h4" />
      </svg>
      {text}
    </div>
  );
}
