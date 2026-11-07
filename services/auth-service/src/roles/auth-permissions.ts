// Read-only description of existing Auth routes, not an editable permission system.
// Tests compare this inventory with controller metadata to prevent drift.
export const authPermissions = [
  { method: 'GET', path: '/api/users', label: 'Consultar usuarios', roles: ['Administrador'] },
  { method: 'GET', path: '/api/users/:id', label: 'Consultar detalle de usuario', roles: ['Administrador'] },
  { method: 'POST', path: '/api/users', label: 'Crear usuarios', roles: ['Administrador'] },
  { method: 'PATCH', path: '/api/users/:id', label: 'Editar usuarios y asignar roles', roles: ['Administrador'] },
  { method: 'PATCH', path: '/api/users/:id/status', label: 'Activar o desactivar usuarios', roles: ['Administrador'] },
  { method: 'GET', path: '/api/roles', label: 'Consultar roles y permisos', roles: ['Administrador'] },
] as const;
