import { Component, Input } from '@angular/core';
import { Rol, Usuario } from '../../core/services/usuarios';

@Component({selector:'app-roles-catalog', standalone:true, template:`
  <section aria-labelledby="role-catalog-title"><header><h2 id="role-catalog-title">Roles y permisos administrativos</h2><p>Roles del sistema, de solo lectura. Asigna un rol desde la edición de usuarios.</p></header>
    <div class="roles-grid">@for (role of roles; track role.id) {
      <article [attr.data-role-id]="role.id"><h3>{{role.name}}</h3><p>{{role.description || 'Descripción no registrada'}}</p><small>{{usage(role.id)}} usuarios asignados</small>
        @if (role.permissions === undefined) { <p>Detalle de permisos no disponible en esta versión del servidor.</p> }
        @else if (!role.permissions.length) { <p>Sin operaciones administrativas de Auth autorizadas.</p> }
        @else { <ul>@for (permission of role.permissions; track permission.method + permission.path) { <li>{{permission.label || 'Operación administrativa de Auth'}}</li> }</ul> }
        <details><summary>Detalles técnicos</summary><small>UUID {{role.id}}</small><ul>@for (permission of role.permissions || []; track permission.method + permission.path) { <li><code>{{permission.method}} {{permission.path}}</code></li> }</ul></details>
      </article>
    }</div><p>Este catálogo muestra la gestión de usuarios y roles. Las demás funciones conservan sus permisos específicos, verificados por cada servicio.</p>
  </section>`,styles:`
  section{margin:24px 0;padding:24px;background:white;border:1px solid #d6e5ee;border-radius:16px;color:#163e55}h2{font-size:19px;margin:0 0 10px}h3{font-size:16px;margin:0 0 10px}p,small{font-size:12px;line-height:1.6;color:#56768b}.roles-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin:20px 0}article{padding:18px;border:1px solid #d9eaf2;border-radius:12px;background:#f6fbff;overflow-wrap:anywhere}ul{list-style:none;padding:0;font-size:11px;line-height:1.8}code{white-space:normal}@media(max-width:650px){.roles-grid{grid-template-columns:1fr}section{padding:18px}}
  `})
export class RolesCatalog {
  @Input() roles: Rol[] = [];
  @Input() users: Usuario[] = [];
  usage(roleId: string) { return this.users.filter(u => u.roleId === roleId).length; }
}
