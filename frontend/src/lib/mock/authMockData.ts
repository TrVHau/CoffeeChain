import type { UserRole } from '@/lib/auth/AuthContext';

export const DEV_LOGIN_PASSWORD = 'pw123';

export const DEV_USERS: Record<string, UserRole> = {
    farmer_alice: 'FARMER',
    processor_bob: 'PROCESSOR',
    roaster_charlie: 'ROASTER',
    packager_dave: 'PACKAGER',
    retailer_eve: 'RETAILER',
};

export interface DevAuthSuccess {
    ok: true;
    userId: string;
    role: UserRole;
    token: string;
    org: string;
}

export interface DevAuthFailure {
    ok: false;
    message: string;
}

export type DevAuthResult = DevAuthSuccess | DevAuthFailure;

export function authenticateDevUser(userId: string, password: string): DevAuthResult {
    if (!userId || !password) {
        return {
            ok: false,
            message: 'userId và password là bắt buộc.',
        };
    }

    const role = DEV_USERS[userId];
    if (!role) {
        return {
            ok: false,
            message: 'User không tồn tại. Dùng: farmer_alice, processor_bob, roaster_charlie, packager_dave, retailer_eve',
        };
    }

    if (password !== DEV_LOGIN_PASSWORD) {
        return {
            ok: false,
            message: 'Mật khẩu không đúng. Dùng "pw123" cho tất cả tài khoản dev.',
        };
    }

    return {
        ok: true,
        userId,
        role,
        token: `dev.${userId}.${role.toLowerCase()}`,
        org: `${role}Org`,
    };
}