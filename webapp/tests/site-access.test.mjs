import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {issueAdminSession,passwordHash,ADMIN_COOKIE} from '../app/admin-session.ts';
import {PASSWORD_ADMIN_ID} from '../app/password-identity.ts';
import {requestAdminCookie,requestHasAdminAccess,siteAccessResponse,passwordLoginResponse,privateSiteResponse} from '../app/site-access.ts';
const secrets={CATALOG_ADMIN_PASSWORD_HASH:await passwordHash('unit-test-password','0123456789abcdef0123456789abcdef'),CATALOG_ADMIN_SESSION_KEY:'ab'.repeat(32)};
const request=(path='/',headers={})=>new Request('https://example.test'+path,{headers});
test('password gate serves a standalone form without ChatGPT or catalog bundles',async()=>{
 const response=await siteAccessResponse(request(),secrets),html=await response.text();
 assert.equal(response.status,200);assert.match(html,/method="post" action="\/api\/admin\/session"/);assert.match(html,/name="password"/);
 assert.doesNotMatch(html,/signin-with-chatgpt|<script|\/api\/catalog|serial|catalog\.json/);
 assert.match(response.headers.get('Cache-Control'),/no-store/);assert.match(response.headers.get('Content-Security-Policy'),/form-action 'self'/);
});
test('APIs, downloads, client code and bundled data require the password',async()=>{
 for(const path of ['/api/catalog','/api/processes','/api/evidence','/api/research/files?id=secret','/api/admin/catalog','/ontology/catalog.json','/templates/equipment.csv','/assets/client.js','/_next/static/chunk.js','/other']){
  const response=await siteAccessResponse(request(path),secrets);assert.equal(response.status,401,path);assert.match(response.headers.get('Cache-Control'),/no-store/);
 }
 for(const path of ['/api/admin/session','/favicon.svg','/assets/icon-pcl-logo.jpg'])assert.equal(await siteAccessResponse(request(path),secrets),null,path);
});
test('a valid shared session grants access without any identity headers',async()=>{
 const token=await issueAdminSession(PASSWORD_ADMIN_ID,secrets);
 const r=request('/api/catalog',{cookie:ADMIN_COOKIE+'='+token});assert.equal(await requestHasAdminAccess(r,secrets),true);assert.equal(await siteAccessResponse(r,secrets),null);
 for(const bad of [token+'x','not-a-token',''])assert.equal(await requestHasAdminAccess(request('/',{cookie:ADMIN_COOKIE+'='+bad}),secrets),false);
 assert.equal(await requestHasAdminAccess(r,{...secrets,CATALOG_ADMIN_SESSION_KEY:'cd'.repeat(32)}),false);
 const expired=await issueAdminSession(PASSWORD_ADMIN_ID,secrets,1000);assert.equal(await requestHasAdminAccess(request('/',{cookie:ADMIN_COOKIE+'='+expired}),secrets),false);
});
test('account sessions retain identity binding and an identity alone does not unlock',async()=>{
 const token=await issueAdminSession('owner-account',secrets);
 const h={'oai-authenticated-user-id':'owner-account','oai-authenticated-user-email':'owner@example.test'};
 assert.equal(await requestHasAdminAccess(request('/',h),secrets),false);
 assert.equal(await requestHasAdminAccess(request('/',{...h,cookie:ADMIN_COOKIE+'='+token}),secrets),true);
 assert.equal(await requestHasAdminAccess(request('/',{...h,'oai-authenticated-user-id':'somebody-else',cookie:ADMIN_COOKIE+'='+token}),secrets),false);
});
test('ambiguous cookies and browser-supplied local identities fail closed',async()=>{
 const cookie=ADMIN_COOKIE+'=first; '+ADMIN_COOKIE+'=second';assert.equal(requestAdminCookie(request('/',{cookie})),undefined);
 const h={'oai-authenticated-user-id':'local_seedy','oai-authenticated-user-email':'admin@localhost'};
 assert.equal(await requestHasAdminAccess(request('/',h),secrets),false);
 assert.equal(await requestHasAdminAccess(request('/',h),{...secrets,SITES_LOCAL_ADMIN:'enabled'}),true);
 assert.equal(await requestHasAdminAccess(request('/',{...h,'oai-authenticated-user-email':'other@localhost'}),{...secrets,SITES_LOCAL_ADMIN:'enabled'}),false);
});
test('login errors are escaped and private responses cannot be cached',async()=>{
 const html=await passwordLoginResponse('<img onerror=alert(1)>',403).text();assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img onerror'));
 const response=privateSiteResponse(new Response('private',{headers:{'Cache-Control':'public,max-age=3600','Vary':'Accept'}}));
 assert.match(response.headers.get('Cache-Control'),/private, no-store/);assert.match(response.headers.get('Vary'),/Cookie/);assert.equal(await response.text(),'private');
});
test('the production Worker gate runs ahead of both application routes and assets',()=>{
 const worker=readFileSync(new URL('../build/sites-worker.ts',import.meta.url),'utf8');
 assert.ok(worker.indexOf('await siteAccessResponse')<worker.indexOf('handler.fetch'));
 assert.ok(worker.indexOf('await siteAccessResponse')<worker.indexOf('env.ASSETS.fetch'));
 assert.match(readFileSync(new URL('../vite.config.ts',import.meta.url),'utf8'),/assets:\s*\{run_worker_first:\s*true,\s*binding:\s*'ASSETS'\}/);
});
