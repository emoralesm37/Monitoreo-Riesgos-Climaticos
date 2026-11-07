import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { Usuarios } from './usuarios';
import { Auth } from '../../core/services/auth';
import { Usuario } from '../../core/services/usuarios';
import { environment } from '../../../environments/environment';

const adminId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const roleId = '33333333-3333-4333-8333-333333333333';
const adminRoleId = '44444444-4444-4444-8444-444444444444';
const user: Usuario = { id: userId, name: 'PRUEBA LOCAL', email: 'unit@example.test', roleId, role: 'Operador',
  isActive: true, createdAt: '2026-11-06T00:00:00Z', updatedAt: '2026-11-06T00:00:00Z' };
const admin: Usuario = { ...user, id: adminId, name: 'Admin', email: 'admin@example.test', roleId: adminRoleId, role: 'Administrador' };

describe('Usuarios real HTTP contract (isolated)', () => {
  let http: HttpTestingController; let role: string;
  const api = environment.apiUrl;
  beforeEach(() => {
    role = 'Administrador';
    TestBed.configureTestingModule({ imports: [Usuarios], providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: Auth, useValue: { getCurrentUser: () => ({ userId: adminId, role }) } }] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function start(users = [admin, user]) {
    const f = TestBed.createComponent(Usuarios); f.detectChanges();
    const usersReq = http.expectOne(`${api}/users`);
    const rolesReq = http.expectOne(`${api}/roles`);
    usersReq.flush(users); rolesReq.flush([{ id: roleId, name: 'Operador', description: null }, { id: adminRoleId, name: 'Administrador', description: null }]);
    f.detectChanges();
    for (const modal of f.nativeElement.querySelectorAll('dialog')) { modal.showModal = vi.fn(); modal.close = vi.fn(); }
    const dialog = f.nativeElement.querySelector('#user-status-dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn(); dialog.close = vi.fn();
    return f;
  }
  function fill(f: ReturnType<typeof start>) {
    f.componentInstance.newUser();
    f.componentInstance.form = { name: ' PRUEBA LOCAL ', email: ' UNIT@example.test ', roleId, password: 'unit-password' };
  }
  it('loads server UUIDs and filters by name, role and state', () => {
    const f = start(); expect(f.componentInstance.activeCount).toBe(2);
    f.componentInstance.search = 'prueba'; expect(f.componentInstance.filtered.map(u => u.id)).toEqual([userId]);
    f.componentInstance.search = ''; f.componentInstance.roleFilter = adminRoleId;
    expect(f.componentInstance.filtered[0].id).toBe(adminId);
    f.componentInstance.statusFilter = 'inactive'; expect(f.componentInstance.filtered).toEqual([]);
  });
  it('creates once with real request fields and inserts only the server response', () => {
    const f = start([admin]); fill(f);
    f.componentInstance.save(); f.componentInstance.save();
    const r = http.expectOne(`${api}/users`);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual({ name: 'PRUEBA LOCAL', email: 'unit@example.test', roleId, password: 'unit-password' });
    r.flush(user, { status: 201, statusText: 'Created' });
    expect(f.componentInstance.usuarios().length).toBe(2); expect(f.componentInstance.showForm()).toBe(false);
    expect(f.componentInstance.saving()).toBe(false);
  });
  it('edits with PATCH/UUID and never sends a password on update', () => {
    const f = start(); f.componentInstance.edit(user); f.componentInstance.form.name = 'Updated';
    f.componentInstance.form.password = 'must-not-be-sent'; f.componentInstance.save();
    const r = http.expectOne(`${api}/users/${userId}`);
    expect(r.request.method).toBe('PATCH'); expect(r.request.body.password).toBeUndefined();
    r.flush({ ...user, name: 'Updated' });
    expect(f.componentInstance.usuarios().find(u => u.id === userId)?.name).toBe('Updated');
  });
  it.each([400, 401, 403, 404, 409, 503])('keeps inputs and unlocks on HTTP %s', status => {
    const f = start(); fill(f); f.componentInstance.save();
    http.expectOne(`${api}/users`).flush({}, { status, statusText: 'Error' });
    expect(f.componentInstance.formError()).not.toBe(''); expect(f.componentInstance.showForm()).toBe(true);
    expect(f.componentInstance.form.password).toBe('unit-password'); expect(f.componentInstance.saving()).toBe(false);
  });
  it('keeps the form on network failure', () => {
    const f = start(); fill(f); f.componentInstance.save();
    http.expectOne(`${api}/users`).error(new ProgressEvent('error'));
    expect(f.componentInstance.formError()).toContain('No hay conexi'); expect(f.componentInstance.saving()).toBe(false);
  });
  it('does not submit invalid names, passwords or unknown roles', () => {
    const f = start(); fill(f); f.componentInstance.form.roleId = 'unknown'; f.componentInstance.save();
    http.expectNone(`${api}/users`); expect(f.componentInstance.formError()).not.toBe('');
  });
  it('requires confirmation, preserves state on failure, then uses the returned status', () => {
    const f = start(); f.componentInstance.requestStatus(user); http.expectNone(`${api}/users/${userId}/status`);
    f.componentInstance.cancelConfirmation(); expect(f.componentInstance.confirmationTarget()).toBeNull();
    f.componentInstance.requestStatus(user); f.componentInstance.confirmStatus(); f.componentInstance.confirmStatus();
    http.expectOne(`${api}/users/${userId}/status`).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(f.componentInstance.usuarios().find(u => u.id === userId)?.isActive).toBe(true);
    expect(f.componentInstance.confirmationTarget()?.id).toBe(userId);
    f.componentInstance.confirmStatus();
    const r = http.expectOne(`${api}/users/${userId}/status`); expect(r.request.body).toEqual({ isActive: false });
    r.flush({ ...user, isActive: false });
    expect(f.componentInstance.usuarios().find(u => u.id === userId)?.isActive).toBe(false);
  });
  it('prevents self deactivation and non-admin mutations', () => {
    const f = start(); f.componentInstance.requestStatus(admin); expect(f.componentInstance.confirmationTarget()).toBeNull();
    role = 'Operador'; fill(f); f.componentInstance.edit(user); f.componentInstance.requestStatus(user); f.componentInstance.save();
    http.expectNone(r => r.method !== 'GET'); expect(f.componentInstance.showForm()).toBe(false);
  });
  it('distinguishes failed loading from an empty server response', () => {
    const f = TestBed.createComponent(Usuarios); f.detectChanges();
    http.expectOne(`${api}/users`).flush({}, { status: 503, statusText: 'Unavailable' });
    http.expectOne(`${api}/roles`); f.detectChanges();
    expect(f.componentInstance.loadError()).not.toBe(''); expect(f.componentInstance.loading()).toBe(false);
    expect(f.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('requires explicit confirmation of a role change and displays last-admin protection errors',()=>{
    const f=start();const c=f.componentInstance;c.edit(user);c.form.roleId=adminRoleId;c.save();
    http.expectNone(r=>r.method==='PATCH');expect(c.roleChangePending()).toBe(true);
    c.cancelRoleConfirmation();expect(c.form.roleId).toBe(adminRoleId);http.expectNone(r=>r.method==='PATCH');
    c.save();c.save(undefined,true);const request=http.expectOne(`${api}/users/${userId}`);
    expect(request.request.body.roleId).toBe(adminRoleId);request.flush({code:'LAST_ACTIVE_ADMIN'}, {status:409,statusText:'Conflict'});
    expect(c.formError()).toContain('administrador activo');expect(c.saving()).toBe(false);expect(c.usuarios().find(u=>u.id===userId)?.role).toBe('Operador');
  });
  it('shows only the Auth permission inventory received from the API',()=>{
    const f=start();f.componentInstance.roles.set([{id:adminRoleId,name:'Administrador',description:'Server description',permissions:[{method:'GET',path:'/api/users'}]},
      {id:roleId,name:'Operador',description:null,permissions:[]}]);f.detectChanges();
    const catalog=f.nativeElement.querySelector('app-roles-catalog');expect(catalog.textContent).toContain('GET /api/users');
    expect(catalog.textContent).toContain('Sin operaciones administrativas de Auth');
    expect(catalog.querySelectorAll('button').length).toBe(0);
  });
});
