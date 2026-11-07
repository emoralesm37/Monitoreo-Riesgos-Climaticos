import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {provideHttpClientTesting,HttpTestingController} from '@angular/common/http/testing';
import {provideRouter,Router} from '@angular/router';
import {vi} from 'vitest';
import {OAuthCallback} from './oauth-callback';
import {environment} from '../../../environments/environment';

describe('OAuth callback (isolated HTTP)',()=>{
  let http:HttpTestingController;
  beforeEach(()=>{sessionStorage.clear();TestBed.configureTestingModule({imports:[OAuthCallback],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([])]});http=TestBed.inject(HttpTestingController);});
  afterEach(()=>{http.verify();TestBed.resetTestingModule();window.history.replaceState(null,'','/');sessionStorage.clear();});
  it('clears fragment before exchanging one-time code with browser cookie',async()=>{
    const state='a'.repeat(64),code='b'.repeat(64);window.history.replaceState(null,'',`/oauth/callback#code=${code}&state=${state}`);
    const navigate=vi.spyOn(TestBed.inject(Router),'navigateByUrl').mockResolvedValue(true);
    const f=TestBed.createComponent(OAuthCallback);f.detectChanges();expect(window.location.hash).toBe('');
    const request=http.expectOne(`${environment.apiUrl}/auth/oauth/exchange`);expect(request.request.withCredentials).toBe(true);expect(request.request.body).toEqual({code,state});
    request.flush({user:{id:'unit',name:'Unit',email:'unit@example.test',role:'Viewer'},accessToken:'unit-access',refreshToken:'unit-refresh',tokenType:'Bearer',expiresAt:new Date(Date.now()+3600000).toISOString()});
    await f.whenStable();expect(navigate).toHaveBeenCalledWith('/dashboard');
  });
  it('shows cancellation without any exchange request',()=>{
    window.history.replaceState(null,'','/oauth/callback#error=cancelled');const f=TestBed.createComponent(OAuthCallback);f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Cancelaste');expect(f.componentInstance.busy()).toBe(false);http.expectNone(`${environment.apiUrl}/auth/oauth/exchange`);
  });
  it('does not accept tokens in a URL',()=>{
    window.history.replaceState(null,'','/oauth/callback#accessToken=never-accepted');const f=TestBed.createComponent(OAuthCallback);f.detectChanges();
    expect(f.componentInstance.busy()).toBe(false);expect(sessionStorage.getItem('climateguard_user')).toBeNull();http.expectNone(`${environment.apiUrl}/auth/oauth/exchange`);
  });
  it('handles expired or already used exchanges recoverably',()=>{
    window.history.replaceState(null,'','/oauth/callback#code='+'a'.repeat(64)+'&state='+'b'.repeat(64));const f=TestBed.createComponent(OAuthCallback);f.detectChanges();
    http.expectOne(`${environment.apiUrl}/auth/oauth/exchange`).flush({}, {status:401,statusText:'Unauthorized'});
    expect(f.componentInstance.busy()).toBe(false);expect(f.componentInstance.message()).toContain('ya fue utilizado');
  });
});
