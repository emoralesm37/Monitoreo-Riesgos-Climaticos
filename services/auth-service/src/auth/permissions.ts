// JWT capability claims. Route guards remain the authority for access checks.
export function permissionsForRole(role: string): string[] {
  const permissions: Record<string, string[]> = {
    Administrador: ['users:manage', 'communities:read', 'communities:write',
      'alerts:read', 'alerts:write', 'reports:read', 'reports:generate'],
    Operador: ['communities:read', 'alerts:read', 'alerts:write',
      'reports:read', 'reports:generate'],
    Viewer: ['communities:read', 'alerts:read', 'reports:read'],
  };
  return [...(permissions[role] ?? [])];
}
