import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';
import { Dashboard } from './features/dashboard/dashboard';
import { Sensores } from './features/sensores/sensores';
import { Alertas } from './features/alertas/alertas';
import { Historial } from './features/historial/historial';
import { Usuarios } from './features/usuarios/usuarios';
import { Login } from './features/login/login';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: 'login',
    component: Login
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'sensores', component: Sensores },
      { path: 'alertas', component: Alertas },
      { path: 'historial', component: Historial },
      { path: 'usuarios', component: Usuarios },
    ],
  },
  {
    path: '**',
    redirectTo: ''
  }
];