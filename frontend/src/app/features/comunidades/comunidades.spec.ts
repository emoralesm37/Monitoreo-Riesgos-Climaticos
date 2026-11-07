import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { Comunidades } from './comunidades';
import { Auth } from '../../core/services/auth';
import { environment } from '../../../environments/environment';
const community={communityId:123,name:'Unit community',municipality:'Unit',department:'Unit',country:'Guatemala',latitude:null,longitude:null,description:null,isActive:true,sensorCount:0};
describe('Comunidades location editing',()=>{
  let http:HttpTestingController;
  function setup(role='Administrador'){
    TestBed.configureTestingModule({imports:[Comunidades],providers:[provideHttpClient(),provideHttpClientTesting(),{provide:Auth,useValue:{getCurrentUser:()=>({role})}}]});
    const f=TestBed.createComponent(Comunidades);f.detectChanges();http=TestBed.inject(HttpTestingController);
    http.expectOne(`${environment.apiUrl}/communities`).flush([community]);f.detectChanges();
    for(const modal of f.nativeElement.querySelectorAll('dialog')){modal.showModal=vi.fn();modal.close=vi.fn();}
    const dialog=f.nativeElement.querySelector('dialog');
    return {f,c:f.componentInstance,dialog};
  }
  afterEach(()=>http.verify());
  it('shows existing server communities without assigning coordinates',()=>{
    const {c}=setup();expect(c.comunidades[0].latitude).toBeNull();expect(c.comunidades[0].longitude).toBeNull();
  });
  it('validates coordinate pairs and ranges before sending a request',()=>{
    const {c}=setup();c.editar(community);c.latitude=15;c.guardar();expect(c.error).toContain('juntas');
    c.longitude=-90;c.latitude=91;c.guardar();expect(c.error).toContain('-90 y 90');
    http.expectNone(r=>r.method==='PUT');
  });
  it('requires confirmation, preserves fields on failure and saves only through Gateway',()=>{
    const {c,dialog}=setup();c.editar(community);c.latitude=15;c.longitude=-90;c.guardar();
    expect(dialog.showModal).toHaveBeenCalledOnce();http.expectNone(r=>r.method==='PUT');
    c.cancelarUbicacion();expect(c.latitude).toBe(15);http.expectNone(r=>r.method==='PUT');
    c.guardar();c.guardar(true);
    const req=http.expectOne(`${environment.apiUrl}/communities/123`);expect(req.request.method).toBe('PUT');expect(req.request.body.latitude).toBe(15);
    req.flush({}, {status:503,statusText:'Unavailable'});expect(c.guardando).toBe(false);expect(c.latitude).toBe(15);expect(c.error).toBeTruthy();
    c.guardar();c.guardar(true);http.expectOne(`${environment.apiUrl}/communities/123`).flush(null);
    http.expectOne(`${environment.apiUrl}/communities`).flush([{...community,latitude:15,longitude:-90}]);
    expect(c.comunidades[0].longitude).toBe(-90);expect(c.editandoId).toBeNull();
  });
  it('does not let an Operator save a location',()=>{
    const {c}=setup('Operador');c.name='Unit';c.latitude=15;c.longitude=-90;c.guardar();
    expect(c.error).toContain('permisos');http.expectNone(r=>r.method==='PUT'||r.method==='POST');
  });
  it('searches and filters actual loaded records without extra API requests',()=>{
    const {c}=setup();c.search='UNIT';expect(c.filtered.length).toBe(1);
    c.statusFilter='inactive';expect(c.filtered).toEqual([]);c.clearFilters();expect(c.filtered.length).toBe(1);
    http.expectNone(r=>r.method==='GET');
  });
  it('confirms status, does not optimistically change state, unlocks after failure and retries',()=>{
    const {c}=setup();c.requestStatus(community);http.expectNone(r=>r.method==='PATCH');c.cancelStatus();
    expect(c.statusTarget).toBeNull();c.requestStatus(community);c.confirmStatus();c.confirmStatus();
    const request=http.expectOne(`${environment.apiUrl}/communities/123/status`);expect(request.request.method).toBe('PATCH');expect(request.request.body).toEqual({isActive:false});
    request.flush({}, {status:503,statusText:'Unavailable'});expect(c.changingStatus).toBe(false);expect(c.comunidades[0].isActive).toBe(true);expect(c.statusError).toBeTruthy();
    c.confirmStatus();http.expectOne(`${environment.apiUrl}/communities/123/status`).flush(null);
    http.expectOne(`${environment.apiUrl}/communities`).flush([{...community,isActive:false}]);expect(c.comunidades[0].isActive).toBe(false);expect(c.statusTarget).toBeNull();
  });
});
