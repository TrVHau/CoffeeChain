import { NextRequest, NextResponse } from 'next/server';

const COOKIE_OPTIONS = [
  'Path=/',
  'SameSite=Lax',
  'HttpOnly',
  // Secure is added automatically by browsers on HTTPS; keep it explicit for production
  ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
].join('; ');

const EXPIRE_PAST = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';

/**
 * POST /api/auth/set-session
 * Sets HttpOnly auth_token cookie server-side after successful login.
 * Body: { token: string }
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { token?: string };
  const token = body.token?.trim();

  if (!token) {
    return NextResponse.json({ message: 'Missing token.' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });
  res.headers.append(
    'Set-Cookie',
    `auth_token=${token}; ${COOKIE_OPTIONS}`,
  );
  return res;
}

/**
 * DELETE /api/auth/set-session
 * Clears the auth_token cookie (logout).
 */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.headers.append(
    'Set-Cookie',
    `auth_token=; Path=/; ${EXPIRE_PAST}; HttpOnly; SameSite=Lax`,
  );
  return res;
}
