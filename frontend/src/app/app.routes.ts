import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';
import { Dashboard } from './features/dashboard/dashboard';
import { Sensores } from './features/sensores/sensores';
import { Alertas } from './features/alertas/alertas';
import { Historial } from './features/historial/historial';
import { Usuarios } from './features/usuarios/usuarios';

export const routes: Routes = [
  {
    path: '',
    component: MainLayout,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'sensores', component: Sensores },
      { path: 'alertas', component: Alertas },
      { path: 'historial', component: Historial },
      { path: 'usuarios', component: Usuarios },
    ],
  },
];