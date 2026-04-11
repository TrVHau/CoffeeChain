import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/login/page';
import { AuthProvider } from '@/lib/auth/AuthContext';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPush    = jest.fn();
const mockReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({ get: (_key: string) => null }),
}));

// Mock fetch
global.fetch = jest.fn();

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem:    (k: string)         => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string)         => { delete store[k]; },
    clear:      ()                  => { store = {}; },
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
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'jwt-test', role: 'FARMER' }),
    });
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

  it('submit thành công → gọi fetch với userId + password', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/User ID/i), 'farmer_alice');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'pw123');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/api/auth/login');
    expect(JSON.parse(options.body)).toMatchObject({ userId: 'farmer_alice', password: 'pw123' });
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
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'jwt-pack', role: 'PACKAGER' }),
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/User ID/i), 'packager_dave');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'pw123');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('API trả 401 → hiển thị error message', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Sai mật khẩu' }),
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/User ID/i), 'farmer_alice');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Sai mật khẩu'),
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('API trả lỗi không có message → fallback message', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/User ID/i), 'farmer_alice');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'pw123');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument(),
    );
  });

  it('fetch throw (network error) → hiển thị error kết nối', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/User ID/i), 'farmer_alice');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'pw123');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Không thể kết nối/i);
  });

  // ── Loading state ────────────────────────────────────────────────────────────

  it('button hiển thị "Đang đăng nhập..." khi đang fetch', async () => {
    let resolveFetch!: (val: unknown) => void;
    (global.fetch as jest.Mock).mockReturnValueOnce(
      new Promise(res => { resolveFetch = res; }),
    );

    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/User ID/i), 'farmer_alice');
    await user.type(screen.getByLabelText(/Mật khẩu/i), 'pw123');
    await user.click(screen.getByRole('button', { name: /Đăng nhập/i }));

    expect(await screen.findByRole('button', { name: /Đang đăng nhập/i })).toBeDisabled();

    // Resolve để dọn dẹp
    resolveFetch({ ok: true, json: async () => ({ token: 't', role: 'FARMER' }) });
  });

  // ── Validation ───────────────────────────────────────────────────────────────

  it('không submit khi userId rỗng (required HTML)', async () => {
    renderLogin();
    const btn = await screen.findByRole('button', { name: /Đăng nhập/i });
    fireEvent.click(btn);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
