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

import { User } from '../users/entities/user.entity';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshToken } from './entities/refresh-token.entity';

interface RefreshTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
  type: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository:
      Repository<RefreshToken>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
      throw new UnauthorizedException(
        'Correo o contraseña incorrectos.',
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException(
        'El usuario se encuentra inactivo.',
      );
    }

    const passwordIsValid = await bcrypt.compare(
      request.password,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      throw new UnauthorizedException(
        'Correo o contraseña incorrectos.',
      );
    }

    return this.issueTokenPair(user);
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

    return this.issueTokenPair(storedToken.user);
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