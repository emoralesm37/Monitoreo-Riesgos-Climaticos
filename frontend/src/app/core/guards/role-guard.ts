import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router
} from '@angular/router';

import { Auth } from '../services/auth';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(Auth);
  const router = inject(Router);

  const user = auth.getCurrentUser();

  if (!user) {
    return router.createUrlTree(['/login']);
  }

  const allowedRoles =
    route.data?.['roles'] as string[] | undefined;

  if (!allowedRoles || allowedRoles.length === 0) {
    return true;
  }

  if (allowedRoles.includes(user.role)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};