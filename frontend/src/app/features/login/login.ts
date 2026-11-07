import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, TimeoutError } from 'rxjs';
import { Auth, SessionError } from '../../core/services/auth';

@Component({ selector: 'app-login', imports: [FormsModule], templateUrl: './login.html', styleUrl: './login.scss' })
export class Login {
  email = '';
  password = '';
  errorMessage = '';
  showPassword = false;
  readonly state = signal<'idle' | 'loading' | 'success' | 'error'>('idle');
  private readonly destroyRef = inject(DestroyRef);
  get isLoading() { return this.state() === 'loading'; }

  constructor(private auth: Auth, private router: Router, private route: ActivatedRoute) {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason) {
      this.errorMessage = reason === 'expired' ? 'Tu sesi\u00f3n expir\u00f3 o fue revocada. Inicia sesi\u00f3n nuevamente.'
        : 'No se pudo renovar la sesi\u00f3n. Comprueba la conexi\u00f3n e inicia sesi\u00f3n nuevamente.';
      this.state.set('error');
    }
  }

  oauth(provider: 'google' | 'github'): void {
    if(this.isLoading || this.state()==='success') return;
    this.errorMessage='';this.state.set('loading');
    this.auth.startOAuth(provider).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result=>{
        try {const url=new URL(result.authorizationUrl);
          if(url.protocol!=='https:' || url.origin!==(provider==='google'?'https://accounts.google.com':'https://github.com'))throw new Error();
          window.location.assign(url.toString());
        } catch {this.fail('El proveedor devolvio una redireccion no valida.');}
      },
      error: error=>this.fail(error instanceof HttpErrorResponse && error.status===503
        ? 'Este proveedor todavia no esta configurado. Puedes usar correo y contrasena.' : this.message(error))
    });
  }

  onSubmit(form?: NgForm): void {
    if (this.isLoading || this.state() === 'success') return;
    if (form?.invalid || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim()) || this.password.length < 8) {
      form?.control.markAllAsTouched();
      this.fail('Ingresa un correo v\u00e1lido y una contrase\u00f1a de al menos 8 caracteres.'); return;
    }
    this.errorMessage = '';
    this.state.set('loading');
    this.auth.login({ email: this.email.trim(), password: this.password }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { if (this.state() === 'loading') this.state.set('idle'); }),
    ).subscribe({
      next: () => {
        this.state.set('success');
        const candidate = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        const target = candidate.startsWith('/') && !candidate.startsWith('//') && !candidate.startsWith('/login')
          ? candidate : '/dashboard';
        void this.router.navigateByUrl(target).then(ok => {
          if (!ok) this.fail('Sesi\u00f3n iniciada, pero no se pudo abrir la p\u00e1gina. Intenta nuevamente.');
        }).catch(() => this.fail('No se pudo abrir la p\u00e1gina solicitada. Intenta nuevamente.'));
      },
      error: error => this.fail(this.message(error)),
    });
  }
  private fail(message: string) { this.errorMessage = message; this.state.set('error'); }
  private message(error: unknown): string {
    if (error instanceof TimeoutError) return 'El servidor tard\u00f3 demasiado en responder. Intenta nuevamente.';
    if (error instanceof SessionError) return error.message;
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 0: return 'No se pudo conectar con el servidor. Comprueba tu conexi\u00f3n y vuelve a intentar.';
        case 400: return 'Revisa el correo y la contrase\u00f1a ingresados.';
        case 401: return 'Correo o contrase\u00f1a incorrectos';
        case 403: return 'La cuenta est\u00e1 inactiva o no tiene permiso de acceso. Contacta al administrador.';
        case 429: return 'Demasiados intentos de inicio de sesi\u00f3n. Espera un minuto antes de reintentar.';
        case 500: return 'El servicio de autenticaci\u00f3n tuvo un error. Intenta nuevamente.';
        case 502: case 503: return 'El servicio de autenticaci\u00f3n no est\u00e1 disponible. Intenta nuevamente en unos momentos.';
        case 504: return 'El servidor tard\u00f3 demasiado en responder. Intenta nuevamente.';
      }
    }
    return 'No se pudo completar el inicio de sesi\u00f3n. Intenta nuevamente.';
  }
}
