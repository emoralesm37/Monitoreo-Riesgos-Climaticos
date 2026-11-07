import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto';
import * as bcrypt from 'bcrypt';
import { OAuthFlow } from './oauth-flow.entity';
import {
  OAuthProviderService,
  OAuthFailure,
  hash,
  equalHash,
} from './oauth-provider.service';
import { ExternalAccount } from '../entities/external-account.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../roles/entities/role.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { AuthService } from '../auth.service';
import type { ExternalProvider } from '../interfaces/external-profile.interface';

@Injectable()
export class OAuthService {
  constructor(
    private db: DataSource,
    readonly providers: OAuthProviderService,
    private auth: AuthService,
  ) {}
  origin(value: unknown) {
    if (value !== this.providers.frontend())
      throw new ForbiddenException('Origen no permitido.');
  }
  private crypt(value: string, key: string, decrypt = false) {
    if (decrypt) {
      const b = Buffer.from(value, 'base64url'),
        c = createDecipheriv(
          'aes-256-gcm',
          Buffer.from(key, 'hex'),
          b.subarray(0, 12),
        );
      c.setAuthTag(b.subarray(12, 28));
      return Buffer.concat([c.update(b.subarray(28)), c.final()]).toString();
    }
    const iv = randomBytes(12),
      c = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv),
      body = Buffer.concat([c.update(value), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
  }
  async start(provider: ExternalProvider, userId?: string, password?: string) {
    const cfg = this.providers.settings(provider);
    if (userId) {
      const user = await this.db
        .getRepository(User)
        .createQueryBuilder('u')
        .addSelect('u.passwordHash')
        .where('u.id=:id', { id: userId })
        .getOne();
      if (
        !user?.isActive ||
        !user.passwordHash ||
        !password ||
        !(await bcrypt.compare(password, user.passwordHash))
      )
        throw new UnauthorizedException('No se pudo confirmar la identidad.');
    }
    const state = randomBytes(32).toString('hex'),
      binding = randomBytes(32).toString('base64url'),
      nonce = randomBytes(32).toString('base64url'),
      verifier = randomBytes(32).toString('base64url');
    const repo = this.db.getRepository(OAuthFlow);
    await repo.save(
      repo.create({
        stateHash: hash(state),
        bindingHash: hash(binding),
        provider,
        nonceHash: hash(nonce),
        verifierCipher: this.crypt(verifier, cfg.sessionKey),
        expiresAt: new Date(Date.now() + 600000),
        linkUserId: userId ?? null,
      }),
    );
    return {
      state,
      binding,
      secure: cfg.secure,
      authorizationUrl: this.providers.authorize(
        provider,
        state,
        nonce,
        createHash('sha256').update(verifier).digest('base64url'),
      ),
    };
  }
  private bound(flow: OAuthFlow | null, binding: string) {
    if (
      !flow ||
      flow.expiresAt <= new Date() ||
      !binding ||
      !equalHash(flow.bindingHash, hash(binding))
    )
      throw new OAuthFailure('invalid_state');
    return flow;
  }
  async callback(
    provider: ExternalProvider,
    state: string,
    binding: string,
    code: string,
    error?: string,
  ) {
    const flow = await this.db.transaction(async (m) => {
      const repo = m.getRepository(OAuthFlow);
      const f = this.bound(
        await repo.findOne({
          where: { stateHash: hash(state) },
          lock: { mode: 'pessimistic_write' },
        }),
        binding,
      );
      if (f.provider !== provider || f.consumedAt)
        throw new OAuthFailure('invalid_state');
      f.consumedAt = new Date();
      return repo.save(f);
    });
    if (error)
      throw new OAuthFailure(
        error === 'access_denied' ? 'cancelled' : 'provider_rejected',
      );
    if (typeof code !== 'string' || !code || code.length > 4096)
      throw new OAuthFailure('provider_rejected');
    const identity = await this.providers.identity(
      provider,
      code,
      this.crypt(
        flow.verifierCipher,
        this.providers.settings(provider).sessionKey,
        true,
      ),
      flow.nonceHash,
    );
    const ticket = randomBytes(32).toString('hex');
    await this.db.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock($1)', [1128743491]);
      const accounts = m.getRepository(ExternalAccount),
        users = m.getRepository(User);
      const existing = await accounts.findOne({
        where: { provider, providerUserId: identity.providerUserId },
      });
      let user: User | null = null;
      if (flow.linkUserId) {
        user = await users.findOne({
          where: { id: flow.linkUserId },
          relations: { role: true },
        });
        if (!user?.isActive || (existing && existing.userId !== user.id))
          throw new OAuthFailure('link_rejected');
        if (
          !existing &&
          (await accounts.findOne({ where: { provider, userId: user.id } }))
        )
          throw new OAuthFailure('link_rejected');
      } else if (existing)
        user = await users.findOne({
          where: { id: existing.userId },
          relations: { role: true },
        });
      else {
        if (
          await users
            .createQueryBuilder('u')
            .where('LOWER(u.email)=:email', { email: identity.email })
            .getOne()
        )
          throw new OAuthFailure('account_link_required');
        const role = await m.getRepository(Role).findOneBy({ name: 'Viewer' });
        if (!role) throw new OAuthFailure('configuration');
        user = await users.save(
          users.create({
            name: identity.name,
            email: identity.email,
            passwordHash: null,
            roleId: role.id,
            role,
            isActive: true,
          }),
        );
      }
      if (!user?.isActive) throw new OAuthFailure('account_inactive');
      if (!existing)
        await accounts.save(
          accounts.create({
            provider,
            providerUserId: identity.providerUserId,
            userId: user.id,
          }),
        );
      await m
        .getRepository(OAuthFlow)
        .update(flow.id, {
          userId: user.id,
          exchangeHash: hash(ticket),
          expiresAt: new Date(Date.now() + 60000),
          verifierCipher: '',
        });
    });
    return ticket;
  }
  async exchange(state: string, ticket: string, binding: string) {
    return this.db.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock($1)', [1128743491]);
      const repo = m.getRepository(OAuthFlow),
        f = this.bound(
          await repo.findOne({
            where: { stateHash: hash(state) },
            lock: { mode: 'pessimistic_write' },
          }),
          binding,
        );
      if (
        !f.consumedAt ||
        !f.userId ||
        !f.exchangeHash ||
        f.exchangeUsedAt ||
        !equalHash(f.exchangeHash, hash(ticket))
      )
        throw new UnauthorizedException('Retorno OAuth invalido o utilizado.');
      const user = await m
        .getRepository(User)
        .findOne({ where: { id: f.userId }, relations: { role: true } });
      if (!user?.isActive)
        throw new UnauthorizedException('Cuenta no disponible.');
      f.exchangeUsedAt = new Date();
      await repo.save(f);
      if (f.provider !== 'google' && f.provider !== 'github')
        throw new UnauthorizedException('Proveedor de sesión no válido.');
      return this.auth.issueTokenPair(user, m.getRepository(RefreshToken), f.provider);
    });
  }
}
