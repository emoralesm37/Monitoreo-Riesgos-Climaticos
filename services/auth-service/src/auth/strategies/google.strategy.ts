import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  Profile,
  Strategy,
} from 'passport-google-oauth20';

import { ExternalProfile } from '../interfaces/external-profile.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  Strategy,
  'google',
) {
  constructor(configService: ConfigService) {
    super({
      clientID:
        configService.getOrThrow<string>(
          'GOOGLE_CLIENT_ID',
        ),
      clientSecret:
        configService.getOrThrow<string>(
          'GOOGLE_CLIENT_SECRET',
        ),
      callbackURL:
        configService.getOrThrow<string>(
          'GOOGLE_CALLBACK_URL',
        ),
      scope: ['openid', 'email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): ExternalProfile {
    const email = profile.emails?.[0]?.value
      ?.trim()
      .toLowerCase();

    if (!email) {
      throw new UnauthorizedException(
        'Google no proporcionó un correo electrónico.',
      );
    }

    return {
      provider: 'google',
      providerUserId: profile.id,
      email,
      name:
        profile.displayName ||
        email.split('@')[0],
    };
  }
}