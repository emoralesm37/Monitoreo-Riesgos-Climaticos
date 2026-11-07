// Explicit integration test against a NEW, retained schema in LOCAL PostgreSQL.
// Does not use or mutate any existing users. No credentials or hashes in output.
require('reflect-metadata');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DataSource } = require('typeorm');
const { Client } = require('pg');
const bcrypt = require('bcrypt');
const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '../.env')));
const { User } = require('../dist/users/entities/user.entity');
const { Role } = require('../dist/roles/entities/role.entity');
const { RefreshToken } = require('../dist/auth/entities/refresh-token.entity');
const { UsersService } = require('../dist/users/users.service');
const assert = require('assert/strict');
(async () => {
  if (!['localhost','127.0.0.1','::1'].includes(env.DB_HOST) || env.DB_PORT !== '5432' || env.DB_SSL === 'true') throw Error('Only local PostgreSQL allowed');
  const options = { host:env.DB_HOST, port:+env.DB_PORT, database:env.DB_NAME, user:env.DB_USER, password:env.DB_PASSWORD, ssl:false };
  const pg = new Client(options); await pg.connect();
  const snapshot = async () => JSON.stringify((await pg.query('SELECT * FROM public.users ORDER BY id')).rows);
  const before = await snapshot();
  const schema = 'cg_admin_guard_' + crypto.randomBytes(8).toString('hex');
  await pg.query(`CREATE SCHEMA "${schema}"`);
  const ds = new DataSource({ type:'postgres', ...options, username:env.DB_USER, schema,
    entities:[User,Role,RefreshToken], synchronize:false, migrationsRun:false, logging:false });
  try {
    await ds.initialize();
    assert(ds.entityMetadatas.every(m => m.schema === schema));
    await ds.synchronize(); // Only the brand-new schema checked above.
    const roles = ds.getRepository(Role), users = ds.getRepository(User);
    const adminRole = await roles.save(roles.create({name:'Administrador',description:'Isolated local test'}));
    const operatorRole = await roles.save(roles.create({name:'Operador',description:'Isolated local test'}));
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'),12);
    const a = await users.save(users.create({name:'LOCAL ISOLATED A',email:'a@isolated.test',roleId:adminRole.id,role:adminRole,isActive:true,passwordHash}));
    const b = await users.save(users.create({name:'LOCAL ISOLATED B',email:'b@isolated.test',roleId:operatorRole.id,role:operatorRole,isActive:true,passwordHash}));
    const service = new UsersService(users,roles);
    await assert.rejects(service.changeStatus(a.id,{isActive:false},a.id),e=>e.getStatus()===409&&e.getResponse().code==='LAST_ACTIVE_ADMIN');
    await assert.rejects(service.update(a.id,{roleId:operatorRole.id},a.id),e=>e.getStatus()===409);
    console.log('Actual PostgreSQL: last administrator deactivation and demotion rejected with 409');
    await service.update(b.id,{roleId:adminRole.id},a.id);
    let outcomes = await Promise.allSettled([service.changeStatus(a.id,{isActive:false},a.id),service.changeStatus(b.id,{isActive:false},b.id)]);
    assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
    assert.equal(await users.count({where:{isActive:true,role:{name:'Administrador'}}}),1);
    const remaining = await users.findOneOrFail({where:{isActive:true,roleId:adminRole.id}});
    const inactive = await users.findOneOrFail({where:{isActive:false}});
    await service.changeStatus(inactive.id,{isActive:true},remaining.id);
    outcomes = await Promise.allSettled([service.update(a.id,{roleId:operatorRole.id},a.id),service.update(b.id,{roleId:operatorRole.id},b.id)]);
    assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);
    assert.equal(await users.count({where:{isActive:true,role:{name:'Administrador'}}}),1);
    const departed = await users.findOneOrFail({where:{roleId:operatorRole.id}});
    await assert.rejects(service.update(departed.id,{roleId:adminRole.id},departed.id),e=>e.getStatus()===403);
    assert.equal(await snapshot(),before);
    console.log('Concurrent status and role changes: exactly one succeeds; one administrator remains');
    console.log('Operator self-promotion rejected 403; all existing public.users unchanged');
    console.log('Retained isolated test schema: '+schema);
  } finally { if(ds.isInitialized) await ds.destroy(); await pg.end(); }
})().catch(e=>{console.error(e.message);process.exitCode=1});
