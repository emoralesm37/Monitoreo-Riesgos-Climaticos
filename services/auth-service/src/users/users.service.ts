import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { EntityManager, IsNull, QueryFailedError, Repository } from 'typeorm';
import { RefreshToken } from '../auth/entities/refresh-token.entity';

import { Role } from '../roles/entities/role.entity';
import { ChangeUserStatusRequestDto } from './dto/change-user-status-request.dto';
import { CreateUserRequestDto } from './dto/create-user-request.dto';
import { UpdateUserRequestDto } from './dto/update-user-request.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.userRepository.find({
      relations: {
        role: true,
      },
      order: {
        name: 'ASC',
      },
    });

    return users.map((user) => this.toResponseDto(user));
  }

  async findById(id: string): Promise<UserResponseDto> {
    const user = await this.findUserOrFail(id);

    return this.toResponseDto(user);
  }

  async create(request: CreateUserRequestDto, actorId: string): Promise<UserResponseDto> {
    const passwordHash = await bcrypt.hash(request.password, 12);
    return this.mutate(actorId, async (users, roles) => {
      const email = request.email.trim().toLowerCase();
      await this.validateEmailAvailable(email, undefined, users);
      const role = await this.findRoleOrFail(request.roleId, roles);
      return this.toResponseDto(await users.save(users.create({ name: request.name.trim(), email,
        passwordHash, roleId: role.id, role, isActive: true })));
    });
  }

  async update(id: string, request: UpdateUserRequestDto, actorId: string): Promise<UserResponseDto> {
    return this.mutate(actorId, async (users, roles, manager) => {
      const user = await this.findUserOrFail(id, users);
      const role = request.roleId === undefined ? user.role : await this.findRoleOrFail(request.roleId, roles);
      await this.keepAdministrator(user, role.name, user.isActive, users);
      if (request.name !== undefined) user.name = request.name.trim();
      if (request.email !== undefined) {
        const email = request.email.trim().toLowerCase();
        await this.validateEmailAvailable(email, user.id, users); user.email = email;
      }
      if (role.id !== user.roleId) {
        await manager.update(RefreshToken, { userId: id, revokedAt: IsNull() }, { revokedAt: new Date() });
      }
      user.roleId = role.id; user.role = role;
      return this.toResponseDto(await users.save(user));
    });
  }

  async changeStatus(id: string, request: ChangeUserStatusRequestDto, actorId: string): Promise<UserResponseDto> {
    return this.mutate(actorId, async (users, _roles, manager) => {
      const user = await this.findUserOrFail(id, users);
      await this.keepAdministrator(user, user.role.name, request.isActive, users);
      if (!request.isActive) await manager.update(RefreshToken,
        { userId: id, revokedAt: IsNull() }, { revokedAt: new Date() });
      user.isActive = request.isActive;
      return this.toResponseDto(await users.save(user));
    });
  }

  private async mutate<T>(actorId: string,
    work: (users: Repository<User>, roles: Repository<Role>, manager: EntityManager) => Promise<T>): Promise<T> {
    try {
      return await this.userRepository.manager.transaction(async manager => {
        // One transaction-scoped PostgreSQL lock serializes all user privilege mutations,
        // including across processes. Re-read the actor AFTER taking it to avoid TOCTOU.
        await manager.query('SELECT pg_advisory_xact_lock($1)', [1128743491]);
        const users = manager.getRepository(User), roles = manager.getRepository(Role);
        const actor = await users.findOne({ where: { id: actorId }, relations: { role: true } });
        if (!actor?.isActive || actor.role.name !== 'Administrador')
          throw new ForbiddenException('Se requiere un administrador activo.');
        return work(users, roles, manager);
      });
    } catch (error) {
      if (error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505')
        throw new ConflictException('Ya existe un usuario registrado con ese correo.');
      throw error;
    }
  }

  private async keepAdministrator(user: User, role: string, active: boolean, users: Repository<User>) {
    if (user.isActive && user.role.name === 'Administrador' && (!active || role !== 'Administrador')) {
      const count = await users.count({ where: { isActive: true, role: { name: 'Administrador' } } });
      if (count <= 1) throw new ConflictException({ code: 'LAST_ACTIVE_ADMIN',
        message: 'Debe conservarse al menos un administrador activo.' });
    }
  }

  private async findUserOrFail(id: string, users = this.userRepository): Promise<User> {
    const user = await users.findOne({
      where: {
        id,
      },
      relations: {
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'El usuario indicado no existe.',
      );
    }

    return user;
  }

  private async findRoleOrFail(id: string, roles = this.roleRepository): Promise<Role> {
    const role = await roles.findOne({
      where: {
        id,
      },
    });

    if (!role) {
      throw new NotFoundException(
        'El rol indicado no existe.',
      );
    }

    return role;
  }

  private async validateEmailAvailable(
    email: string,
    ignoredUserId?: string,
    users = this.userRepository,
  ): Promise<void> {
    const existingUser = await users.findOne({
      where: {
        email,
      },
    });

    if (
      existingUser &&
      existingUser.id !== ignoredUserId
    ) {
      throw new ConflictException(
        'Ya existe un usuario registrado con ese correo.',
      );
    }
  }

  private toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      role: user.role.name,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}