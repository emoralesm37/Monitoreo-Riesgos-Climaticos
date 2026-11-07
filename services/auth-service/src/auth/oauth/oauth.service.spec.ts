import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import { OAuthFailure, hash } from './oauth-provider.service';

describe('OAuth callbacks and explicit account linking', () => {
  let service: OAuthService, flow: any, user: any, existing: any, emailMatch: any;
  let users: any, accounts: any, auth: any;
  beforeEach(() => {
    flow = {id:'flow', provider:'google', bindingHash:hash('binding'), expiresAt:new Date(Date.now()+60000), consumedAt:null, verifierCipher:''};
    user = {id:'viewer', isActive:true, role:{name:'Viewer'}};
    existing = null; emailMatch = null;
    users = {findOne:jest.fn(async()=>user), create:(v:any)=>v, save:jest.fn(async(v:any)=>({...v,id:'new-viewer'})), createQueryBuilder:()=>({where:()=>({getOne:async()=>emailMatch})})};
    accounts = {findOne:jest.fn(async()=>existing), create:(v:any)=>v, save:jest.fn(async(v:any)=>v)};
    const flows = {findOne:async()=>flow, save:async(v:any)=>v, update:jest.fn(async(_id:any,v:any)=>Object.assign(flow,v))};
    const manager:any = {query:async()=>{},getRepository:(e:any)=>({User:users,ExternalAccount:accounts,OAuthFlow:flows,Role:{findOneBy:async()=>({id:'viewer-role',name:'Viewer'})}} as any)[e.name] ?? {}};
    const db:any = {transaction:async(fn:any)=>fn(manager)};
    const providers:any = {settings:()=>({sessionKey:'a'.repeat(64)}), identity:jest.fn(async()=>({providerUserId:'external-id',email:'unit@example.test',name:'Unit'}))};
    auth = {issueTokenPair:jest.fn(async()=>({ok:true}))};
    service = new OAuthService(db,providers,auth);
    jest.spyOn(service as any,'crypt').mockReturnValue('synthetic-verifier');
  });
  it.each(['google','github'] as const)('creates only Viewer via %s and exchanges once with provider',async provider=>{
    flow.provider=provider;
    const ticket=await service.callback(provider,'state','binding','synthetic-code');
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({passwordHash:null,role:expect.objectContaining({name:'Viewer'})}));
    await service.exchange('state',ticket,'binding');
    expect(auth.issueTokenPair).toHaveBeenCalledWith(user,expect.anything(),provider);
    await expect(service.exchange('state',ticket,'binding')).rejects.toThrow();
    await expect(service.callback(provider,'state','binding','code')).rejects.toThrow();
  });
  it('requires explicit linking for an existing email',async()=>{
    emailMatch=user;
    await expect(service.callback('google','state','binding','code')).rejects.toMatchObject({reason:'account_link_required'});
    expect(accounts.save).not.toHaveBeenCalled();
  });
  it('links to authenticated account and rejects an identity owned by another user',async()=>{
    flow.linkUserId=user.id;
    await service.callback('google','state','binding','code');
    expect(accounts.save).toHaveBeenCalledWith(expect.objectContaining({userId:user.id}));
    flow.consumedAt=null; existing={userId:'another-user'};
    await expect(service.callback('google','state','binding','code')).rejects.toMatchObject({reason:'link_rejected'});
  });
  it.each(['binding','provider','expired','cancelled','inactive'])('rejects %s',async issue=>{
    if(issue==='expired') flow.expiresAt=new Date(0);
    if(issue==='inactive') {existing={userId:user.id};user.isActive=false;}
    await expect(service.callback(issue==='provider'?'github':'google','state',issue==='binding'?'wrong':'binding','code',issue==='cancelled'?'access_denied':undefined)).rejects.toThrow();
  });
  it.each(['google','github'])('redirects %s callback with a ticket and sanitized errors',async provider=>{
    const oauth:any={providers:{frontend:()=> 'http://localhost:4300',provider:(p:string)=>p},callback:jest.fn(async()=> 'ticket')};
    const controller=new OAuthController(oauth);
    const res:any={setHeader:jest.fn(),redirect:jest.fn()};
    const state='a'.repeat(64);
    await controller.callback(provider,state,'provider-code',undefined as any,{headers:{cookie:`cg_oauth_${state}=binding`}} as any,res);
    expect(oauth.callback).toHaveBeenCalledWith(provider,state,'binding','provider-code',undefined);
    expect(res.redirect).toHaveBeenCalledWith(303,`http://localhost:4300/oauth/callback#code=ticket&state=${state}`);
    oauth.callback.mockRejectedValue(new OAuthFailure('invalid_state'));
    await controller.callback(provider,state,'code',undefined as any,{headers:{}} as any,res);
    expect(res.redirect).toHaveBeenLastCalledWith(303,'http://localhost:4300/oauth/callback#error=invalid_state');
  });
});
