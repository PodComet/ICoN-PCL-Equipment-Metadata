import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import seed from '../../../data/catalog.json';
import {loadSharedCatalog} from '../../../catalog-store';
import {newResearchId,rootSpace,validateResearch} from '../../../research-lib';
import {instrumentFile,digestBytes,INGEST_LIMIT} from '../../../instrument-ingest-lib';
import {advanceResearchFence,boundedResearchBody,researchFailure,researchFence,researchFenceChanged,researchJson as json,researchRow,researchRows,sameResearchOrigin,savedResearch} from '../../../research-store';
export async function POST(request:Request){
 let objectKey='';let committed=false;
 try{
  const user=await getChatGPTUser();if(!user)return json({error:'Sign in to ingest instrument files.'},401);if(!sameResearchOrigin(request))return json({error:'Same-origin requests required.'},403);
  let form:FormData;try{const body=await boundedResearchBody(request,INGEST_LIMIT+120000);form=await new Request(request.url,{method:'POST',headers:{'Content-Type':request.headers.get('content-type')||''},body:body as BodyInit}).formData();}catch(e){return json({error:e instanceof Error?e.message:'Invalid file upload.'},400)}
  const raw=form.get('record'),file=form.get('file'),key=form.get('ingest_key');if(typeof raw!=='string'||raw.length>100000||!(file instanceof File)||typeof key!=='string'||!/^\w{8}-\w{4}-4\w{3}-[89ab]\w{3}-\w{12}$/i.test(key))return json({error:'Provide record metadata, one instrument file and a client ingestion UUID.'},400);
  let input;let manifest;let bytes:Uint8Array;try{input=JSON.parse(raw);bytes=new Uint8Array(await file.arrayBuffer());manifest=await instrumentFile(file.name,bytes);if(input.record_id||input.kind!=='dataset'||!Array.isArray(input.files)||input.files.length)throw new Error('Ingestion creates a new Data set with a server-owned file manifest.');}catch(e){return json({error:e instanceof Error?e.message:'Invalid instrument input.'},400)}
  const digest=await digestBytes(new TextEncoder().encode(raw+'\n'+file.name+'\n'+manifest.sha256));
  const prior=await env.DB!.prepare('SELECT record_id,request_digest FROM research_ingestions WHERE owner_id=? AND ingest_key=?').bind(user.userId,key).first<{record_id:string;request_digest:string}>();
  if(prior){if(prior.request_digest!==digest)return json({error:'This ingestion UUID was already used with different data or metadata.'},409);const saved=await researchRow(prior.record_id);if(!saved)return json({error:'Prior ingestion record is unavailable.'},409);return json({...savedResearch(saved,user),idempotent:true});}
  const fence=await researchFence(user.userId),owned=await researchRows(user,true);if(owned.length>=500)return json({error:'Workspace capacity reached (500 owned records).'},409);
  let record;try{record=validateResearch(input,owned.map(r=>JSON.parse(r.payload)),(await loadSharedCatalog()).records,seed.routes);if(record.workflow_id)throw new Error('Link protocol plans on an Experimental step, then relate the observed Data set to that completed step.');}catch(e){return json({error:e instanceof Error?e.message:'Invalid metadata.'},400)}
  if(!env.BUCKET)return json({error:'Instrument-file storage is not configured. Your source file remains on your computer.'},503);
  record.record_id=newResearchId();record.files=[manifest];const space=rootSpace(record,owned.map(r=>JSON.parse(r.payload))),now=new Date().toISOString(),payload=JSON.stringify(record);
  objectKey='research/'+record.record_id+'/'+manifest.file_id;
  await env.BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:manifest.media_type},customMetadata:{sha256:manifest.sha256}});
  try{await env.DB!.batch([
   advanceResearchFence(user.userId,fence),
   env.DB!.prepare('INSERT INTO research_records(record_id,owner_id,space_id,kind,container_id,code,payload,revision,access_scope,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?,?)').bind(record.record_id,user.userId,space,record.kind,record.container_id,record.code,payload,record.access_scope,now,now),
   env.DB!.prepare('INSERT INTO research_versions(record_id,revision,payload,actor_id,created_at) VALUES(?,1,?,?,?)').bind(record.record_id,payload,user.userId,now),
   env.DB!.prepare('INSERT INTO research_files(file_id,record_id,object_key,filename,sha256,size_bytes,media_type) VALUES(?,?,?,?,?,?,?)').bind(manifest.file_id,record.record_id,objectKey,manifest.filename,manifest.sha256,manifest.size_bytes,manifest.media_type),
   env.DB!.prepare('INSERT INTO research_ingestions(owner_id,ingest_key,record_id,request_digest) VALUES(?,?,?,?)').bind(user.userId,key,record.record_id,digest),
  ]);committed=true;}catch(e){
   const raced=await env.DB!.prepare('SELECT record_id,request_digest FROM research_ingestions WHERE owner_id=? AND ingest_key=?').bind(user.userId,key).first<{record_id:string;request_digest:string}>();
   if(raced&&raced.request_digest===digest){const row=await researchRow(raced.record_id);if(row)return json({...savedResearch(row,user),idempotent:true});}
   if(await researchFenceChanged(user.userId,fence))return json({error:'Another window changed the research workspace. Retry the ingestion to recheck metadata and lineage.'},409);
   if(await env.DB!.prepare('SELECT 1 FROM research_records WHERE owner_id=? AND container_id=? AND kind=? AND code=?').bind(user.userId,record.container_id,record.kind,record.code).first())return json({error:'This code is already used in the container.'},409);throw e;
  }
  return json({record,revision:1,created_at:now,updated_at:now,can_edit:true,space_id:space});
 }catch(e){return researchFailure(e)}finally{if(objectKey&&!committed){try{await env.BUCKET?.delete(objectKey)}catch{console.error('Could not remove an orphaned research upload');}}}
}
