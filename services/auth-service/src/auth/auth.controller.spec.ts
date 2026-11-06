import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginRequestDto } from './dto/login-request.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let receivedLogin: unknown;
  let receivedRefresh: unknown;
  let receivedLogout: unknown;
  let receivedExternalProfile: unknown;


  beforeEach(() => {
    receivedLogin = undefined;
    receivedRefresh = undefined;
    receivedLogout = undefined;
    receivedExternalProfile = undefined;

    const authService = {
      login: async (request: unknown) => {
        receivedLogin = request;
        return {};
      },
      refresh: async (refreshToken: string) => {
        receivedRefresh = refreshToken;
        return {};
      },
      logout: async (refreshToken: string) => {
        receivedLogout = refreshToken;
        return { message: 'Sesión cerrada.' };
      },
      externalLogin: async (profile: unknown) => {
        receivedExternalProfile = profile;
        return {};
      },
    } as unknown as AuthService;

    controller = new AuthController(authService);
  });

  it('envía las credenciales al servicio de login', async () => {
    const request: LoginRequestDto = {
      email: 'admin@climateguard.local',
      password: 'Password_123!',
    };

    await controller.login(request);

    expect(receivedLogin).toBe(request);
  });

  it('envía el refresh token al servicio', async () => {
    await controller.refresh({
      refreshToken: 'refresh-token',
    });

    expect(receivedRefresh).toBe('refresh-token');
  });

  it('envía el refresh token al cerrar sesión', async () => {
    await controller.logout({
      refreshToken: 'refresh-token',
    });

    expect(receivedLogout).toBe('refresh-token');
  });
  it('procesa el callback de Google', async () => {
  const profile = {
    provider: 'google',
    providerUserId: 'google-123',
    email: 'viewer@example.com',
    name: 'Viewer Google',
  };

  await controller.googleCallback({
    user: profile,
  } as never);

  expect(receivedExternalProfile).toEqual(profile);
});

it('procesa el callback de GitHub', async () => {
  const profile = {
    provider: 'github',
    providerUserId: 'github-123',
    email: 'viewer@example.com',
    name: 'Viewer GitHub',
  };

  await controller.githubCallback({
    user: profile,
  } as never);

  expect(receivedExternalProfile).toEqual(profile);
});
});