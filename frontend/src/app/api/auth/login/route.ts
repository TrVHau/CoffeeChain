import { NextRequest, NextResponse } from 'next/server';
import { authenticateDevUser } from '@/lib/mock/authMockData';

/**
 * Mock login endpoint — DEV ONLY.
 * Accepts these test users with password "pw123".
 * This handler is only reachable when NEXT_PUBLIC_API_BASE_URL is empty,
 * which means the Next.js dev server is acting as the API server.
 */

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { userId?: string; password?: string };
  const { userId, password } = body;
  const result = authenticateDevUser(userId ?? '', password ?? '');
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 401 });
  }

  return NextResponse.json({
    token: result.token,
    role: result.role,
    userId: result.userId,
    org: result.org,
  });
}
