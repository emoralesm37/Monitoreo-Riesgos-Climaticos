import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { AuthService } from './auth.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshTokenRequestDto } from './dto/refresh-token-request.dto';
import { ExternalProfile } from './interfaces/external-profile.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { ExternalAccount } from './entities/external-account.entity';
import { RefreshToken } from './entities/refresh-token.entity';

type ExternalAuthRequest = Request & {
  user: ExternalProfile;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() request: LoginRequestDto,
  ): Promise<LoginResponseDto> {
    return this.authService.login(request);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body() request: RefreshTokenRequestDto,
  ): Promise<LoginResponseDto> {
    return this.authService.refresh(
      request.refreshToken,
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(
    @Body() request: RefreshTokenRequestDto,
  ): Promise<{ message: string }> {
    return this.authService.logout(
      request.refreshToken,
    );
  }

  // Inicia la autenticación con Google.
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {}

  // Google regresa al usuario a esta ruta.
  @Get('callback/google')
  @UseGuards(AuthGuard('google'))
  googleCallback(
    @Req() request: ExternalAuthRequest,
  ): Promise<LoginResponseDto> {
    return this.authService.externalLogin(
      request.user,
    );
  }

  // Inicia la autenticación con GitHub.
  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubLogin(): void {}

  // GitHub regresa al usuario a esta ruta.
  @Get('callback/github')
  @UseGuards(AuthGuard('github'))
  githubCallback(
    @Req() request: ExternalAuthRequest,
  ): Promise<LoginResponseDto> {
    return this.authService.externalLogin(
      request.user,
    );
  }
}