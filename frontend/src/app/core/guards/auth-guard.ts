import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { map } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(Auth);
  const router = inject(Router);
  const hadSession = auth.hasSession();

  return auth.ensureSession().pipe(map(valid => valid ? true : router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url, ...(hadSession ? { reason: 'expired' } : {}) }
  })));
};
