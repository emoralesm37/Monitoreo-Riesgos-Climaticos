import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  email = '';
  password = '';
  errorMessage = '';
  isLoading = false;

  constructor(
    private auth: Auth,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  onSubmit(): void {
    if (!this.email.trim() || !this.password) {
      this.errorMessage = 'El correo y la contraseña son obligatorios.';
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;

    this.auth.login({
      email: this.email.trim(),
      password: this.password
    }).subscribe({
      next: () => {
        this.isLoading = false;

        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl') ??
          '/dashboard';

        this.router.navigateByUrl(returnUrl);
      },
      error: (error) => {
        this.isLoading = false;

        if (error.status === 401) {
          this.errorMessage = 'Correo o contraseña incorrectos.';
          return;
        }

        this.errorMessage =
          'No fue posible iniciar sesión. Intente nuevamente.';
      }
    });
  }
}