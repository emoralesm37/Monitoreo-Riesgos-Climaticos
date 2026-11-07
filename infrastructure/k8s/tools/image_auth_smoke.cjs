// Execute inside Auth's runtime image. Synthetic inputs; no database or provider IO.
require('/app/node_modules/reflect-metadata');
const { ConfigService } = require('/app/node_modules/@nestjs/config');
const { JwtService } = require('/app/node_modules/@nestjs/jwt');
const { AuthService } = require('/app/dist/auth/auth.service.js');
const { OAuthProviderService, hash } = require('/app/dist/auth/oauth/oauth-provider.service.js');
const crypto = require('crypto');
const bcrypt = require('/app/node_modules/bcrypt');
const fs = require('fs');
async function main() {
  const jwt = new JwtService();
  const config = new ConfigService({ JWT_ACCESS_SECRET: 'isolated-access-synthetic-key',
    JWT_REFRESH_SECRET: 'isolated-refresh-synthetic-key', JWT_ISSUER: 'unit', JWT_AUDIENCE: 'unit',
    JWT_ACCESS_TTL_SECONDS: '300', JWT_REFRESH_TTL_SECONDS: '600' });
  const rows = [];
  const repo = { create: v => v, save: async v => { if (!rows.includes(v)) rows.push(v); return v; } };
  const auth = new AuthService({}, repo, jwt, config);
  const user = { id: '11111111-1111-4111-8111-111111111111', name: 'Synthetic', email: 'unit@example.test', role: { name: 'Viewer' } };
  const pair = await auth.issueTokenPair(user, repo, 'github');
  const claims = jwt.verify(pair.accessToken, { secret: 'isolated-access-synthetic-key', issuer: 'unit', audience: 'unit' });
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const provider = new OAuthProviderService(new ConfigService(), jwt);
  provider.json = async () => ({ keys: [{ ...keys.publicKey.export({ format: 'jwk' }), kid: 'unit', use: 'sig' }] });
  const token = jwt.sign({ iss: 'https://accounts.google.com', aud: 'unit', sub: 'synthetic-sub',
    email: 'unit@example.test', email_verified: true, nonce: 'synthetic-nonce' }, {
    privateKey: keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(), algorithm: 'RS256', keyid: 'unit', expiresIn: 60 });
  const identity = await provider.googleIdentity(token, 'unit', hash('synthetic-nonce'));
  const password = await bcrypt.hash('synthetic-test-only', 4);
  const checks = { nativeBcrypt: await bcrypt.compare('synthetic-test-only', password),
    viewerClaims: claims.role === 'Viewer' && claims.roles.length === 1 && !claims.permissions.includes('users:manage'),
    provider: claims.provider === 'github', hashedRefresh: rows[0].tokenHash !== pair.refreshToken,
    googleOidcSignatureNonce: identity.providerUserId === 'synthetic-sub',
    oauthMigrationsCompiled: fs.readdirSync('/app/dist/database/migrations').filter(p => p.endsWith('.js')).length === 4 };
  console.log(JSON.stringify(checks));
  if (Object.values(checks).some(v => !v)) process.exitCode = 1;
}
main().catch(() => { console.error('Auth image verification failed.'); process.exitCode = 1; });
