import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { RefreshTokenRequestDto } from './dto/refresh-token-request.dto';

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
}