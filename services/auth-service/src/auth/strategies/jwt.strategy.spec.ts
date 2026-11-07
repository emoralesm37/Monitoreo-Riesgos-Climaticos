import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { JwtStrategy } from './jwt.strategy';
import { User } from '../../users/entities/user.entity';

describe('JwtStrategy current identity', () => {
  const id='11111111-1111-4111-8111-111111111111';
  function setup(role='Administrador',isActive=true) {
    const config={getOrThrow:(key:string)=>key==='JWT_ACCESS_SECRET'?'unit-test-signature-key-only-not-real-2026':'unit'} as ConfigService;
    const users={findOne:async()=>({id,name:'Unit',email:'unit@example.test',isActive,role:{name:role}})} as unknown as Repository<User>;
    return new JwtStrategy(config,users);
  }
  it('uses the current active identity from the database',async()=>{
    expect(await setup().validate({sub:id,role:'Administrador',name:'old',email:'old@example.test'})).toMatchObject({userId:id,name:'Unit'});
  });
  it('rejects previously issued administrator claims after a role change',async()=>{
    await expect(setup('Operador').validate({sub:id,role:'Administrador',name:'Unit',email:'unit@example.test'})).rejects.toMatchObject({status:401});
  });
  it('rejects inactive users and malformed IDs',async()=>{
    await expect(setup('Administrador',false).validate({sub:id,role:'Administrador',name:'Unit',email:'unit@example.test'})).rejects.toMatchObject({status:401});
    await expect(setup().validate({sub:'invalid',role:'Administrador',name:'Unit',email:'unit@example.test'})).rejects.toMatchObject({status:401});
  });
});
