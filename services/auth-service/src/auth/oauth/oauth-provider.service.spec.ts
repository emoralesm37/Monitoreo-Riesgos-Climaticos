import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'crypto';
import { OAuthProviderService, hash } from './oauth-provider.service';

describe('OAuth provider protocol (isolated responses, not real provider login)', () => {
  const jwt = new JwtService();
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = {
    ...keys.publicKey.export({ format: 'jwk' }),
    kid: 'unit',
    use: 'sig',
  };
  const config = new ConfigService({
    GOOGLE_CLIENT_ID: 'unit-client',
    GOOGLE_CLIENT_SECRET: 'unit-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost:5247/api/auth/callback/google',
    OAUTH_FRONTEND_URL: 'http://localhost:4300',
    OAUTH_SESSION_KEY: 'a'.repeat(64),
  });
  function setup() {
    const service = new OAuthProviderService(config, jwt);
    jest.spyOn(service, 'json').mockResolvedValue({ keys: [jwk] });
    return service;
  }
  function token(overrides: Record<string, unknown> = {}) {
    return jwt.sign(
      {
        iss: 'https://accounts.google.com',
        aud: 'unit-client',
        exp: Math.floor(Date.now() / 1000) + 60,
        sub: 'stable-sub',
        email: 'unit@example.test',
        email_verified: true,
        nonce: 'nonce',
        ...overrides,
      },
      {
        privateKey: keys.privateKey
          .export({ format: 'pem', type: 'pkcs8' })
          .toString(),
        algorithm: 'RS256',
        keyid: 'unit',
      },
    );
  }
  it('verifies signed Google identity and nonce', async () => {
    expect(
      (await setup().googleIdentity(token(), 'unit-client', hash('nonce')))
        .providerUserId,
    ).toBe('stable-sub');
  });
  it.each(['nonce', 'audience', 'issuer', 'signature', 'expiry', 'email'])(
    'rejects invalid %s',
    async (issue) => {
      const service = setup();
      let t = token();
      let nonce = hash('nonce'),
        aud = 'unit-client';
      if (issue === 'nonce') nonce = hash('wrong');
      if (issue === 'audience') aud = 'wrong';
      if (issue === 'issuer') t = token({ iss: 'https://attacker.example' });
      if (issue === 'expiry') t = token({ exp: 1 });
      if (issue === 'email') t = token({ email_verified: false });
      if (issue === 'signature') t = t.slice(0, -12) + 'aaaaaaaaaaaa';
      await expect(service.googleIdentity(t, aud, nonce)).rejects.toThrow();
    },
  );
  it('disables missing configuration without preventing local Auth startup', () => {
    expect(new OAuthProviderService(new ConfigService(), jwt).status()).toEqual(
      { google: { configured: false }, github: { configured: false } },
    );
  });
  it('includes PKCE, nonce and state in authorization URL', () => {
    const url = new URL(
      setup().authorize('google', 'state', 'nonce', 'challenge'),
    );
    expect(url.searchParams.get('state')).toBe('state');
    expect(url.searchParams.get('nonce')).toBe('nonce');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });
  it.each([true, false])(
    'GitHub requires verified primary email (%s)',
    async (verified) => {
      const githubConfig = new ConfigService({
        GITHUB_CLIENT_ID: 'unit',
        GITHUB_CLIENT_SECRET: 'unit-secret',
        GITHUB_CALLBACK_URL: 'http://localhost:5247/api/auth/callback/github',
        OAUTH_FRONTEND_URL: 'http://localhost:4300',
        OAUTH_SESSION_KEY: 'a'.repeat(64),
      });
      const service = new OAuthProviderService(githubConfig, jwt);
      const mock = jest
        .spyOn(service, 'json')
        .mockResolvedValueOnce({
          access_token: 'unit-provider-token',
          token_type: 'bearer',
        })
        .mockResolvedValueOnce({ id: 12345, login: 'unit' })
        .mockResolvedValueOnce([
          { email: 'unit@example.test', primary: true, verified },
        ] as any);
      const operation = service.identity(
        'github',
        'unit-code',
        'unit-verifier',
        'unused',
      );
      if (verified) expect((await operation).providerUserId).toBe('12345');
      else await expect(operation).rejects.toThrow();
      expect(
        (mock.mock.calls[0][1]?.body as URLSearchParams).get('code_verifier'),
      ).toBe('unit-verifier');
    },
  );
  it('rejects callback hosts different from the frontend', () => {
    const wrong = new OAuthProviderService(
      new ConfigService({
        GOOGLE_CLIENT_ID: 'unit',
        GOOGLE_CLIENT_SECRET: 'unit-secret',
        GOOGLE_CALLBACK_URL: 'https://other.example/api/auth/callback/google',
        OAUTH_FRONTEND_URL: 'https://frontend.example',
        OAUTH_SESSION_KEY: 'a'.repeat(64),
      }),
      jwt,
    );
    expect(() => wrong.settings('google')).toThrow();
  });
});
