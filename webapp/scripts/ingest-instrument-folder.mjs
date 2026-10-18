#!/usr/bin/env node
/** Local instrument-export adapter. Never modifies or uploads source files. */
import {readdir,readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve,join,relative,extname,sep,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {instrumentFile,digestBytes,INGEST_LIMIT} from '../app/instrument-ingest-lib.ts';
import {blankResearch,newResearchId,recordIdPattern,RESEARCH_LICENSES} from '../app/research-lib.ts';
import {crateFilePath,researchCrate,dataCiteDraft} from '../app/research-export-lib.ts';
import {researchZip} from '../app/research-zip-lib.ts';

export async function ingestFolder({input,output,context,origin='https://local.invalid',watch=false,once=false,quiet=false}){
 input=resolve(input);output=resolve(output);
 const delta=relative(input,output);if(!delta||!delta.startsWith('..'+sep)&&delta!=='..'&&!isAbsolute(delta))throw new Error('Keep the output folder outside the watched instrument folder.');
 const base=context?.record||context||{};
 if(base.kind&&base.kind!=='dataset')throw new Error('The context must describe a Data set.');
 if(base.workflow_id||(base.relations||[]).length)throw new Error('Review protocol and experimental lineage in the authenticated app. Local unattended extraction does not assert execution.');
 if(base.license_uri&&!RESEARCH_LICENSES.some(l=>l.value===base.license_uri))throw new Error('Use a supported license URI or leave rights unspecified.');
 const contextDigest=(await digestBytes(new TextEncoder().encode(JSON.stringify(base)))).slice(0,12);
 const statuses=new Map(),errors=new Set();let imported=0;
 await mkdir(output,{recursive:true});
 async function scan(){
  for(const item of await readdir(input,{withFileTypes:true})){
   if(!item.isFile()||!['.csv','.tsv','.json','.txt'].includes(extname(item.name).toLowerCase())||item.name.endsWith('.partial'))continue;
   const source=join(input,item.name),info=await stat(source),key=info.size+':'+info.mtimeMs,previous=statuses.get(source);
   if(watch&&!once&&previous!==key){statuses.set(source,key);continue;}
   try{
    if(!info.size||info.size>INGEST_LIMIT)throw new Error('Use a nonempty export up to 2 MiB.');
    const bytes=new Uint8Array(await readFile(source));const after=await stat(source);if(after.size!==info.size||after.mtimeMs!==info.mtimeMs)continue;
    const file=await instrumentFile(item.name,bytes),slug=item.name.replace(/[^A-Za-z0-9._-]/g,'_').slice(0,70),target=join(output,slug+'-'+file.sha256+'-'+contextDigest+'.zip');
    try{await stat(target);continue}catch(e){if(e.code!=='ENOENT')throw e;}
    const record={...blankResearch('dataset'),...base,schema:'iconpcl-research/v1',record_id:newResearchId(),kind:'dataset',code:'DATA_'+file.sha256.slice(0,12).toUpperCase(),name:base.name||item.name,status:'planned',access_scope:'private',files:[file],relations:[],workflow_id:'',workflow_revision:null,properties:{...(base.properties||{}),local_adapter:{version:1,review_required:true,filename:item.name}}};
    if(record.container_id&&!recordIdPattern.test(record.container_id))throw new Error('Context container ID is invalid.');
    const now=new Date().toISOString(),saved={record,revision:1,created_at:now,updated_at:now,can_edit:true,space_id:''},encode=x=>new TextEncoder().encode(JSON.stringify(x,null,2));
    const zip=researchZip([{name:'ro-crate-metadata.json',bytes:encode(researchCrate(saved,[],origin,true))},{name:'research-record.json',bytes:encode({schema:'iconpcl-local-ingestion/v1',review_required:true,record,revision:1})},{name:'datacite-draft.json',bytes:encode(dataCiteDraft(saved))},{name:crateFilePath(file),bytes}]);
    await writeFile(target,zip,{flag:'wx'});imported++;if(!quiet)process.stdout.write('Packaged '+item.name+' · '+file.extraction.row_count+' rows · SHA-256 '+file.sha256+'\n');
   }catch(e){const fingerprint=source+key+e.message;if(!errors.has(fingerprint)){errors.add(fingerprint);if(!quiet)process.stderr.write('Needs review: '+item.name+' — '+e.message+'\n');}}
  }
 }
 await scan();if(watch&&!once){if(!quiet)process.stdout.write('Watching stable exports every 5 seconds. Ctrl+C stops; originals remain untouched.\n');await new Promise(()=>{setInterval(()=>scan().catch(e=>process.stderr.write(e.message+'\n')),5000);});}
 return {imported,errors:errors.size};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),option=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;
 if(!option('--input')||!option('--out')){process.stdout.write('Usage: node --experimental-strip-types scripts/ingest-instrument-folder.mjs --input <instrument-export-folder> --out <private-package-folder> [--context <record.json>] [--origin <site-origin>] [--watch]\n');process.exitCode=1;}else{
  try{const context=option('--context')?JSON.parse(await readFile(option('--context'),'utf8')):{};const result=await ingestFolder({input:option('--input'),output:option('--out'),context,origin:option('--origin'),watch:args.includes('--watch')});if(result.errors)process.exitCode=1;}catch(e){process.stderr.write(e.message+'\n');process.exitCode=1;}
 }
}
