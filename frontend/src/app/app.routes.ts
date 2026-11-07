import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';

export const routes: Routes = [
  {path:'oauth/callback',loadComponent:()=>import('./features/login/oauth-callback').then(m=>m.OAuthCallback)},
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login')
        .then(m => m.Login)
  },

  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout')
        .then(m => m.MainLayout),

    canActivate: [authGuard],

    children: [
      {path:'cuenta',loadComponent:()=>import('./features/login/linked-accounts').then(m=>m.LinkedAccounts)},
      {
        path: 'reportes',
        canActivate: [roleGuard],
        data: { roles: ['Administrador'] },
        loadComponent: () => import('./features/reportes/reportes').then(m => m.Reportes)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },

      {
       path: 'reglas',
       canActivate: [roleGuard],
       data: { roles: ['Administrador'] },
       loadComponent: () =>
       import('./features/reglas/reglas')
       .then(m => m.Reglas)
      },

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard')
            .then(m => m.Dashboard)
      },

      {
        path: 'sensores',
        loadComponent: () =>
          import('./features/sensores/sensores')
            .then(m => m.Sensores)
      },

      {
        path: 'comunidades',
        loadComponent: () =>
          import('./features/comunidades/comunidades')
            .then(m => m.Comunidades)
      },

      {
        path: 'alertas',
        loadComponent: () =>
          import('./features/alertas/alertas')
            .then(m => m.Alertas)
      },

      {
        path: 'historial',
        canActivate: [roleGuard],
        data: { roles: ['Administrador'] },
        loadComponent: () => import('./features/auditoria/auditoria').then(m => m.Auditoria)
      },
      {
        path: 'historial-alertas',
        loadComponent: () =>
          import('./features/historial/historial')
            .then(m => m.Historial)
      },

      {
        path: 'usuarios',

        canActivate: [roleGuard],

        data: {
          roles: ['Administrador']
        },

        loadComponent: () =>
          import('./features/usuarios/usuarios')
            .then(m => m.Usuarios)
      }
    ]
  },

  {
    path: '**',
    redirectTo: ''
  }
];
