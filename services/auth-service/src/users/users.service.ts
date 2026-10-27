import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

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

  async create(
    request: CreateUserRequestDto,
  ): Promise<UserResponseDto> {
    const normalizedEmail = request.email.trim().toLowerCase();

    await this.validateEmailAvailable(normalizedEmail);

    const role = await this.findRoleOrFail(request.roleId);

    const passwordHash = await bcrypt.hash(
      request.password,
      12,
    );

    const user = this.userRepository.create({
      name: request.name.trim(),
      email: normalizedEmail,
      passwordHash,
      roleId: role.id,
      role,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(user);

    return this.toResponseDto(savedUser);
  }

  async update(
    id: string,
    request: UpdateUserRequestDto,
  ): Promise<UserResponseDto> {
    const user = await this.findUserOrFail(id);

    if (request.name !== undefined) {
      user.name = request.name.trim();
    }

    if (request.email !== undefined) {
      const normalizedEmail =
        request.email.trim().toLowerCase();

      await this.validateEmailAvailable(
        normalizedEmail,
        user.id,
      );

      user.email = normalizedEmail;
    }

    if (request.roleId !== undefined) {
      const role = await this.findRoleOrFail(
        request.roleId,
      );

      user.roleId = role.id;
      user.role = role;
    }

    const updatedUser = await this.userRepository.save(user);

    return this.toResponseDto(updatedUser);
  }

  async changeStatus(
    id: string,
    request: ChangeUserStatusRequestDto,
  ): Promise<UserResponseDto> {
    const user = await this.findUserOrFail(id);

    user.isActive = request.isActive;

    const updatedUser = await this.userRepository.save(user);

    return this.toResponseDto(updatedUser);
  }

  private async findUserOrFail(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
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

  private async findRoleOrFail(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
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
  ): Promise<void> {
    const existingUser = await this.userRepository.findOne({
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