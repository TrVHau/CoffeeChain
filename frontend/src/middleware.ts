import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Bảo vệ tất cả routes /dashboard/**
 * Đọc cookie `auth_token` (được set bởi AuthContext.login).
 * Nếu không có token → redirect /login?redirectTo=<path gốc>
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    const redirectTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set('redirectTo', redirectTo);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Chỉ chạy middleware trên /dashboard/**
  // /login, /trace/**, /_next/** không bị chặn
  matcher: ['/dashboard/:path*'],
};
