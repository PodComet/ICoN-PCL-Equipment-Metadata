import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createWorkflow} from '../../app/process-lib.ts';

const base=process.env.ICONPCL_TEST_BASE||'http://127.0.0.1:5173';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'This integration test is local-only');
const {password}=JSON.parse(fs.readFileSync(0,'utf8'));
assert.ok(password);
const app=path.resolve(import.meta.dirname,'../..');
const client=path.join(app,'dist/client');
const assetManifest=path.join(app,'dist/server/protected-assets-manifest.json');
const asset=fs.existsSync(assetManifest)?JSON.parse(fs.readFileSync(assetManifest,'utf8')).files.find(p=>p.path.endsWith('.js')).path:
 '/'+fs.readdirSync(client,{recursive:true}).find(p=>p.endsWith('.js')).replaceAll('\\','/');
let cookie='';
let previewRestarts=0;
async function call(url,{method='GET',body,origin=base,cookieOverride=cookie,form=false}={}){
 const headers={Origin:origin};if(cookieOverride)headers.Cookie=cookieOverride;
 let data;
 if(body!==undefined){headers['Content-Type']=form?'application/x-www-form-urlencoded':'application/json';data=form?new URLSearchParams(body).toString():JSON.stringify(body);}
 let response,text;
 for(let attempt=0;attempt<3;attempt++){
  try{
   response=await fetch(base+url,{method,headers,body:data,redirect:'manual',signal:AbortSignal.timeout(10000)});
   text=await response.text();
   if(response.status===503&&text.includes('worker restarted mid-request')&&attempt<2&&method!=='PUT'){
    previewRestarts++;await new Promise(resolve=>setTimeout(resolve,250));continue;
   }
   break;
  }catch(error){
   if(method==='GET'&&error.name==='TimeoutError'&&attempt<2){previewRestarts++;continue;}
   throw error;
  }
 }
 const setCookie=response.headers.get('set-cookie');if(setCookie)cookie=setCookie.split(';')[0].endsWith('=')?'':setCookie.split(';')[0];
 let json;try{json=JSON.parse(text)}catch{}
 return {status:response.status,headers:response.headers,text,json};
}
for(const endpoint of ['/api/catalog','/api/processes','/api/admin/catalog',asset,'/templates/not-public.csv'])assert.equal((await call(endpoint)).status,401,endpoint);
let res=await call('/');assert.equal(res.status,200);assert.match(res.text,/Administrator password/);assert.doesNotMatch(res.text,/signin-with-chatgpt|<script/);
assert.equal((await call('/api/admin/session')).json.canAdmin,false);
assert.equal((await call('/api/admin/session',{method:'POST',body:{password:'wrong'},origin:'https://wrong.test'})).status,403);
assert.equal((await call('/api/admin/session',{method:'POST',body:{password:'wrong'}})).status,403);
res=await call('/api/admin/session',{method:'POST',body:{password}});assert.equal(res.status,200,res.text);assert.equal(res.json.canAdmin,true);
for(const flag of ['HttpOnly','SameSite=Strict','Max-Age=28800'])assert.ok(res.headers.get('set-cookie').includes(flag));
assert.equal((await call('/api/admin/catalog')).status,200);
res=await call('/api/catalog');assert.equal(res.status,200);assert.equal(res.json.canAdmin,true);assert.equal(res.json.canEdit,true);
const inventory=JSON.parse(fs.readFileSync(path.join(app,'app/data/purdue-inventory.json'),'utf8'));
assert.equal(res.json.assets.length,inventory.length);
const rows=res.json.rows.length;
res=await call(asset);assert.equal(res.status,200);assert.ok(res.text.length>0);assert.match(res.headers.get('Cache-Control'),/no-store/);
const catalog=JSON.parse(fs.readFileSync(path.join(app,'app/data/catalog.json'),'utf8'));
const workflow=createWorkflow(catalog.routes.find(r=>r.route_id==='P01'),catalog.steps);workflow.name='QA - password-only access';
res=await call('/api/processes',{method:'PUT',body:{workflow,expected_revision:0}});assert.equal(res.status,200,res.text);
const workflowId=res.json.workflow.workflow_id;assert.equal((await call('/api/processes?id='+workflowId)).json.revision,1);
assert.equal((await call('/api/admin/catalog',{cookieOverride:cookie+'tampered'})).status,401);
assert.equal((await call('/api/admin/catalog')).status,200);
assert.equal((await call('/api/admin/session',{method:'DELETE',origin:'https://wrong.test'})).status,403);
assert.equal((await call('/api/admin/session')).json.canAdmin,true);
assert.equal((await call('/api/admin/session',{method:'DELETE'})).status,200);assert.equal((await call('/api/catalog')).status,401);
res=await call('/api/admin/session',{method:'POST',body:{password},form:true});assert.equal(res.status,303,res.text);assert.equal(res.headers.get('Location'),'/');
res=await call('/');assert.equal(res.status,200);assert.match(res.text,/Nanomaterial Equipment/);
assert.equal((await call('/api/processes?id='+workflowId)).json.revision,1);
assert.equal((await call('/api/admin/session',{method:'DELETE'})).status,200);
for(let i=0;i<2;i++)assert.equal((await call('/api/admin/session',{method:'POST',body:{password:'wrong'}})).status,403);
res=await call('/api/admin/session',{method:'POST',body:{password:'wrong'}});assert.equal(res.status,429);assert.ok(Number(res.headers.get('Retry-After'))>0);
console.log(JSON.stringify({passed:true,checks:'Anonymous API and real-asset denial; password-only JSON/form login; admin and inventory; workflow save/reopen after relogin; CSRF; tampering; logout; rate limiting',rows,inventory:inventory.length,previewRestarts}));
