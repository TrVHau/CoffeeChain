import axios, { type AxiosError } from 'axios';

const STORAGE_KEY = 'auth_user';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const auth = JSON.parse(stored) as { token: string };
        if (auth.token) {
          const token = auth.token.trim().replace(/^Bearer\s+/i, '');
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // Ignore invalid local storage value.
      }
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      localStorage.removeItem(STORAGE_KEY);
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';

      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        window.location.replace(`/login?redirectTo=${encodeURIComponent(currentPath)}`);
      }
    }
    return Promise.reject(error);
  },
);
