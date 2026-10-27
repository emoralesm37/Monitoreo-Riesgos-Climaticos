import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from '../services/auth';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = environment.apiUrl.replace(/\/$/, '');

  const isApiRequest =
    req.url === apiUrl ||
    req.url.startsWith(`${apiUrl}/`);

  const isAuthRequest =
    req.url.startsWith(`${apiUrl}/auth/`);

  if (!isApiRequest || isAuthRequest) {
    return next(req);
  }

  const token = inject(Auth).getToken();

  if (!token) {
    return next(req);
  }

  return next(req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  }));
};