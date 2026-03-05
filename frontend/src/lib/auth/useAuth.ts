import { useAuthContext } from './AuthContext';

/**
 * Hook truy cập auth state — dùng trong mọi component cần biết user hiện tại.
 * Unit-4 (FE-Member-1) import hook này để bảo vệ dashboard pages.
 *
 * @example
 * const { user, isAuthenticated, logout } = useAuth();
 */
export function useAuth() {
  return useAuthContext();
}
