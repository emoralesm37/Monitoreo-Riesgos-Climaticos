import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { isUUID } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
} from 'passport-jwt';

import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService, @InjectRepository(User) private readonly users: Repository<User>) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.getOrThrow<string>(
          'JWT_ACCESS_SECRET',
        ),
      issuer:
        configService.getOrThrow<string>('JWT_ISSUER'),
      audience:
        configService.getOrThrow<string>('JWT_AUDIENCE'),
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!isUUID(payload.sub)) throw new UnauthorizedException('Identidad no válida.');
    const user = await this.users.findOne({ where: { id: payload.sub }, relations: { role: true } });
    if (!user?.isActive || user.role.name !== payload.role)
      throw new UnauthorizedException('La identidad o los permisos de la sesión cambiaron.');
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
    };
  }
}
