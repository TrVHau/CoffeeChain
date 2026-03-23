import { NextRequest, NextResponse } from 'next/server';

/**
 * Mock login endpoint — DEV ONLY.
 * Accepts these test users with password "demo".
 * This handler is only reachable when NEXT_PUBLIC_API_BASE_URL is empty,
 * which means the Next.js dev server is acting as the API server.
 */

const DEV_USERS: Record<string, string> = {
  farmer_alice:    'FARMER',
  processor_bob:   'PROCESSOR',
  roaster_charlie: 'ROASTER',
  packager_dave:   'PACKAGER',
  retailer_eve:    'RETAILER',
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { userId?: string; password?: string };
  const { userId, password } = body;

  if (!userId || !password) {
    return NextResponse.json(
      { message: 'userId và password là bắt buộc.' },
      { status: 400 },
    );
  }

  const role = DEV_USERS[userId];
  if (!role) {
    return NextResponse.json(
      {
        message:
          'User không tồn tại. Dùng: farmer_alice, processor_bob, roaster_charlie, packager_dave, retailer_eve',
      },
      { status: 401 },
    );
  }

  if (password !== 'demo') {
    return NextResponse.json(
      { message: 'Mật khẩu không đúng. Dùng "demo" cho tất cả tài khoản dev.' },
      { status: 401 },
    );
  }

  // Issue a simple non-cryptographic dev token (not a real JWT)
  const token = `dev.${userId}.${Date.now()}`;

  return NextResponse.json({ token, role, userId, org: `${role}Org` });
}
