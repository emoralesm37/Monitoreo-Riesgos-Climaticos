import { Injectable, OnDestroy, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, defer, finalize, map, of, shareReplay, tap, throwError, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoginRequest { email: string; password: string; }
export interface LoginResponse {
  user: { id: string; name: string; email: string; role: string };
  accessToken: string; refreshToken: string; tokenType: string; expiresAt: string;
}
export interface AuthenticatedUser { userId: string; name: string; email: string; role: string; }
interface UserSession { user: AuthenticatedUser; token: string; refreshToken: string; expiresAt: number; }
export class SessionError extends Error {}
export const AUTH_TIMEOUT_MS = 10_000;

@Injectable({ providedIn: 'root' })
export class Auth implements OnDestroy {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly sessionKey = 'climateguard_user';
  private readonly revision = signal(0);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private refreshRequest?: Observable<LoginResponse>;
  private generation = 0;

  constructor(private http: HttpClient, private router: Router) {
    const session = this.readSession();
    if (session) this.scheduleRenewal(session.expiresAt);
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return defer(() => {
      const generation = ++this.generation;
      this.cancelTimer();
      this.refreshRequest = undefined;
      return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials).pipe(
        timeout(AUTH_TIMEOUT_MS),
        tap(response => {
          if (generation !== this.generation) { this.revoke(response.refreshToken); throw new SessionError('Solicitud reemplazada.'); }
          this.save(response);
        }),
        finalize(() => {
          if (generation === this.generation) {
            const stored = this.readSession();
            if (stored) this.scheduleRenewal(stored.expiresAt);
          }
        }),
      );
    });
  }

  startOAuth(provider: 'google' | 'github'): Observable<{authorizationUrl:string}> {
    return this.http.post<{authorizationUrl:string}>(`${this.apiUrl}/oauth/${provider}/start`, {}, {withCredentials:true}).pipe(timeout(AUTH_TIMEOUT_MS));
  }
  linkOAuth(provider:'google'|'github',password:string):Observable<{authorizationUrl:string}> {
    const token=this.getToken();
    if(!token)return throwError(()=>new SessionError('Sesion expirada.'));
    return this.http.post<{authorizationUrl:string}>(`${this.apiUrl}/oauth/${provider}/link`,{password},{withCredentials:true,headers:{Authorization:`Bearer ${token}`}}).pipe(timeout(AUTH_TIMEOUT_MS));
  }
  exchangeOAuth(code:string,state:string): Observable<LoginResponse> {
    return defer(() => {
      const generation=++this.generation;
      this.cancelTimer();this.refreshRequest=undefined;
      return this.http.post<LoginResponse>(`${this.apiUrl}/oauth/exchange`, {code,state}, {withCredentials:true}).pipe(
        timeout(AUTH_TIMEOUT_MS),tap(response=>{
          if(generation!==this.generation){this.revoke(response.refreshToken);throw new SessionError('Solicitud reemplazada.');}
          this.save(response);
        }));
    });
  }

  refresh(): Observable<LoginResponse> {
    if (this.refreshRequest) return this.refreshRequest;
    const session = this.readSession();
    if (!session || this.refreshExpired(session.refreshToken)) {
      this.expireSession('expired');
      return throwError(() => new SessionError('Sesion expirada.'));
    }
    const generation = this.generation;
    const request: Observable<LoginResponse> = this.http.post<LoginResponse>(`${this.apiUrl}/refresh`, { refreshToken: session.refreshToken }).pipe(
      timeout(AUTH_TIMEOUT_MS),
      tap(response => {
        if (generation !== this.generation || this.readSession()?.refreshToken !== session.refreshToken) {
          this.revoke(response.refreshToken); throw new SessionError('Sesion reemplazada.');
        }
        if (!response || response.user?.id !== session.user.userId) throw new SessionError('Respuesta de sesion incompatible.');
        this.save(response);
      }),
      catchError(error => {
        if (generation === this.generation && this.readSession()?.refreshToken === session.refreshToken) {
          if (error instanceof SessionError || (error instanceof HttpErrorResponse && [401, 403].includes(error.status)) || Date.now() >= session.expiresAt) {
            this.expireSession(error instanceof HttpErrorResponse && [401, 403].includes(error.status) ? 'expired' : 'renewal-error');
          } else {
            // A transient failure must not discard a still-valid access token.
            this.cancelTimer();
            this.timer = setTimeout(() => this.refresh().subscribe({ error: () => {} }), Math.min(5000, session.expiresAt - Date.now()));
          }
        }
        return throwError(() => error);
      }),
      finalize(() => { if (this.refreshRequest === request) this.refreshRequest = undefined; }),
      // Rotation is shared across simultaneous callers; never retry the POST automatically.
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.refreshRequest = request;
    return request;
  }

  ensureSession(): Observable<boolean> {
    if (this.getToken()) return of(true);
    if (!this.canRefresh()) { this.clearSession(); return of(false); }
    return this.refresh().pipe(map(() => true), catchError(() => of(false)));
  }
  canRefresh(): boolean {
    const session = this.readSession();
    return !!session && !this.refreshExpired(session.refreshToken);
  }
  hasSession(): boolean { return this.readSession() !== null; }
  get sessionEpoch(): number { return this.generation; }
  getToken(): string | null {
    this.revision();
    const session = this.readSession();
    return session && Date.now() < session.expiresAt ? session.token : null;
  }
  isAuthenticated(): boolean { return this.getToken() !== null; }
  getCurrentUser(): AuthenticatedUser | null {
    this.revision();
    return this.getToken() ? this.readSession()?.user ?? null : null;
  }
  logout(): void {
    const refreshToken = this.readSession()?.refreshToken;
    this.generation++; this.refreshRequest = undefined; this.clearSession();
    if (refreshToken) this.revoke(refreshToken);
  }
  expireSession(reason = 'expired'): void {
    this.generation++; this.refreshRequest = undefined; this.clearSession();
    if (!this.router.url.startsWith('/login')) {
      void this.router.navigate(['/login'], { queryParams: { reason, returnUrl: this.router.url } });
    }
  }
  private revoke(refreshToken: string) {
    if (!refreshToken) return;
    this.http.post(`${this.apiUrl}/logout`, { refreshToken }).pipe(timeout(AUTH_TIMEOUT_MS))
      .subscribe({ error: () => {} });
  }
  private save(response: LoginResponse) {
    if (!response || typeof response.expiresAt !== 'string' || typeof response.accessToken !== 'string' ||
        typeof response.refreshToken !== 'string' || typeof response.user?.id !== 'string' ||
        typeof response.user.role !== 'string') throw new SessionError('La respuesta de autenticacion no es valida.');
    const expiresAt = Date.parse(response.expiresAt);
    if (!response.user?.id || !response.user.role || !response.accessToken || !response.refreshToken ||
        response.tokenType !== 'Bearer' || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new SessionError('La respuesta de autenticacion no es valida.');
    }
    const session: UserSession = { user: { userId: response.user.id, name: response.user.name,
      email: response.user.email, role: response.user.role }, token: response.accessToken,
      refreshToken: response.refreshToken, expiresAt };
    try { sessionStorage.setItem(this.sessionKey, JSON.stringify(session)); }
    catch { throw new SessionError('No se pudo guardar la sesion. Permite el almacenamiento de este sitio.'); }
    this.revision.update(v => v + 1);
    this.scheduleRenewal(expiresAt);
  }
  private readSession(): UserSession | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const text = sessionStorage.getItem(this.sessionKey);
      if (!text) return null;
      const session = JSON.parse(text) as UserSession;
      if (!session.user?.userId || !session.user.role || !session.token || !session.refreshToken || !Number.isFinite(session.expiresAt)) {
        this.clearSession(); return null;
      }
      return session;
    } catch { this.clearSession(); return null; }
  }
  private refreshExpired(token: string): boolean {
    // UX scheduling only. All authentication/authorization remains on the server.
    try {
      const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(part));
      return typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000;
    } catch { return false; } // Opaque tokens are validated by Auth, never trusted locally.
  }
  private clearSession() {
    try { if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(this.sessionKey); } catch {}
    this.cancelTimer(); this.revision.update(v => v + 1);
  }
  private cancelTimer() { if (this.timer !== null) clearTimeout(this.timer); this.timer = null; }
  private scheduleRenewal(expiresAt: number) {
    this.cancelTimer();
    const remaining = expiresAt - Date.now();
    const delay = remaining > 60_000 ? remaining - 30_000 : Math.max(0, remaining);
    this.timer = setTimeout(() => this.refresh().subscribe({ error: () => {} }), Math.min(delay, 2_147_483_647));
  }
  ngOnDestroy() { this.generation++; this.cancelTimer(); }
}
