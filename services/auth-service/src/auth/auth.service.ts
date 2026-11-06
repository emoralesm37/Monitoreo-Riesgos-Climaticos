import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';

import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { AuditClientService } from './audit-client.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ExternalAccount } from './entities/external-account.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { ExternalProfile } from './interfaces/external-profile.interface';

interface RefreshTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  type: string;
  provider: string;
}

@Injectable()
export class AuthService {
constructor(
  @InjectRepository(User)
  private readonly userRepository: Repository<User>,

  @InjectRepository(Role)
  private readonly roleRepository: Repository<Role>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditClient: AuditClientService,
  ) {}

  async login(
    request: LoginRequestDto,
  ): Promise<LoginResponseDto> {
    const email = request.email.trim().toLowerCase();

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.role', 'role')
      .where('LOWER(user.email) = :email', { email })
      .getOne();

    if (!user) {
      await this.auditClient.registerEvent({
        service: 'auth-service',
        action: 'LOGIN_FAILED',
        result: 'FAILURE',
        details: { reason: 'INVALID_CREDENTIALS' },
      });

      throw new UnauthorizedException(
        'Correo o contraseña incorrectos.',
      );
    }

    if (!user.isActive) {
      await this.auditClient.registerEvent({
        service: 'auth-service',
        action: 'LOGIN_BLOCKED',
        user_id: user.id,
        entity_type: 'user',
        entity_id: user.id,
        result: 'BLOCKED',
        details: { reason: 'INACTIVE_USER' },
      });

      throw new ForbiddenException(
        'El usuario se encuentra inactivo.',
      );
    }
    if (!user.passwordHash) {
  throw new UnauthorizedException(
    'Esta cuenta utiliza autenticación externa.',
  );
}

    const passwordIsValid = await bcrypt.compare(
      request.password,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      await this.auditClient.registerEvent({
        service: 'auth-service',
        action: 'LOGIN_FAILED',
        user_id: user.id,
        entity_type: 'user',
        entity_id: user.id,
        result: 'FAILURE',
        details: { reason: 'INVALID_CREDENTIALS' },
      });

      throw new UnauthorizedException(
        'Correo o contraseña incorrectos.',
      );
    }

    const tokens = await this.issueTokenPair(user);

    await this.auditClient.registerEvent({
      service: 'auth-service',
      action: 'LOGIN_SUCCESS',
      user_id: user.id,
      entity_type: 'user',
      entity_id: user.id,
      result: 'SUCCESS',
      details: {
        method: 'password',
      },
    });

    return tokens;
  }
  
  async externalLogin(
  profile: ExternalProfile,
): Promise<LoginResponseDto> {
  const existingAccount =
    await this.externalAccountRepository.findOne({
      where: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
      relations: {
        user: {
          role: true,
        },
      },
    });

  if (existingAccount) {
    if (!existingAccount.user.isActive) {
      throw new ForbiddenException(
        'El usuario se encuentra inactivo.',
      );
    }

    return this.issueTokenPair(
  existingAccount.user,
  existingAccount.provider,
);
  }

  const email = profile.email.trim().toLowerCase();

  let user = await this.userRepository.findOne({
    where: { email },
    relations: { role: true },
  });

  if (!user) {
    const viewerRole =
      await this.roleRepository.findOne({
        where: { name: 'Viewer' },
      });

    if (!viewerRole) {
      throw new UnauthorizedException(
        'El rol Viewer no se encuentra configurado.',
      );
    }

    user = this.userRepository.create({
      name: profile.name.trim(),
      email,
      passwordHash: null,
      roleId: viewerRole.id,
      role: viewerRole,
      isActive: true,
    });

    user = await this.userRepository.save(user);
  }

  if (!user.isActive) {
    throw new ForbiddenException(
      'El usuario se encuentra inactivo.',
    );
  }

  const externalAccount =
    this.externalAccountRepository.create({
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      userId: user.id,
      user,
    });

  await this.externalAccountRepository.save(
    externalAccount,
  );

  return this.issueTokenPair(
  user,
  profile.provider,
);
}

  async refresh(
    refreshToken: string,
  ): Promise<LoginResponseDto> {
    const issuer =
      this.configService.getOrThrow<string>('JWT_ISSUER');

    const audience =
      this.configService.getOrThrow<string>('JWT_AUDIENCE');

    let payload: RefreshTokenPayload;

    try {
      payload =
        await this.jwtService.verifyAsync<RefreshTokenPayload>(
          
          refreshToken,
          {
            secret:
              this.configService.getOrThrow<string>(
                'JWT_REFRESH_SECRET',
              ),
            issuer,
            audience,
          },
        );
        
    } catch {
      throw new UnauthorizedException(
        'El refresh token no es válido o expiró.',
      );
    }

    if (
      payload.type !== 'refresh' ||
      !payload.sub
    ) {
      throw new UnauthorizedException(
        'El refresh token no es válido.',
      );
    }

    const storedToken =
      await this.refreshTokenRepository.findOne({
        where: {
          tokenHash: this.hashToken(refreshToken),
          revokedAt: IsNull(),
        },
        relations: {
          user: {
            role: true,
          },
        },
      });

    if (
      !storedToken ||
      storedToken.expiresAt <= new Date()
    ) {
      throw new UnauthorizedException(
        'El refresh token no es válido o expiró.',
      );
    }

    if (storedToken.user.id !== payload.sub) {
      throw new UnauthorizedException(
        'El refresh token no pertenece al usuario.',
      );
    }

    if (!storedToken.user.isActive) {
      throw new ForbiddenException(
        'El usuario se encuentra inactivo.',
      );
    }

    storedToken.revokedAt = new Date();

    await this.refreshTokenRepository.save(storedToken);

    return this.issueTokenPair(
    storedToken.user,
    payload.provider ?? 'local',
  );
  }

  async logout(
    refreshToken: string,
  ): Promise<{ message: string }> {
    const storedToken =
      await this.refreshTokenRepository.findOne({
        where: {
          tokenHash: this.hashToken(refreshToken),
          revokedAt: IsNull(),
        },
      });

    if (storedToken) {
      storedToken.revokedAt = new Date();

      await this.refreshTokenRepository.save(storedToken);
    }

    return {
      message: 'Sesión cerrada correctamente.',
    };
  }

private async issueTokenPair(
  user: User,
  provider = 'local',
): Promise<LoginResponseDto> {
  const accessTtl = this.getPositiveInteger(
    'JWT_ACCESS_TTL_SECONDS',
  );

  const refreshTtl = this.getPositiveInteger(
    'JWT_REFRESH_TTL_SECONDS',
  );

  const issuer =
    this.configService.getOrThrow<string>('JWT_ISSUER');

  const audience =
    this.configService.getOrThrow<string>('JWT_AUDIENCE');

  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role.name,
    roles: [user.role.name],
    permissions: this.getPermissions(user.role.name),
    provider,
  };

  const accessToken = await this.jwtService.signAsync(
    payload,
    {
      secret:
        this.configService.getOrThrow<string>(
          'JWT_ACCESS_SECRET',
        ),
      expiresIn: accessTtl,
      issuer,
      audience,
      jwtid: randomUUID(),
    },
  );

  const refreshToken = await this.jwtService.signAsync(
    {
      ...payload,
      type: 'refresh',
    },
    {
      secret:
        this.configService.getOrThrow<string>(
          'JWT_REFRESH_SECRET',
        ),
      expiresIn: refreshTtl,
      issuer,
      audience,
      jwtid: randomUUID(),
    },
  );

  const refreshTokenEntity =
    this.refreshTokenRepository.create({
      tokenHash: this.hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(
        Date.now() + refreshTtl * 1000,
      ),
      revokedAt: null,
    });

  await this.refreshTokenRepository.save(
    refreshTokenEntity,
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
    },
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresAt: new Date(
      Date.now() + accessTtl * 1000,
    ).toISOString(),
  };
}
  private getPermissions(role: string): string[] {
  const permissionsByRole: Record<string, string[]> = {
    Administrador: [
      'users:manage',
      'communities:read',
      'communities:write',
      'alerts:read',
      'alerts:write',
      'reports:read',
      'reports:generate',
    ],
    Operador: [
      'communities:read',
      'alerts:read',
      'alerts:write',
      'reports:read',
      'reports:generate',
    ],
    Viewer: [
      'communities:read',
      'alerts:read',
      'reports:read',
    ],
  };

  return permissionsByRole[role] ?? [];
}

  private getPositiveInteger(variableName: string): number {
    const value = Number(
      this.configService.getOrThrow<string>(variableName),
    );

    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(
        `${variableName} debe ser un entero positivo.`,
      );
    }

    return value;
  }

  private hashToken(token: string): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }
}