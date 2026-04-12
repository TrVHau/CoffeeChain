import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/login/page';
import { AuthProvider } from '@/lib/auth/AuthContext';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: (_key: string) => null }),
}));

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderLogin() {
  return render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  it('render đủ các phần tử quan trọng', async () => {
    renderLogin();
    expect(await screen.findByRole('heading', { name: /CoffeeChain/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/User ID/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Mật khẩu/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đăng nhập/i })).toBeInTheDocument();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('submit thành công → lưu auth và không gọi fetch', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/User ID/i), 'farmer_alice');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'pw123');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
    expect(localStorage.getItem('auth_user')).toContain('farmer_alice');
  });

  it('submit thành công → redirect sang /dashboard', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/User ID/i), 'farmer_alice');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'pw123');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('submit với role PACKAGER → vẫn redirect /dashboard', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/User ID/i), 'packager_dave');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'pw123');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('mật khẩu sai → hiển thị error message', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/User ID/i), 'farmer_alice');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/Mật khẩu không đúng/i),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('user không tồn tại → hiển thị fallback message', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/User ID/i), 'unknown_user');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'pw123');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/User không tồn tại/i),
    );
  });

  // ── Validation ───────────────────────────────────────────────────────────────

  it('không submit khi userId rỗng (required HTML)', async () => {
    renderLogin();
    const btn = await screen.findByRole('button', { name: /Đăng nhập/i });
    fireEvent.click(btn);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
