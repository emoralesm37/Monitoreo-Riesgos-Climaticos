import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let requiredRoles: string[] | undefined;
  let guard: RolesGuard;

  beforeEach(() => {
    requiredRoles = undefined;

    const reflector = {
      getAllAndOverride: () => requiredRoles,
    } as unknown as Reflector;

    guard = new RolesGuard(reflector);
  });

  function createContext(role?: string): ExecutionContext {
    return {
      getHandler: () => (() => undefined),
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: role ? { role } : undefined,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('permite rutas sin roles requeridos', () => {
    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('permite acceso al Administrador', () => {
    requiredRoles = ['Administrador'];

    expect(
      guard.canActivate(createContext('Administrador')),
    ).toBe(true);
  });

  it('rechaza al Operador', () => {
    requiredRoles = ['Administrador'];

    expect(
      guard.canActivate(createContext('Operador')),
    ).toBe(false);
  });
});