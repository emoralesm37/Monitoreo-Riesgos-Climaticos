import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Component,signal,DestroyRef,inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {HttpErrorResponse} from '@angular/common/http';
import {finalize} from 'rxjs';
import {Auth} from '../../core/services/auth';

@Component({standalone:true,imports:[FormsModule],template:`
  <section class="account"><span>IDENTIDAD Y ACCESO</span><h1>Vincular un proveedor</h1>
    <p>Confirma tu contrasena local y continua con el proveedor. No se vinculan cuentas automaticamente por correo.</p>
    <p>Esta operacion conserva tu rol actual. Las cuentas exclusivamente externas requieren otro procedimiento de recuperacion.</p>
    <form (ngSubmit)="link()" [attr.aria-busy]="busy()">
      <label for="link-provider">Proveedor</label><select id="link-provider" name="provider" [(ngModel)]="provider" [disabled]="busy()"><option value="google">Google</option><option value="github">GitHub</option></select>
      <label for="link-password">Contrasena local actual</label><input id="link-password" name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="128" [(ngModel)]="password" [readOnly]="busy()" />
      <button [disabled]="busy() || password.length < 8">{{busy()?'Preparando acceso...':'Confirmar y continuar'}}</button>
    </form><p role="alert" aria-live="polite">{{error()}}</p>
  </section>`,styles:[`
    .account{max-width:680px;padding:2rem;margin:1rem auto;background:#fff;border:1px solid #d2e4ef;border-radius:22px;color:#12354f;box-shadow:0 8px 25px #16405a0d}
    span{font-size:.8rem;letter-spacing:.1em;color:#007c98}p{line-height:1.6}form{display:grid;gap:.75rem}input,select,button{font:inherit;padding:.8rem;border:1px solid #b8cfdf;border-radius:10px}button{background:#074c6c;color:#fff;cursor:pointer}button:disabled{opacity:.6}input:focus-visible,select:focus-visible,button:focus-visible{outline:3px solid #00bbd4;outline-offset:2px}[role=alert]{color:#a22439}
  `]})
export class LinkedAccounts {
  provider:'google'|'github'='google';password='';readonly busy=signal(false);readonly error=signal('');
  private readonly destroy=inject(DestroyRef);
  constructor(private auth:Auth){}
  link(){if(this.busy()||this.password.length<8)return;this.busy.set(true);this.error.set('');
    this.auth.linkOAuth(this.provider,this.password).pipe(takeUntilDestroyed(this.destroy),finalize(()=>this.busy.set(false))).subscribe({
      next:r=>{this.password='';try{const url=new URL(r.authorizationUrl);if(url.protocol!=='https:'||url.origin!==(this.provider==='google'?'https://accounts.google.com':'https://github.com'))throw new Error();window.location.assign(url.toString());}catch{this.error.set('La redireccion recibida no es valida.');}},
      error:e=>{this.password='';this.error.set(e instanceof HttpErrorResponse&&e.status===503?'Este proveedor no esta configurado.':e instanceof HttpErrorResponse&&e.status===401?'No se pudo confirmar tu identidad. Comprueba tu sesion y contrasena local.':'No se pudo preparar la vinculacion. Intenta nuevamente.');}
    });
  }
}
