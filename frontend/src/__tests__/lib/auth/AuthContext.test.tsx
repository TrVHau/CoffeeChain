import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuthContext, ROLE_DASHBOARD } from '@/lib/auth/AuthContext';
import type { UserRole } from '@/lib/auth/AuthContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Component lấy context ra để test */
function AuthConsumer() {
  const { user, isAuthenticated } = useAuthContext();
  if (!isAuthenticated) return <div data-testid="unauthenticated">not authenticated</div>;
  return (
    <div>
      <span data-testid="userId">{user!.userId}</span>
      <span data-testid="role">{user!.role}</span>
      <span data-testid="token">{user!.token}</span>
    </div>
  );
}

function LoginButton({ userId, token, role }: { userId: string; token: string; role: UserRole }) {
  const { login } = useAuthContext();
  return (
    <button onClick={() => login(userId, token, role)}>login</button>
  );
}

function LogoutButton() {
  const { logout } = useAuthContext();
  return <button onClick={logout}>logout</button>;
}

// Mock localStorage + document.cookie
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AuthContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    // Reset cookies
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('khởi đầu ở trạng thái unauthenticated', () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );
    expect(screen.getByTestId('unauthenticated')).toBeInTheDocument();
  });

  it('login() cập nhật user state và isAuthenticated', async () => {
    render(
      <AuthProvider>
        <LoginButton userId="farmer_alice" token="tok123" role="FARMER" />
        <AuthConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('unauthenticated')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: 'login' }).click();
    });

    expect(screen.queryByTestId('unauthenticated')).not.toBeInTheDocument();
    expect(screen.getByTestId('userId').textContent).toBe('farmer_alice');
    expect(screen.getByTestId('role').textContent).toBe('FARMER');
    expect(screen.getByTestId('token').textContent).toBe('tok123');
  });

  it('login() lưu user vào localStorage', async () => {
    render(
      <AuthProvider>
        <LoginButton userId="packager_dave" token="tokXYZ" role="PACKAGER" />
        <AuthConsumer />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'login' }).click();
    });

    const stored = JSON.parse(localStorageMock.getItem('auth_user') ?? '{}');
    expect(stored.userId).toBe('packager_dave');
    expect(stored.role).toBe('PACKAGER');
    expect(stored.token).toBe('tokXYZ');
  });

  it('login() set cookie auth_token', async () => {
    render(
      <AuthProvider>
        <LoginButton userId="retailer_eve" token="cookie-tok" role="RETAILER" />
        <AuthConsumer />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'login' }).click();
    });

    expect(document.cookie).toContain('auth_token=cookie-tok');
  });

  it('logout() xóa user và isAuthenticated về false', async () => {
    render(
      <AuthProvider>
        <LoginButton userId="farmer_alice" token="tok" role="FARMER" />
        <LogoutButton />
        <AuthConsumer />
      </AuthProvider>,
    );

    // Login trước
    await act(async () => {
      screen.getByRole('button', { name: 'login' }).click();
    });
    expect(screen.queryByTestId('unauthenticated')).not.toBeInTheDocument();

    // Logout
    await act(async () => {
      screen.getByRole('button', { name: 'logout' }).click();
    });
    expect(screen.getByTestId('unauthenticated')).toBeInTheDocument();
  });

  it('logout() xóa localStorage', async () => {
    render(
      <AuthProvider>
        <LoginButton userId="farmer_alice" token="tok" role="FARMER" />
        <LogoutButton />
        <AuthConsumer />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'login' }).click();
    });
    expect(localStorageMock.getItem('auth_user')).not.toBeNull();

    await act(async () => {
      screen.getByRole('button', { name: 'logout' }).click();
    });
    expect(localStorageMock.getItem('auth_user')).toBeNull();
  });

  it('rehydrate từ localStorage khi mount', async () => {
    // Giả lập đã có session
    localStorageMock.setItem('auth_user', JSON.stringify({
      userId: 'roaster_charlie',
      role: 'ROASTER',
      token: 'persisted-tok',
    }));

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    // useEffect chạy async
    await act(async () => {});

    expect(screen.getByTestId('userId').textContent).toBe('roaster_charlie');
    expect(screen.getByTestId('role').textContent).toBe('ROASTER');
  });

  it('localStorage có JSON lỗi → bỏ qua, không crash', async () => {
    localStorageMock.setItem('auth_user', 'không phải json {{{');

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    await act(async () => {});

    expect(screen.getByTestId('unauthenticated')).toBeInTheDocument();
  });

  it('useAuthContext() throw nếu dùng ngoài AuthProvider', () => {
    // Suppress expected error output
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<AuthConsumer />)).toThrow(
      'useAuthContext must be used within AuthProvider',
    );
    spy.mockRestore();
  });
});

// ─── ROLE_DASHBOARD mapping ──────────────────────────────────────────────────

describe('ROLE_DASHBOARD', () => {
  const cases: [UserRole, string][] = [
    ['FARMER',    '/dashboard/farmer'],
    ['PROCESSOR', '/dashboard/processor'],
    ['ROASTER',   '/dashboard/roaster'],
    ['PACKAGER',  '/dashboard/packager'],
    ['RETAILER',  '/dashboard/retailer'],
  ];

  it.each(cases)('role %s → path %s', (role, path) => {
    expect(ROLE_DASHBOARD[role]).toBe(path);
  });
});
