import { Component, DestroyRef, ElementRef, Injector, OnInit, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TimeoutError, finalize, forkJoin } from 'rxjs';
import { Auth } from '../../core/services/auth';
import { Rol, Usuario, UsuariosService } from '../../core/services/usuarios';
import { RolesCatalog } from './roles-catalog';

@Component({ selector: 'app-usuarios', imports: [FormsModule, RolesCatalog], templateUrl: './usuarios.html', styleUrl: './usuarios.scss' })
export class Usuarios implements OnInit {
  private readonly service = inject(UsuariosService);
  private readonly auth = inject(Auth);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  @ViewChild('confirmation', { static: true }) confirmation!: ElementRef<HTMLDialogElement>;
  @ViewChild('formHeading') formHeading?: ElementRef<HTMLHeadingElement>;
  @ViewChild('roleConfirmation', { static: true }) roleConfirmation!: ElementRef<HTMLDialogElement>;
  readonly roleChangePending = signal(false);
  readonly usuarios = signal<Usuario[]>([]);
  readonly roles = signal<Rol[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly changingStatus = signal(false);
  readonly loadError = signal('');
  readonly formError = signal('');
  readonly statusError = signal('');
  readonly message = signal('');
  readonly showForm = signal(false);
  readonly confirmationTarget = signal<Usuario | null>(null);
  editingId: string | null = null;
  form = this.empty();
  search = '';
  roleFilter = '';
  statusFilter = '';

  get canManage() { return this.auth.getCurrentUser()?.role === 'Administrador'; }
  get currentUserId() { return this.auth.getCurrentUser()?.userId; }
  get activeCount() { return this.usuarios().filter(u => u.isActive).length; }
  get filtered() {
    const query = this.normalize(this.search.trim());
    return this.usuarios().filter(u => (!query || this.normalize(`${u.name} ${u.email} ${u.role}`).includes(query))
      && (!this.roleFilter || u.roleId === this.roleFilter)
      && (!this.statusFilter || u.isActive === (this.statusFilter === 'active')));
  }
  ngOnInit() { this.load(); }
  load() {
    if (this.loading() || this.saving() || this.changingStatus()) return;
    if (!this.canManage) { this.loadError.set('No tienes permiso para administrar usuarios.'); return; }
    this.loading.set(true); this.loadError.set('');
    forkJoin({ users: this.service.getAll(), roles: this.service.getRoles() })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false)))
      .subscribe({ next: data => { this.usuarios.set(data.users); this.roles.set(data.roles); },
        error: error => this.loadError.set(this.errorMessage(error)) });
  }
  newUser() {
    if (!this.canManage || this.loading() || this.saving() || this.changingStatus() || this.loadError()) return;
    this.editingId = null; this.form = this.empty(); this.openForm();
  }
  edit(user: Usuario) {
    if (!this.canManage || this.loading() || this.saving() || this.changingStatus()) return;
    this.editingId = user.id; this.form = { name: user.name, email: user.email, roleId: user.roleId, password: '' }; this.openForm();
  }
  private openForm() {
    this.formError.set(''); this.message.set(''); this.showForm.set(true);
    afterNextRender(() => this.formHeading?.nativeElement.focus(), { injector: this.injector });
  }
  cancelForm() {
    if (this.saving()) return;
    this.form = this.empty(); this.editingId = null; this.formError.set(''); this.showForm.set(false);
  }
  save(ngForm?: NgForm, confirmedRole = false) {
    if (!this.canManage || this.saving() || this.loading() || this.changingStatus() || !this.showForm()) return;
    const name = this.form.name.trim(), email = this.form.email.trim().toLowerCase();
    const minimumName = this.editingId ? 2 : 1;
    if (ngForm?.invalid || name.length < minimumName || name.length > 100 || email.length > 150 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !this.roles().some(r => r.id === this.form.roleId) ||
        (!this.editingId && (this.form.password.length < 8 || this.form.password.length > 100))) {
      ngForm?.control.markAllAsTouched(); this.formError.set('Revisa nombre, correo, rol y contrase\u00f1a.'); return;
    }
    const original = this.usuarios().find(u => u.id === this.editingId);
    if (original && original.roleId !== this.form.roleId && !confirmedRole) {
      this.roleChangePending.set(true); this.roleConfirmation.nativeElement.showModal(); return;
    }
    if (confirmedRole && !this.roleChangePending()) return;
    this.cancelRoleConfirmation();
    this.saving.set(true); this.formError.set(''); this.message.set('');
    const editing = this.editingId;
    const request = editing ? this.service.update(editing, { name, email, roleId: this.form.roleId })
      : this.service.create({ name, email, roleId: this.form.roleId, password: this.form.password });
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({
      next: user => {
        this.upsert(user); this.form = this.empty(); this.editingId = null; this.showForm.set(false);
        this.message.set(editing ? 'Usuario actualizado en el servidor.' : 'Usuario creado en el servidor.');
      }, error: error => this.formError.set(this.errorMessage(error)),
    });
  }
  requestStatus(user: Usuario) {
    if (!this.canManage || this.loading() || this.saving() || this.changingStatus() || user.id === this.currentUserId) return;
    this.confirmationTarget.set(user); this.statusError.set('');
    this.confirmation.nativeElement.showModal();
  }
  cancelConfirmation(event?: Event) {
    if (this.changingStatus()) { event?.preventDefault(); return; }
    this.confirmation.nativeElement.close(); this.confirmationTarget.set(null); this.statusError.set('');
  }
  confirmStatus() {
    const user = this.confirmationTarget();
    if (!user || !this.canManage || this.changingStatus() || user.id === this.currentUserId) return;
    this.changingStatus.set(true); this.statusError.set(''); this.message.set('');
    this.service.changeStatus(user.id, !user.isActive).pipe(takeUntilDestroyed(this.destroyRef),
      finalize(() => this.changingStatus.set(false))).subscribe({
      next: result => {
        this.upsert(result); this.confirmation.nativeElement.close(); this.confirmationTarget.set(null);
        this.message.set(result.isActive ? 'Usuario activado en el servidor.' : 'Usuario desactivado en el servidor.');
      }, error: error => this.statusError.set(this.errorMessage(error)),
    });
  }
  clearFilters() { this.search = ''; this.roleFilter = ''; this.statusFilter = ''; }
  cancelRoleConfirmation() { this.roleConfirmation.nativeElement.close(); this.roleChangePending.set(false); }
  private empty() { return { name: '', email: '', password: '', roleId: '' }; }
  private upsert(user: Usuario) {
    this.usuarios.update(users => [...users.filter(u => u.id !== user.id), user].sort((a, b) => a.name.localeCompare(b.name)));
  }
  private normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  private errorMessage(error: unknown) {
    if (error instanceof TimeoutError) return 'El servidor tard\u00f3 demasiado. Actualiza el listado antes de repetir la operaci\u00f3n.';
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 0: return 'No hay conexi\u00f3n con el servidor. Conservamos tus datos para reintentar.';
        case 400: return 'Datos no v\u00e1lidos. Revisa el nombre, correo, rol y la contrase\u00f1a de 8 a 100 caracteres al crear.';
        case 401: return 'Tu sesi\u00f3n expir\u00f3. Vuelve a iniciar sesi\u00f3n.';
        case 403: return 'No tienes permiso para administrar usuarios. Se requiere Administrador.';
        case 404: return 'El usuario o el rol ya no existe. Actualiza el listado.';
        case 409: return error.error?.code === 'LAST_ACTIVE_ADMIN' ? 'Debe conservarse al menos un administrador activo. No se guardó el cambio.' : 'Ya existe un usuario registrado con ese correo. Revisa el correo ingresado.';
        case 429: return 'Demasiadas solicitudes. Espera un momento antes de reintentar.';
      }
    }
    return 'No se pudo completar la operaci\u00f3n. Comprueba el servicio y vuelve a intentar.';
  }
}
