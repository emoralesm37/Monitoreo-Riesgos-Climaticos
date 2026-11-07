import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { UsersController } from '../users/users.controller';
import { RolesController } from './roles.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { authPermissions } from './auth-permissions';

describe('Read-only Auth permission inventory',()=>{
  it('matches actual controller methods, routes and role guards',()=>{
    const actual: {method:string;path:string;roles:readonly string[]}[]=[];
    for(const controller of [UsersController,RolesController]){
      const prefix=Reflect.getMetadata(PATH_METADATA,controller) as string;
      for(const name of Object.getOwnPropertyNames(controller.prototype).filter(n=>n!=='constructor')){
        const handler=controller.prototype[name as keyof typeof controller.prototype];
        const method=Reflect.getMetadata(METHOD_METADATA,handler);
        if(method===undefined)continue;
        const suffix=Reflect.getMetadata(PATH_METADATA,handler) as string;
        actual.push({method:RequestMethod[method],path:`/api/${prefix}/${suffix==='/'?'':suffix}`.replace(/\/$/,''),
          roles:Reflect.getMetadata(ROLES_KEY,handler)??Reflect.getMetadata(ROLES_KEY,controller)});
      }
    }
    const sorted=(data:readonly unknown[])=>[...data].map(x=>JSON.stringify(x)).sort();
    expect(sorted(actual)).toEqual(sorted(authPermissions.map(({method,path,roles})=>({method,path,roles}))));
    expect(authPermissions.every(p=>p.label.length>0)).toBe(true);
  });
});
