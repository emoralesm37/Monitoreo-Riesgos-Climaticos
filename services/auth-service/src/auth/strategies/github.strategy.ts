import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  Profile,
  Strategy,
} from 'passport-github2';

import { ExternalProfile } from '../interfaces/external-profile.interface';

@Injectable()
export class GithubStrategy extends PassportStrategy(
  Strategy,
  'github',
) {
  constructor(configService: ConfigService) {
    super({
      clientID:
        configService.getOrThrow<string>(
          'GITHUB_CLIENT_ID',
        ),
      clientSecret:
        configService.getOrThrow<string>(
          'GITHUB_CLIENT_SECRET',
        ),
      callbackURL:
        configService.getOrThrow<string>(
          'GITHUB_CALLBACK_URL',
        ),
      scope: ['user:email'],
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
        'GitHub no proporcionó un correo electrónico.',
      );
    }

    return {
      provider: 'github',
      providerUserId: profile.id,
      email,
      name:
        profile.displayName ||
        profile.username ||
        email.split('@')[0],
    };
  }
}