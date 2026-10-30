import { Injectable } from '@nestjs/common';
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
  constructor(configService: ConfigService) {
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

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  }
}