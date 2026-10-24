import { User } from '../../users/entities/user.entity';
export declare class Role {
    id: string;
    name: string;
    description: string | null;
    users: User[];
    createdAt: Date;
    updatedAt: Date;
}
