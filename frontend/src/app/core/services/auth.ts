import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  userId: number;
  name: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
}

export interface AuthenticatedUser {
  userId: number;
  name: string;
  email: string;
  role: string;
}

interface UserSession {
  user: AuthenticatedUser;
  token: string;
  expiresAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private readonly apiUrl = '/api/auth';
  private readonly sessionKey = 'climateguard_user';

  private expirationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.restoreExpirationTimer();
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(response => {
          const expiresAt = new Date(response.expiresAt).getTime();

          const session: UserSession = {
            user: {
              userId: response.userId,
              name: response.name,
              email: response.email,
              role: response.role
            },
            token: response.token,
            expiresAt
          };

          sessionStorage.setItem(
            this.sessionKey,
            JSON.stringify(session)
          );

          this.scheduleExpiration(session.expiresAt);
        })
      );
  }

  logout(): void {
    sessionStorage.removeItem(this.sessionKey);

    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = null;
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

  private getValidSession(): UserSession | null {
    const storedSession =
      sessionStorage.getItem(this.sessionKey);

    if (!storedSession) {
      return null;
    }

    try {
      const session =
        JSON.parse(storedSession) as UserSession;

      if (
        !session.user ||
        !session.token ||
        !session.expiresAt ||
        Date.now() >= session.expiresAt
      ) {
        this.logout();
        return null;
      }

      return session;
    } catch {
      this.logout();
      return null;
    }
  }

  private scheduleExpiration(expiresAt: number): void {
    if (this.expirationTimer) {
      clearTimeout(this.expirationTimer);
    }

    const remainingTime = expiresAt - Date.now();

    if (remainingTime <= 0) {
      this.expireSession();
      return;
    }

    this.expirationTimer = setTimeout(() => {
      this.expireSession();
    }, remainingTime);
  }

  private restoreExpirationTimer(): void {
    const session = this.getValidSession();

    if (session) {
      this.scheduleExpiration(session.expiresAt);
    }
  }

  private expireSession(): void {
    this.logout();
    this.router.navigate(['/login']);
  }
}