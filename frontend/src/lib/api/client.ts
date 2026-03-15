import axios, { type AxiosError } from 'axios';
import { OpenAPI } from './generated';

// Khớp với STORAGE_KEY trong AuthContext.tsx
const STORAGE_KEY = 'auth_user';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — đính kèm JWT từ localStorage
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const auth = JSON.parse(stored) as { token: string };
        if (auth.token) {
          config.headers.Authorization = `Bearer ${auth.token}`;
        }
      } catch {
        // Corrupt entry — login page sẽ xử lý
      }
    }
  }
  return config;
});

// Response interceptor — xử lý 401 (hết hạn / không hợp lệ)
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      // Xoá thông tin auth
      localStorage.removeItem(STORAGE_KEY);
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

      // Redirect về /login, giữ lại đường dẫn hiện tại để redirect lại sau login
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        window.location.replace(
          `/login?redirectTo=${encodeURIComponent(currentPath)}`,
        );
      }
    }
    return Promise.reject(error);
  },
);

// ─── Generated OpenAPI client — cấu hình BASE URL và auth token resolver ──────
// Dùng '' (same-origin) khi không có env var → khớp với mock routes trong /app/api/
OpenAPI.BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
OpenAPI.TOKEN = async (): Promise<string> => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const auth = JSON.parse(stored) as { token: string };
        return auth.token ?? '';
      } catch {
        // Corrupt entry — login page sẽ xử lý
      }
    }
  }
  return '';
};
