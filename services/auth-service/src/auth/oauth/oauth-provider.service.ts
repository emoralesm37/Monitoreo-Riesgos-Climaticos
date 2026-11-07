import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  createHash,
  createPublicKey,
  JsonWebKey,
  timingSafeEqual,
} from 'crypto';
import { isEmail } from 'class-validator';
import {
  ExternalProvider,
  ExternalProfile,
} from '../interfaces/external-profile.interface';

export const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const equalHash = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export class OAuthFailure extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

@Injectable()
export class OAuthProviderService {
  private keys?: { expires: number; values: JsonWebKey[] };
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}
  provider(value: string): ExternalProvider {
    if (value !== 'google' && value !== 'github')
      throw new BadRequestException('Proveedor no valido.');
    return value;
  }
  private url(value: string) {
    try {
      return new URL(value);
    } catch {
      throw new ServiceUnavailableException('Configuracion OAuth no valida.');
    }
  }
  frontend() {
    const url = this.url(
      this.config.get<string>('OAUTH_FRONTEND_URL') || 'http://localhost:4200',
    );
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      (url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname)
        ))
    )
      throw new ServiceUnavailableException({
        code: 'OAUTH_CONFIG',
        message: 'Configuracion OAuth no disponible.',
      });
    return url.origin;
  }
  settings(provider: ExternalProvider) {
    const prefix = provider.toUpperCase();
    const clientId = this.config.get<string>(prefix + '_CLIENT_ID'),
      clientSecret = this.config.get<string>(prefix + '_CLIENT_SECRET'),
      callback = this.config.get<string>(prefix + '_CALLBACK_URL');
    const sessionKey = this.config.get<string>('OAUTH_SESSION_KEY');
    if (
      !clientId ||
      !clientSecret ||
      !callback ||
      clientId.startsWith('REPLACE_') ||
      clientSecret.startsWith('REPLACE_') ||
      !sessionKey ||
      !/^[a-f0-9]{64}$/i.test(sessionKey)
    )
      throw new ServiceUnavailableException({
        code: 'OAUTH_NOT_CONFIGURED',
        message: 'El proveedor OAuth no esta configurado.',
      });
    const redirect = this.url(callback),
      frontend = this.url(this.frontend());
    if (
      redirect.hostname !== frontend.hostname ||
      redirect.username ||
      redirect.password ||
      redirect.search ||
      redirect.hash ||
      redirect.pathname !== `/api/auth/callback/${provider}` ||
      (redirect.protocol !== 'https:' &&
        !(
          redirect.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(redirect.hostname)
        ))
    )
      throw new ServiceUnavailableException({
        code: 'OAUTH_CONFIG',
        message: 'Callback OAuth no valido.',
      });
    if (
      this.config.get('NODE_ENV') === 'production' &&
      (redirect.protocol !== 'https:' || frontend.protocol !== 'https:')
    )
      throw new ServiceUnavailableException('OAuth requiere HTTPS.');
    return {
      clientId,
      clientSecret,
      callback,
      sessionKey,
      secure: redirect.protocol === 'https:',
    };
  }
  status() {
    return Object.fromEntries(
      (['google', 'github'] as const).map((p) => {
        try {
          this.settings(p);
          return [p, { configured: true }];
        } catch {
          return [p, { configured: false }];
        }
      }),
    );
  }
  authorize(
    provider: ExternalProvider,
    state: string,
    nonce: string,
    challenge: string,
  ) {
    const cfg = this.settings(provider),
      url = new URL(
        provider === 'google'
          ? 'https://accounts.google.com/o/oauth2/v2/auth'
          : 'https://github.com/login/oauth/authorize',
      );
    const params: Record<string, string> = {
      client_id: cfg.clientId,
      redirect_uri: cfg.callback,
      response_type: 'code',
      scope:
        provider === 'google' ? 'openid email profile' : 'read:user user:email',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    };
    if (provider === 'google') params.nonce = nonce;
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  }
  async json(url: string, options: RequestInit = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new OAuthFailure('provider_unavailable');
      let size = 0;
      const chunks: Uint8Array[] = [];
      if (!response.body) throw new OAuthFailure('provider_rejected');
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 262144) throw new OAuthFailure('provider_rejected');
        chunks.push(chunk);
      }
      return JSON.parse(Buffer.concat(chunks).toString()) as Record<
        string,
        any
      >;
    } catch (error) {
      if (error instanceof OAuthFailure) throw error;
      throw new OAuthFailure('provider_unavailable');
    }
  }
  async identity(
    provider: ExternalProvider,
    code: string,
    verifier: string,
    nonceHash: string,
  ): Promise<ExternalProfile> {
    const cfg = this.settings(provider),
      body = new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.callback,
        code,
        code_verifier: verifier,
        grant_type: 'authorization_code',
      });
    const tokens = await this.json(
      provider === 'google'
        ? 'https://oauth2.googleapis.com/token'
        : 'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
      },
    );
    if (tokens.error) throw new OAuthFailure('provider_rejected');
    if (provider === 'google')
      return this.googleIdentity(tokens.id_token, cfg.clientId, nonceHash);
    if (
      typeof tokens.access_token !== 'string' ||
      tokens.token_type?.toLowerCase() !== 'bearer'
    )
      throw new OAuthFailure('provider_rejected');
    const headers = {
      Authorization: 'Bearer ' + tokens.access_token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    };
    const profile = await this.json('https://api.github.com/user', { headers });
    const emails = await this.json(
      'https://api.github.com/user/emails?per_page=100',
      { headers },
    );
    const email = Array.isArray(emails)
      ? emails.find(
          (e: any) =>
            e.primary === true &&
            e.verified === true &&
            typeof e.email === 'string',
        )?.email
      : null;
    if (!Number.isSafeInteger(profile.id) || profile.id <= 0 || !email)
      throw new OAuthFailure('verified_email_required');
    return this.profile(
      'github',
      String(profile.id),
      email,
      profile.name || profile.login,
    );
  }
  async googleIdentity(
    token: unknown,
    clientId: string,
    nonceHash: string,
  ): Promise<ExternalProfile> {
    try {
      if (typeof token !== 'string' || token.length > 20000) throw new Error();
      const decoded = this.jwt.decode(token, { complete: true }) as {
        header: { kid?: string; alg?: string };
      } | null;
      if (decoded?.header.alg !== 'RS256' || !decoded.header.kid)
        throw new Error();
      if (!this.keys || this.keys.expires < Date.now()) {
        const jwks = await this.json(
          'https://www.googleapis.com/oauth2/v3/certs',
        );
        if (!Array.isArray(jwks.keys)) throw new Error();
        this.keys = { expires: Date.now() + 300000, values: jwks.keys };
      }
      let key = this.keys.values.find(
        (k: any) =>
          k.kid === decoded.header.kid && k.kty === 'RSA' && k.use === 'sig',
      );
      if (!key) {
        this.keys = undefined;
        throw new Error();
      }
      const publicKey = createPublicKey({ key, format: 'jwk' })
        .export({ type: 'spki', format: 'pem' })
        .toString();
      const claims = await this.jwt.verifyAsync(token, {
        publicKey,
        algorithms: ['RS256'],
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: clientId,
      });
      if (
        typeof claims.exp !== 'number' ||
        !claims.sub ||
        typeof claims.nonce !== 'string' ||
        !equalHash(hash(claims.nonce), nonceHash) ||
        claims.email_verified !== true ||
        ((claims.azp || (Array.isArray(claims.aud) && claims.aud.length > 1)) &&
          claims.azp !== clientId)
      )
        throw new Error();
      return this.profile('google', claims.sub, claims.email, claims.name);
    } catch (error) {
      if (error instanceof OAuthFailure) throw error;
      throw new OAuthFailure('provider_rejected');
    }
  }
  private profile(
    provider: ExternalProvider,
    id: string,
    email: string,
    name: unknown,
  ): ExternalProfile {
    if (
      typeof id !== 'string' ||
      !id.length ||
      id.length > 255 ||
      typeof email !== 'string' ||
      email.length > 150 ||
      !isEmail(email)
    )
      throw new OAuthFailure('verified_email_required');
    return {
      provider,
      providerUserId: id,
      email: email.trim().toLowerCase(),
      name: (typeof name === 'string' && name.trim()
        ? name.trim()
        : email.split('@')[0]
      ).slice(0, 100),
    };
  }
}
