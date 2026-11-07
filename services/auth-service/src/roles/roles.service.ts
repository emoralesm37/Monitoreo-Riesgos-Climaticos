import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RoleResponseDto } from './dto/role-response.dto';
import { Role } from './entities/role.entity';
import { authPermissions } from './auth-permissions';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async findAll(): Promise<RoleResponseDto[]> {
    const roles = await this.roleRepository.find({
      order: {
        name: 'ASC',
      },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: authPermissions.filter(p => (p.roles as readonly string[]).includes(role.name))
        .map(({ method, path, label }) => ({ method, path, label })),
    }));
  }
}
