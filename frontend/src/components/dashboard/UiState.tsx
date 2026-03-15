export function LoadingState({ text = 'Đang tải dữ liệu...' }: { text?: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-800 shadow-sm">
      {text}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
      {message}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
      {text}
    </div>
  );
}
