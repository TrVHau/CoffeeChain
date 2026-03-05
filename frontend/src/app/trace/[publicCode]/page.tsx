// TODO Week 3: Implement full trace page
// Gọi GET /api/trace/{publicCode} → render <TraceTimeline />

export default function TracePage({
  params,
}: {
  params: { publicCode: string };
}) {
  // TODO Week 3:
  // - fetch(`/api/trace/${params.publicCode}`) qua apiClient
  // - Handle loading (skeleton)
  // - Handle 404 (publicCode không tồn tại)
  // - Render <TraceTimeline chain farmActivities ledgerRefs />
  return (
    <main className="min-h-screen bg-amber-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-xl font-bold text-amber-800">
          ☕ Truy Xuất Nguồn Gốc
        </h1>
        <p className="text-sm text-gray-500">
          Mã: <span className="font-mono font-semibold">{params.publicCode}</span>
        </p>
        <p className="mt-6 text-sm text-gray-400">TraceTimeline — Tuần 3</p>
      </div>
    </main>
  );
}
