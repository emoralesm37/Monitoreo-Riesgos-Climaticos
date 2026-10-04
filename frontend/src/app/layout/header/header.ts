import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, LoginResponse } from '../../core/services/auth';

@Component({
  imports: [],
  selector: 'app-header',
  styleUrl: './header.scss',
  templateUrl: './header.html',
})
export class Header {
  currentUser: LoginResponse | null;

  constructor(
    private auth: Auth,
    private router: Router
  ) {
    this.currentUser = this.auth.getCurrentUser();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}