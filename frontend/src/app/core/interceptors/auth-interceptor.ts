import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { Auth } from '../services/auth';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = environment.apiUrl.replace(/\/$/, '');
  if (!(req.url === api || req.url.startsWith(`${api}/`)) || req.url.startsWith(`${api}/auth/`)) return next(req);
  const auth = inject(Auth);
  const generation = auth.sessionEpoch;
  const initialToken = auth.getToken();
  const send = (token: string | null) => next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
  const initial = !initialToken && auth.canRefresh()
    ? auth.refresh().pipe(map(response => response.accessToken)) : of(initialToken);
  return initial.pipe(switchMap(token => send(token).pipe(catchError(error => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401) return throwError(() => error);
    // Never replay an older user's request under a newly established session.
    if (generation !== auth.sessionEpoch) return throwError(() => error);
    if (!auth.canRefresh()) { auth.expireSession(); return throwError(() => error); }
    const current = auth.getToken();
    const renewal = current && current !== token ? of(current) : auth.refresh().pipe(map(response => response.accessToken));
    // next() skips this interceptor: exactly one replay, never a refresh loop.
    return renewal.pipe(switchMap(fresh => send(fresh).pipe(catchError(retryError => {
      if (retryError instanceof HttpErrorResponse && retryError.status === 401) auth.expireSession();
      return throwError(() => retryError);
    }))));
  }))));
};
