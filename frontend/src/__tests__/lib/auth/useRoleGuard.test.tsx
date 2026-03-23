import React from 'react';
import { render, screen } from '@testing-library/react';
import { useRoleGuard } from '@/lib/auth/useRoleGuard';
import { ROLE_DASHBOARD } from '@/lib/auth/AuthContext';

const mockReplace = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@/lib/auth/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

function TestComponent({ role }: { role: 'FARMER' | 'PROCESSOR' | 'ROASTER' | 'PACKAGER' | 'RETAILER' }) {
  const { ready } = useRoleGuard(role);
  return <div>{ready ? 'ready' : 'not-ready'}</div>;
}

describe('useRoleGuard', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockUseAuth.mockReset();
  });

  it('does not redirect when auth state is not hydrated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isHydrated: false,
    });

    render(<TestComponent role="FARMER" />);
    expect(screen.getByText('not-ready')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects to login when unauthenticated after hydration', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isHydrated: true,
    });

    render(<TestComponent role="FARMER" />);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('redirects to role dashboard when current role does not match', () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 'processor_bob', role: 'PROCESSOR', token: 'tok' },
      isAuthenticated: true,
      isHydrated: true,
    });

    render(<TestComponent role="FARMER" />);
    expect(mockReplace).toHaveBeenCalledWith(ROLE_DASHBOARD.PROCESSOR);
  });

  it('is ready when role is correct', () => {
    mockUseAuth.mockReturnValue({
      user: { userId: 'farmer_alice', role: 'FARMER', token: 'tok' },
      isAuthenticated: true,
      isHydrated: true,
    });

    render(<TestComponent role="FARMER" />);
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
