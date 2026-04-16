import { NextRequest, NextResponse } from 'next/server';
import { getMockTraceResponse } from '@/lib/mock/traceMockData';

/**
 * Mock trace endpoint — DEV ONLY.
 * GET /api/trace/{publicCode}
 * Returns realistic mock TraceResponse so the trace page renders without backend.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: { publicCode: string } },
) {
  const { publicCode } = params;

  // Simulate 404 for unknown-looking codes
  if (publicCode === 'NOT-FOUND-999') {
    return NextResponse.json({ message: 'Batch not found.' }, { status: 404 });
  }
  return NextResponse.json(getMockTraceResponse(publicCode));
}
