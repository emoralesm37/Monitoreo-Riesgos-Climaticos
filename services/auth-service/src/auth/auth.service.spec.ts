import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { createHash } from 'crypto';
import * as bcrypt from 'bcrypt';

describe('JWT claims and refresh rotation (isolated repositories)', () => {
  const jwt = new JwtService();
  const config = new ConfigService({ JWT_ACCESS_SECRET: 'synthetic-access-key', JWT_REFRESH_SECRET: 'synthetic-refresh-key', JWT_ISSUER: 'unit', JWT_AUDIENCE: 'unit', JWT_ACCESS_TTL_SECONDS: '300', JWT_REFRESH_TTL_SECONDS: '600' });
  let user: any, rows: any[], repo: any, service: AuthService;
  beforeEach(async () => {
    user = { id: '11111111-1111-4111-8111-111111111111', email: 'viewer@example.test', name: 'Viewer', role: { name: 'Viewer' }, isActive: true, passwordHash: await bcrypt.hash('synthetic-password', 4) };
    rows = [];
    repo = { create: (v: any) => v, save: async (v: any) => { if (!rows.includes(v)) rows.push(v); return v; }, findOne: async ({where}: any) => rows.find(r => r.tokenHash === where.tokenHash && !r.revokedAt) };
    const users: any = { findOne: async () => user, createQueryBuilder: () => { const q: any = { addSelect: () => q, leftJoinAndSelect: () => q, where: () => q, getOne: async () => user }; return q; } };
    repo.manager = { transaction: async (fn: any) => fn({ query: async () => {}, getRepository: (entity: any) => entity.name === 'User' ? users : repo }) };
    service = new AuthService(users, repo, jwt, config);
  });
  it.each(['local', 'google', 'github'] as const)('signs claims and preserves %s through rotation', async provider => {
    const first = await service.issueTokenPair(user, repo, provider);
    const access = jwt.verify(first.accessToken, {secret: 'synthetic-access-key', issuer: 'unit', audience: 'unit'});
    expect(access).toMatchObject({role:'Viewer', roles:['Viewer'], provider, permissions:['communities:read','alerts:read','reports:read']});
    expect(access.jti).toBeDefined();
    expect(rows[0].tokenHash).toBe(createHash('sha256').update(first.refreshToken).digest('hex'));
    user.role.name = 'Operador';
    const next = await service.refresh(first.refreshToken);
    expect(jwt.decode(next.accessToken)).toMatchObject({provider, role:'Operador', roles:['Operador']});
    expect(next.refreshToken).not.toBe(first.refreshToken);
    await expect(service.refresh(first.refreshToken)).rejects.toThrow();
    await service.logout(next.refreshToken);
    await expect(service.refresh(next.refreshToken)).rejects.toThrow();
  });
  it('keeps password login local and rejects incorrect credentials', async () => {
    const result = await service.login({email:user.email, password:'synthetic-password'});
    expect(jwt.decode(result.accessToken)).toMatchObject({provider:'local'});
    await expect(service.login({email:user.email, password:'wrong'})).rejects.toThrow();
    user.passwordHash = null;
    await expect(service.login({email:user.email, password:'synthetic-password'})).rejects.toThrow();
  });
  it('rejects access tokens as refresh and disabled accounts', async () => {
    const pair = await service.issueTokenPair(user);
    await expect(service.refresh(pair.accessToken)).rejects.toThrow();
    user.isActive = false;
    await expect(service.refresh(pair.refreshToken)).rejects.toThrow();
  });
  it.each(['Administrador', 'Operador', 'Viewer', 'unknown'])('issues least privilege claims for %s', async role => {
    user.role.name = role;
    const pair = await service.issueTokenPair(user);
    const claims = jwt.decode(pair.accessToken);
    expect(claims.roles).toEqual([role]);
    expect(claims.permissions.includes('users:manage')).toBe(role === 'Administrador');
    expect(claims.permissions.includes('alerts:write')).toBe(['Administrador','Operador'].includes(role));
    if (role === 'unknown') expect(claims.permissions).toEqual([]);
  });
  it.each(['signature', 'issuer', 'audience', 'expiry'])('rejects refresh with invalid %s', async issue => {
    const token = jwt.sign({sub:user.id, type:'refresh'}, {
      secret:issue === 'signature' ? 'wrong-synthetic-key' : 'synthetic-refresh-key',
      issuer:issue === 'issuer' ? 'wrong' : 'unit',
      audience:issue === 'audience' ? 'wrong' : 'unit',
      expiresIn:issue === 'expiry' ? -1 : 600,
    });
    await expect(service.refresh(token)).rejects.toThrow();
  });
  it('renews legacy refresh tokens without provider as local', async () => {
    const token = jwt.sign({sub:user.id, type:'refresh'}, {
      secret:'synthetic-refresh-key', issuer:'unit', audience:'unit', expiresIn:600,
    });
    rows.push({tokenHash:createHash('sha256').update(token).digest('hex'),
      userId:user.id, expiresAt:new Date(Date.now()+600000), revokedAt:null});
    const pair = await service.refresh(token);
    expect(jwt.decode(pair.accessToken)).toMatchObject({provider:'local'});
  });
  it('rejects an unrecognized provider even in a signed stored refresh token', async () => {
    const token = jwt.sign({sub:user.id, type:'refresh', provider:'unknown'}, {
      secret:'synthetic-refresh-key', issuer:'unit', audience:'unit', expiresIn:600,
    });
    rows.push({tokenHash:createHash('sha256').update(token).digest('hex'),
      userId:user.id, expiresAt:new Date(Date.now()+600000), revokedAt:null});
    await expect(service.refresh(token)).rejects.toThrow();
  });
});
