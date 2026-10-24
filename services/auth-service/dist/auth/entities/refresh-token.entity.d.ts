import { User } from '../../users/entities/user.entity';
export declare class RefreshToken {
    id: string;
    tokenHash: string;
    userId: string;
    user: User;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
}
