import { NextResponse } from 'next/server';

type FeedItemType = 'EVIDENCE' | 'TRANSACTION' | 'BLOCK';
type TraceStage = 'HARVEST' | 'PROCESSED' | 'ROAST' | 'PACKAGED' | 'RETAIL';

interface PublicFeedItem {
  id: string;
  publicCode: string;
  type: FeedItemType;
  traceStage: TraceStage;
  title: string;
  subtitle: string;
  txId: string;
  blockNumber: number;
  updatedAt: string;
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function stageByIndex(index: number): TraceStage {
  const stages: TraceStage[] = ['HARVEST', 'PROCESSED', 'ROAST', 'PACKAGED', 'RETAIL'];
  return stages[index % stages.length];
}

function stageTitle(stage: TraceStage): string {
  const map: Record<TraceStage, string> = {
    HARVEST: 'THU HOẠCH',
    PROCESSED: 'SƠ CHẾ',
    ROAST: 'RANG',
    PACKAGED: 'ĐÓNG GÓI',
    RETAIL: 'BÁN LẺ',
  };
  return map[stage];
}

function buildDemoItems(): PublicFeedItem[] {
  const totalBatches = 16;
  const baseBlock = 24850240;

  const items = Array.from({ length: totalBatches }).flatMap((_, index) => {
    const n = index + 1;
    const serial = String(n).padStart(3, '0');
    const code = `COFF-2026-${serial}`;
    const stage = stageByIndex(index);
    const blockOffset = index * 3;

    const evidenceItem: PublicFeedItem = {
      id: `ev-${serial}`,
      publicCode: code,
      type: 'EVIDENCE',
      traceStage: stage,
      title: `Upload minh chứng ${stageTitle(stage)} cho lô ${code}`,
      subtitle: `Org phụ trách ${stageTitle(stage)} cập nhật tài liệu và hash minh chứng.`,
      txId: `0x7a31f6ab23cc64ddf871f2a91b0e4f1022ac${serial}`,
      blockNumber: baseBlock + blockOffset + 2,
      updatedAt: minutesAgo(3 + index * 6),
    };

    const txItem: PublicFeedItem = {
      id: `tx-${serial}`,
      publicCode: code,
      type: 'TRANSACTION',
      traceStage: stage,
      title: `Giao dịch cập nhật trạng thái ${stageTitle(stage)} cho ${code}`,
      subtitle: `Hệ thống ghi nhận nghiệp vụ của lô theo luồng truy xuất.`,
      txId: `0x2f8d5a1e4b7c9934aa10f06bce4c1f9a7712${serial}`,
      blockNumber: baseBlock + blockOffset + 1,
      updatedAt: minutesAgo(5 + index * 6),
    };

    const blockItem: PublicFeedItem = {
      id: `bl-${serial}`,
      publicCode: code,
      type: 'BLOCK',
      traceStage: stage,
      title: `Block xác nhận sự kiện ${stageTitle(stage)} của ${code}`,
      subtitle: 'Dữ liệu đã được ghi lên Fabric ledger và không thể chỉnh sửa.',
      txId: `0x92d0e4ac77f1a34be5f1bb223e01afd6a814${serial}`,
      blockNumber: baseBlock + blockOffset,
      updatedAt: minutesAgo(7 + index * 6),
    };

    return [evidenceItem, txItem, blockItem];
  });

  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function GET() {
  const items = buildDemoItems();

  const stats = {
    totalItems: items.length,
    totalTransactions: items.filter((item) => item.type === 'TRANSACTION').length,
    totalEvidenceUploads: items.filter((item) => item.type === 'EVIDENCE').length,
    latestBlockNumber: Math.max(...items.map((item) => item.blockNumber)),
  };

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    stats,
    items,
  });
}
