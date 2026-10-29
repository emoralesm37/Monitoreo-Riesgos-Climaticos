import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DatabaseSeederService
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(
    DatabaseSeederService.name,
  );

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const name = this.configService
      .get<string>('INITIAL_ADMIN_NAME')
      ?.trim();

    const email = this.configService
      .get<string>('INITIAL_ADMIN_EMAIL')
      ?.trim()
      .toLowerCase();

    const password = this.configService.get<string>(
      'INITIAL_ADMIN_PASSWORD',
    );

    if (!name || !email || !password) {
      this.logger.warn(
        'No se creó el administrador inicial porque faltan variables de entorno.',
      );
      return;
    }

    if (password.length < 12) {
      throw new Error(
        'INITIAL_ADMIN_PASSWORD debe tener al menos 12 caracteres.',
      );
    }

    const existingUser =
      await this.userRepository.findOne({
        where: { email },
      });

    if (existingUser) {
      this.logger.log(
        'El administrador inicial ya existe.',
      );
      return;
    }

    const administratorRole =
      await this.roleRepository.findOne({
        where: { name: 'Administrador' },
      });

    if (!administratorRole) {
      throw new Error(
        'No existe el rol Administrador. Ejecute las migraciones.',
      );
    }

    const passwordHash = await bcrypt.hash(
      password,
      12,
    );

    const administrator = this.userRepository.create({
      name,
      email,
      passwordHash,
      roleId: administratorRole.id,
      isActive: true,
    });

    await this.userRepository.save(administrator);

    this.logger.log(
      'Administrador inicial creado correctamente.',
    );
  }
}