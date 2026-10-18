import test from 'node:test';
import assert from 'node:assert/strict';
import {localAdminEnabled,isLocalAdmin,LOCAL_ADMIN_ID,LOCAL_ADMIN_EMAIL} from '../app/local-admin.ts';
import {sites} from '../build/sites-vite-plugin.ts';
const user={userId:LOCAL_ADMIN_ID,email:LOCAL_ADMIN_EMAIL};
test('automatic administrator is enabled only for portable development, with an explicit test opt-out',()=>{
 assert.equal(localAdminEnabled('serve',false),true);
 for(const args of [['build',false],['serve',true],['serve',false,'0']])assert.equal(localAdminEnabled(...args),false);
 assert.equal(isLocalAdmin(user,{}),false);
 assert.equal(isLocalAdmin(null,{SITES_LOCAL_ADMIN:'enabled'}),false);
 assert.equal(isLocalAdmin({...user,userId:'other'},{SITES_LOCAL_ADMIN:'enabled'}),false);
 assert.equal(isLocalAdmin({...user,email:'seedy@sites.test'},{SITES_LOCAL_ADMIN:'enabled'}),false);
 assert.equal(isLocalAdmin(user,{SITES_LOCAL_ADMIN:'enabled'}),true);
});
function request({host='127.0.0.1:5173',address='127.0.0.1',url='/api/catalog',autoAdmin=true,cookie=''}={}){
 let middleware;
 sites({autoAdmin}).configureServer({config:{server:{},logger:{info(){}}},middlewares:{use(fn){middleware=fn;}}});
 const req={headers:{host,cookie,'oai-authenticated-user-id':'spoof','oai-authenticated-user-email':'spoof@test'},rawHeaders:['oai-authenticated-user-id','spoof'],socket:{remoteAddress:address},url,method:'GET'};
 const res={setHeader(){},end(){this.ended=true;}};
 middleware(req,res,()=>{res.next=true;});return {req,res};
}
test('loopback preview signs in admin without any cookie and strips client identity',()=>{
 const {req,res}=request();assert.ok(res.next);assert.equal(req.headers['oai-authenticated-user-id'],LOCAL_ADMIN_ID);assert.equal(req.headers['oai-authenticated-user-email'],LOCAL_ADMIN_EMAIL);assert.equal(req.headers['oai-authenticated-user-full-name'],'admin');assert.ok(!req.rawHeaders.includes('spoof'));
});
test('nonlocal hosts, nonlocal sockets and absolute foreign URLs never receive local identity',()=>{
 for(const args of [{host:'example.org:5173'},{address:'192.0.2.1'},{url:'http://example.org/api/catalog'}]){
  const {req}=request(args);assert.equal(req.headers['oai-authenticated-user-id'],undefined);assert.equal(req.headers['oai-authenticated-user-email'],undefined);
 }
});
test('opt-out preserves the normal signed-out and cookie sign-in path for access tests',()=>{
 assert.equal(request({autoAdmin:false}).req.headers['oai-authenticated-user-id'],undefined);
 assert.equal(request({autoAdmin:false,cookie:'__sites_local_auth=1'}).req.headers['oai-authenticated-user-email'],'seedy@sites.test');
});
