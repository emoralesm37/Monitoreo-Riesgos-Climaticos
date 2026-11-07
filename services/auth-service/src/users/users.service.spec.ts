import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';

describe('UsersService privilege invariants (isolated)', () => {
  function setup(twoAdmins = false) {
    const adminRole = { id: 'admin-role', name: 'Administrador' }, opRole = { id: 'op-role', name: 'Operador' };
    const now = new Date();
    const admin = { id: 'admin', name: 'Unit', email: 'unit@example.test', roleId: adminRole.id, role: adminRole, isActive: true, createdAt: now, updatedAt: now };
    const other = { ...admin, id: 'other', email: 'other@example.test' };
    const data = twoAdmins ? [admin, other] : [admin];
    const calls: string[] = [];
    const users = {
      findOne: async ({where}: {where: {id?: string; email?: string}}) => { calls.push('find'); return data.find(u => where.id ? u.id === where.id : u.email === where.email); },
      count: async () => data.filter(u => u.isActive && u.role.name === 'Administrador').length,
      save: async (user: unknown) => { calls.push('save'); return user; },
    };
    const roles = { findOne: async ({where}: {where:{id:string}}) => [adminRole,opRole].find(r => r.id === where.id) };
    const manager = {
      query: async (sql: string) => { expect(sql).toContain('pg_advisory_xact_lock'); calls.push('lock'); },
      getRepository: (entity: unknown) => entity === User ? users : roles,
      update: async () => { calls.push('revoke'); },
      transaction: async (work: (value: unknown) => unknown) => work(manager),
    };
    return { service: new UsersService({...users,manager} as unknown as Repository<User>, roles as unknown as Repository<Role>), admin, other, calls };
  }
  it('rejects deactivation of the last active administrator before saving or revoking sessions', async () => {
    const {service,calls,admin} = setup();
    await expect(service.changeStatus('admin',{isActive:false},'admin')).rejects.toMatchObject({status:409,response:{code:'LAST_ACTIVE_ADMIN'}});
    expect(admin.isActive).toBe(true); expect(calls[0]).toBe('lock'); expect(calls).not.toContain('save'); expect(calls).not.toContain('revoke');
  });
  it('rejects demotion of the last administrator without partially editing the name', async () => {
    const {service,admin} = setup();
    await expect(service.update('admin',{name:'Changed',roleId:'op-role'},'admin')).rejects.toMatchObject({status:409});
    expect(admin.name).toBe('Unit'); expect(admin.role.name).toBe('Administrador');
  });
  it('permits demotion when another active administrator remains and revokes previous refresh sessions', async () => {
    const {service,calls} = setup(true);
    const result = await service.update('other',{roleId:'op-role'},'admin');
    expect(result.role).toBe('Operador'); expect(calls).toContain('revoke'); expect(calls).toContain('save');
    await expect(service.update('other',{roleId:'admin-role'},'other')).rejects.toMatchObject({status:403});
  });
  it('rechecks that the actor remains active inside the transaction', async () => {
    const {service,admin,calls} = setup(true); admin.isActive=false;
    await expect(service.changeStatus('other',{isActive:false},'admin')).rejects.toMatchObject({status:403});
    expect(calls[0]).toBe('lock'); expect(calls).not.toContain('save');
  });
});
