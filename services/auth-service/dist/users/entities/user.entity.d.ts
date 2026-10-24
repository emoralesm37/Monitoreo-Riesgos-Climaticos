import { Role } from '../../roles/entities/role.entity';
export declare class User {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    roleId: string;
    role: Role;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
