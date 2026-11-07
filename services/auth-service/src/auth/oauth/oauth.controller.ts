import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { OAuthService } from './oauth.service';
import { OAuthFailure } from './oauth-provider.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

class ExchangeDto {
  @Matches(/^[a-f0-9]{64}$/) state!: string;
  @Matches(/^[a-f0-9]{64}$/) code!: string;
}
class LinkDto {
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
@Controller('auth')
export class OAuthController {
  constructor(private oauth: OAuthService) {}
  @Get('oauth/status') status() {
    return this.oauth.providers.status();
  }
  private binding(req: Request, state: string) {
    if (!/^[a-f0-9]{64}$/.test(state)) return '';
    return (
      (req.headers.cookie || '')
        .split(';')
        .map((v) => v.trim())
        .find((v) => v.startsWith(`cg_oauth_${state}=`))
        ?.split('=')[1] || ''
    );
  }
  private cookie(state: string, secure: boolean) {
    return {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      path: '/api/auth',
      maxAge: 600000,
    };
  }
  private async begin(
    provider: string,
    req: Request,
    res: Response,
    userId?: string,
    password?: string,
  ) {
    this.oauth.origin(req.headers.origin);
    const p = this.oauth.providers.provider(provider),
      flow = await this.oauth.start(p, userId, password);
    res.setHeader('Cache-Control', 'no-store');
    res.cookie(
      `cg_oauth_${flow.state}`,
      flow.binding,
      this.cookie(flow.state, flow.secure),
    );
    return { authorizationUrl: flow.authorizationUrl };
  }
  @Post('oauth/:provider/start') start(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.begin(provider, req, res);
  }
  @Post('oauth/:provider/link')
  @UseGuards(JwtAuthGuard)
  link(
    @Param('provider') provider: string,
    @Body() body: LinkDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = req.user as { userId?: string; id?: string; sub?: string };
    const id = user?.userId || user?.id || user?.sub;
    if (!id) throw new UnauthorizedException();
    return this.begin(provider, req, res, id, body.password);
  }
  @Get('callback/:provider') async callback(
    @Param('provider') provider: string,
    @Query('state') state: string,
    @Query('code') code: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const target = new URL('/oauth/callback', this.oauth.providers.frontend());
    try {
      if (typeof state !== 'string' || !/^[a-f0-9]{64}$/.test(state))
        throw new OAuthFailure('invalid_state');
      const ticket = await this.oauth.callback(
        this.oauth.providers.provider(provider),
        state,
        this.binding(req, state),
        code,
        error,
      );
      target.hash = new URLSearchParams({ code: ticket, state }).toString();
    } catch (e) {
      target.hash = new URLSearchParams({
        error: e instanceof OAuthFailure ? e.reason : 'provider_unavailable',
      }).toString();
    }
    res.redirect(303, target.toString());
  }
  @Post('oauth/exchange') async exchange(
    @Body() body: ExchangeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.oauth.origin(req.headers.origin);
    res.setHeader('Cache-Control', 'no-store');
    try {
      return await this.oauth.exchange(
        body.state,
        body.code,
        this.binding(req, body.state),
      );
    } catch {
      throw new UnauthorizedException(
        'Retorno OAuth invalido, expirado o utilizado.',
      );
    } finally {
      res.clearCookie(`cg_oauth_${body.state}`, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api/auth',
      });
    }
  }
}
