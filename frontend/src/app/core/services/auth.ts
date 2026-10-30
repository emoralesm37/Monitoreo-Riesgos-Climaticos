import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: string;
}

export interface AuthenticatedUser {
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface UserSession {
  user: AuthenticatedUser;
  token: string;
  refreshToken: string;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly sessionKey = 'climateguard_user';

  private expirationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    const session = this.getValidSession();

    if (session) {
      this.scheduleExpiration(session.expiresAt);
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          const expiresAt = Date.parse(response.expiresAt);

          if (
            !response.user?.id ||
            !response.accessToken ||
            !response.refreshToken ||
            !Number.isFinite(expiresAt) ||
            expiresAt <= Date.now()
          ) {
            throw new Error('La respuesta de autenticación no es válida.');
          }

          const session: UserSession = {
            user: {
              userId: response.user.id,
              name: response.user.name,
              email: response.user.email,
              role: response.user.role
            },
            token: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt
          };

          sessionStorage.setItem(
            this.sessionKey,
            JSON.stringify(session)
          );

          this.scheduleExpiration(expiresAt);
        })
      );
  }

  logout(): void {
    const session = this.readSession();

    this.clearSession();

    if (session?.refreshToken) {
      this.http.post(`${this.apiUrl}/logout`, {
        refreshToken: session.refreshToken
      }).subscribe({
        error: () => {
          console.warn(
            'La sesión local se cerró, pero no se pudo revocar en el servidor.'
          );
        }
      });
    }
  }

  isAuthenticated(): boolean {
    return this.getValidSession() !== null;
  }

  getCurrentUser(): AuthenticatedUser | null {
    return this.getValidSession()?.user ?? null;
  }

  getToken(): string | null {
    return this.getValidSession()?.token ?? null;
  }

  private readSession(): UserSession | null {
    const stored = sessionStorage.getItem(this.sessionKey);

    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as UserSession;
    } catch {
      this.clearSession();
      return null;
    }
  }

  private getValidSession(): UserSession | null {
    const session = this.readSession();

    if (!session) {
      return null;
    }

    if (
      !session.user?.userId ||
      !session.token ||
      !session.refreshToken ||
      !Number.isFinite(session.expiresAt) ||
      Date.now() >= session.expiresAt
    ) {
      this.clearSession();
      return null;
    }

    return session;
  }

  private clearSession(): void {
    sessionStorage.removeItem(this.sessionKey);

    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
    }
  }

  private scheduleExpiration(expiresAt: number): void {
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
    }

    this.expirationTimer = setTimeout(() => {
      this.logout();
      void this.router.navigate(['/login']);
    }, Math.max(0, expiresAt - Date.now()));
  }
}