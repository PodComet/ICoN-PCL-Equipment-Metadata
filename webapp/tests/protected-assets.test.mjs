import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {protectStaticAssets} from '../scripts/protect-static-assets.mjs';

test('production packaging removes edge copies and the original Worker must authorize exact-byte downloads',async()=>{
 const base=path.resolve('.sites-runtime');await fs.mkdir(base,{recursive:true});
 const root=await fs.mkdtemp(path.join(base,'protected-assets-test-'));
 try{
  const client=path.join(root,'dist/client'),server=path.join(root,'dist/server');
  await fs.mkdir(path.join(client,'ontology'),{recursive:true});await fs.mkdir(path.join(client,'assets'),{recursive:true});await fs.mkdir(server,{recursive:true});
  const data=Buffer.from('{"evidence":"preserved exact bytes"}\n');
  await fs.writeFile(path.join(client,'ontology/data.jsonld'),data);await fs.writeFile(path.join(client,'assets/icon-pcl-logo.jpg'),'public-branding');
  await fs.writeFile(path.join(server,'index.js'),`export const marker='retained';export default {fetch(request,env){return request.headers.get('authorization')==='test'?env.ASSETS.fetch(request):new Response('locked',{status:401});}};`);
  await protectStaticAssets(root);
  await assert.rejects(fs.stat(path.join(client,'ontology/data.jsonld')),{code:'ENOENT'});
  assert.equal(await fs.readFile(path.join(client,'assets/icon-pcl-logo.jpg'),'utf8'),'public-branding');
  const manifest=JSON.parse(await fs.readFile(path.join(server,'protected-assets-manifest.json'),'utf8'));
  assert.equal(manifest.files.find(f=>f.path==='/ontology/data.jsonld').sha256,createHash('sha256').update(data).digest('hex'));
  const worker=await import(pathToFileURL(path.join(server,'index.js')).href);
  assert.equal(worker.marker,'retained');
  assert.equal((await worker.default.fetch(new Request('https://example.test/ontology/data.jsonld'),{},{})).status,401);
  const response=await worker.default.fetch(new Request('https://example.test/ontology/data.jsonld',{headers:{authorization:'test'}}),{},{});
  assert.equal(response.status,200);assert.equal(response.headers.get('Content-Encoding'),null);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),data);
 }finally{
  const resolved=path.resolve(root);assert.ok(resolved.startsWith(base+path.sep)&&path.basename(resolved).startsWith('protected-assets-test-'));
  await fs.rm(resolved,{recursive:true,force:true});
 }
});
