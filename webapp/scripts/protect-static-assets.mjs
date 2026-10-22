import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const branding=new Set(['/favicon.svg','/assets/icon-pcl-logo.jpg','/assets/purdue-university.svg','/assets/drexel-university.svg']);
const mime={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.jsonld':'application/ld+json','.ttl':'text/turtle; charset=utf-8','.csv':'text/csv; charset=utf-8','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};

export async function protectStaticAssets(root=process.cwd()){
 const client=path.resolve(root,'dist/client'),server=path.resolve(root,'dist/server');
 const files=[];
 async function walk(directory){for(const item of await fs.readdir(directory,{withFileTypes:true})){
  const full=path.join(directory,item.name);
  if(item.isSymbolicLink())throw Error('Unexpected symlink in built assets');
  if(item.isDirectory())await walk(full);else files.push(full);
 }}
 await walk(client);
 const entries={},manifest=[];let compressedBytes=0;
 for(const full of files.sort()){
  const relative=path.relative(client,full);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Asset escaped client directory');
  const url='/'+relative.split(path.sep).join('/');
  if(['/.assetsignore','/_headers'].includes(url))continue;
  const bytes=await fs.readFile(full),compressed=gzipSync(bytes,{level:9});
  entries[url]=[mime[path.extname(full)]||'application/octet-stream',compressed.toString('base64')];
  compressedBytes+=compressed.length;
  manifest.push({path:url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),public:branding.has(url)});
 }
 if(compressedBytes>8*1024*1024)throw Error('Protected asset payload exceeds the Worker budget');
 await fs.writeFile(path.join(server,'protected-assets.js'),'export default '+JSON.stringify(entries)+';\n');
 const entry=path.join(server,'index.js'),original=path.join(server,'app-worker.js');
 await fs.rename(entry,original);
 await fs.writeFile(entry,`import worker from './app-worker.js';
import assets from './protected-assets.js';
export * from './app-worker.js';
export default {...worker,fetch(request,env,ctx){
 const original=env.ASSETS;
 const binding={async fetch(input,init){
  const req=input instanceof Request?input:new Request(input,init);
  const item=assets[new URL(req.url).pathname];
  if(!item)return original?original.fetch(req):new Response('Not found',{status:404});
  const compressed=Uint8Array.from(atob(item[1]),c=>c.charCodeAt(0));
  // Serve decoded bytes. The hosting proxy applies transport compression; an
  // explicit gzip header here would cause its automatic encoding to run twice.
  const body=req.method==='HEAD'?null:new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(body,{headers:{'Content-Type':item[0],'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }};
 // The application's existing gate runs before its ASSETS fetch. Nothing here
 // grants access; keeping protected files out of the edge asset store prevents
 // a hosting platform from serving them ahead of the Worker.
 return worker.fetch(request,{...env,ASSETS:binding},ctx);
}};
`);
 await fs.writeFile(path.join(server,'protected-assets-manifest.json'),JSON.stringify({files:manifest,compressedBytes},null,2));
 // Only explicitly enumerated built files inside dist/client are removed. The
 // source assets remain intact, and four public branding files stay at the edge.
 for(const full of files){
  const relative=path.relative(client,full),url='/'+relative.split(path.sep).join('/');
  if(!branding.has(url)&&!['/.assetsignore','/_headers'].includes(url))await fs.unlink(full);
 }
 console.log(JSON.stringify({protectedAssets:manifest.filter(x=>!x.public).length,publicBrandingAssets:manifest.filter(x=>x.public).length,compressedBytes}));
}
