/**
 * Unit tests cho middleware.ts
 *
 * Next.js middleware chạy trong Edge Runtime — Next.js's `NextRequest` phụ thuộc
 * vào Web Fetch API (Request/Response) không có sẵn trong Node.js jsdom.
 * Strategy: mock hoàn toàn 'next/server', test logic redirect/next thuần túy.
 */
// @jest-environment node

import { middleware } from '@/middleware';

// ─── Full mock next/server (không dùng requireActual — Edge Runtime APIs thiếu) ─

const mockRedirect = jest.fn((url: URL) => ({ type: 'redirect', url: url.toString() }));
const mockNext     = jest.fn(() => ({ type: 'next' }));

jest.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: URL) => mockRedirect(url),
    next:     ()         => mockNext(),
  },
  // NextRequest không được dùng trong middleware — chỉ dùng type
  NextRequest: jest.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(pathname: string, cookies: Record<string, string> = {}) {
  const url = `http://localhost:3000${pathname}`;
  return {
    url,
    nextUrl: { pathname },
    cookies: {
      get: (name: string) =>
        name in cookies ? { value: cookies[name] } : undefined,
    },
  } as unknown as import('next/server').NextRequest;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('middleware', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockNext.mockClear();
  });

  describe('không có auth_token cookie', () => {
    it('redirect về /login khi truy cập /dashboard/farmer', () => {
      const req = makeRequest('/dashboard/farmer');
      middleware(req);

      expect(mockRedirect).toHaveBeenCalledTimes(1);
      const redirectUrl: string = mockRedirect.mock.calls[0][0].toString();
      expect(redirectUrl).toContain('/login');
    });

    it('redirect URL chứa redirectTo param là path gốc', () => {
      const req = makeRequest('/dashboard/roaster');
      middleware(req);

      const redirectUrl: string = mockRedirect.mock.calls[0][0].toString();
      expect(redirectUrl).toContain('redirectTo=%2Fdashboard%2Froaster');
    });

    it('không gọi next() khi thiếu token', () => {
      const req = makeRequest('/dashboard/packager');
      middleware(req);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('có auth_token cookie hợp lệ', () => {
    it('gọi next() khi truy cập /dashboard/farmer', () => {
      const req = makeRequest('/dashboard/farmer', { auth_token: 'valid-jwt-token' });
      middleware(req);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('gọi next() khi truy cập /dashboard/retailer', () => {
      const req = makeRequest('/dashboard/retailer', { auth_token: 'some-token' });
      middleware(req);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it('gọi next() cho mọi role dashboard', () => {
      const roles = ['farmer', 'processor', 'roaster', 'packager', 'retailer'];
      roles.forEach(role => {
        const req = makeRequest(`/dashboard/${role}`, { auth_token: 'tok' });
        middleware(req);
      });
      expect(mockNext).toHaveBeenCalledTimes(roles.length);
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe('config.matcher', () => {
    it('chỉ match /dashboard/:path*', () => {
      const { config } = require('@/middleware');
      expect(config.matcher).toEqual(['/dashboard/:path*']);
    });

    it('không protect /trace/**', () => {
      const { config } = require('@/middleware');
      const matcher: string[] = config.matcher;
      expect(matcher.every((m: string) => !m.includes('/trace'))).toBe(true);
    });

    it('không protect /login', () => {
      const { config } = require('@/middleware');
      const matcher: string[] = config.matcher;
      expect(matcher.every((m: string) => !m.includes('/login'))).toBe(true);
    });
  });
});
