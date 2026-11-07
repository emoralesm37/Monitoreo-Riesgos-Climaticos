import {Component,OnInit,DestroyRef,inject,signal} from '@angular/core';
import {Router,RouterLink} from '@angular/router';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
import {Auth} from '../../core/services/auth';

@Component({standalone:true,imports:[RouterLink],template:`
  <main class="callback"><section aria-live="polite" aria-atomic="true">
    <span>ClimateGuard</span><h1>{{busy()?'Verificando tu acceso':'No se pudo completar el acceso'}}</h1>
    <p [attr.role]="busy()?'status':'alert'">{{message()}}</p>
    @if(!busy()){<a routerLink="/login">Volver al inicio de sesion</a>}
  </section></main>`,styles:[`
  .callback{min-height:100dvh;display:grid;place-items:center;padding:1.5rem;background:linear-gradient(135deg,#08283e,#0b5268);color:#17364a}
  section{width:min(100%,480px);padding:2rem;border-radius:24px;background:#fff;box-shadow:0 18px 60px #001b3266}
  span{color:#007d9a;font-weight:700}h1{font-size:1.65rem}p{line-height:1.6}a{color:#006b91;font-weight:600}
  `]})
export class OAuthCallback implements OnInit {
  readonly busy=signal(true);readonly message=signal('Confirmando el retorno seguro del proveedor...');
  private destroy=inject(DestroyRef);
  constructor(private auth:Auth,private router:Router){}
  ngOnInit(){
    const params=new URLSearchParams(window.location.hash.slice(1));
    window.history.replaceState(null,'',window.location.pathname);
    const error=params.get('error'),code=params.get('code')||'',state=params.get('state')||'';
    if(error||!/^[a-f0-9]{64}$/.test(code)||!/^[a-f0-9]{64}$/.test(state)){
      this.fail(error==='cancelled'?'Cancelaste el acceso. Puedes intentarlo nuevamente.':error==='account_link_required'
        ?'Ya existe una cuenta con ese correo. Inicia sesion con tu cuenta local para solicitar una vinculacion segura.'
        :'El retorno no es valido, expiro o el proveedor no esta disponible. Inicia el acceso nuevamente.');return;
    }
    this.auth.exchangeOAuth(code,state).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next:()=>{void this.router.navigateByUrl('/dashboard').then(ok=>{if(!ok)this.fail('No se pudo abrir el Dashboard.');}).catch(()=>this.fail('No se pudo abrir el Dashboard.'));},
      error:()=>this.fail('No se pudo confirmar el acceso. El retorno puede haber expirado o ya fue utilizado. Intenta nuevamente.')
    });
  }
  private fail(message:string){this.message.set(message);this.busy.set(false);}
}
