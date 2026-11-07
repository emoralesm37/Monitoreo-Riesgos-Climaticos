"""Real deployed OAuth start/cookie/callback security, WITHOUT signing into real accounts.
Authorization URLs, state, bindings, credentials and tokens are never printed.
"""
import importlib.util
import json
from pathlib import Path
from urllib.parse import urlparse,parse_qs,urlencode

spec=importlib.util.spec_from_file_location('business',Path(__file__).with_name('business-e2e-private.py'))
b=importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

def call(path,method='GET',body=None,cookie=None,origin=None,token=None):
    connection=b.LocalIngress(b.HOST,timeout=30)
    headers={'Origin':origin or 'https://'+b.HOST}
    if body is not None: headers['Content-Type']='application/json'
    if cookie: headers['Cookie']=cookie
    if token: headers['Authorization']='Bearer '+token
    connection.request(method,path,body=None if body is None else json.dumps(body),headers=headers)
    response=connection.getresponse()
    raw=response.read()
    result=(response.status,{key.lower():value for key,value in response.getheaders()},raw)
    connection.close()
    return result

def run():
    status=json.loads(call('/api/auth/oauth/status')[2])
    for provider,host in [('google','accounts.google.com'),('github','github.com')]:
        b.check('Provider configured '+provider,status[provider]['configured'])
        code,headers,body=call('/api/auth/oauth/'+provider+'/start','POST',{},origin='https://untrusted.invalid')
        b.check('Reject untrusted OAuth origin '+provider,code==403)
        code,headers,body=call('/api/auth/oauth/'+provider+'/link','POST',{'password':'technical-invalid-password'})
        b.check('Explicit linking requires authenticated session '+provider,code==401)
        code,headers,body=call('/api/auth/oauth/'+provider+'/start','POST',{})
        b.check('Authorized start '+provider,code==201)
        url=urlparse(json.loads(body)['authorizationUrl'])
        params=parse_qs(url.query)
        b.check('Provider authorization host '+provider,url.scheme=='https' and url.hostname==host)
        b.check('Exact HTTPS callback '+provider,params['redirect_uri']==['https://'+b.HOST+'/api/auth/callback/'+provider])
        b.check('PKCE S256 '+provider,params.get('code_challenge_method')==['S256'] and bool(params.get('code_challenge')))
        if provider=='google': b.check('OIDC nonce present',bool(params.get('nonce')))
        set_cookie=headers.get('set-cookie','')
        lower=set_cookie.lower()
        b.check('Secure HttpOnly Lax cookie '+provider,all(item in lower for item in ['secure','httponly','samesite=lax','path=/api/auth']))
        state=params['state'][0]
        cookie=set_cookie.split(';',1)[0]
        callback='/api/auth/callback/'+provider+'?'+urlencode({'state':state,'error':'access_denied'})
        code,headers,body=call(callback)
        b.check('Callback rejects missing browser binding '+provider,code==303 and 'invalid_state' in headers.get('location',''))
        code,headers,body=call(callback,cookie=cookie)
        b.check('Bound callback handles explicit cancellation '+provider,code==303 and 'cancelled' in headers.get('location',''))
        code,headers,body=call(callback,cookie=cookie)
        b.check('Used callback state rejected '+provider,code==303 and 'invalid_state' in headers.get('location',''))
    return {'realProviderAccountLogin':'NOT_AUTOMATED; waiting for human sign-in','providerClientsConfigured':True,'realHttpsGatewayAndCallbacksTested':True}

if __name__=='__main__':
    summary={}
    try: summary=run()
    except Exception as error: summary={'failedAt':b.LAST,'errorType':type(error).__name__}
    result={'passed':bool(b.RESULTS) and all(r['passed'] for r in b.RESULTS) and 'failedAt' not in summary,'checks':b.RESULTS,'summary':summary,'secretValuesPrinted':False}
    b.save(b.EVIDENCE/'oauth-protocol.json',result)
    print(json.dumps(result))
    raise SystemExit(0 if result['passed'] else 1)
