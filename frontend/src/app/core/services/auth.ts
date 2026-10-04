import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
}

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private readonly apiUrl = 'http://localhost:7000/api/auth';
  private readonly sessionKey = 'climateguard_user';

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, credentials)
      .pipe(
        tap(user => {
          sessionStorage.setItem(
            this.sessionKey,
            JSON.stringify(user)
          );
        })
      );
  }

  isAuthenticated(): boolean {
    return sessionStorage.getItem(this.sessionKey) !== null;
  }

  getCurrentUser(): LoginResponse | null {
    const storedUser = sessionStorage.getItem(this.sessionKey);

    if (!storedUser) {
      return null;
    }

    try {
      return JSON.parse(storedUser) as LoginResponse;
    } catch {
      sessionStorage.removeItem(this.sessionKey);
      return null;
    }
  }
}