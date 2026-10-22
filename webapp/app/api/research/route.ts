import {env} from 'cloudflare:workers';
import {getCurrentUser} from '../../current-user';
import seed from '../../data/catalog.json';
import {loadSharedCatalog} from '../../catalog-store';
import {newResearchId,rootSpace,validateResearch} from '../../research-lib';
import {advanceResearchFence,boundedResearchBody,canReadResearch,researchFailure,researchFence,researchFenceChanged,researchJson as json,researchRow,researchRows,sameResearchOrigin,savedResearch} from '../../research-store';
import {researchExport,researchCrate,dataCiteDraft} from '../../research-export-lib';
export async function GET(request:Request){try{
 const user=await getCurrentUser();if(!user)return json({error:'Sign in to access research records.'},401);
 const p=new URL(request.url).searchParams,id=p.get('id');
 if(!id){const rows=await researchRows(user);return json({records:rows.map(r=>savedResearch(r,user)),capacity:500});}
 const row=await researchRow(id);if(!row||!await canReadResearch(row,user))return json({error:'Record not found or not shared with your account.'},404);
 let saved=savedResearch(row,user);const rev=p.get('revision');
 if(rev){if(!saved.can_edit)return json({error:'Revision history is owner-only.'},403);if(!/^[1-9]\d*$/.test(rev))return json({error:'Invalid revision.'},400);const old=await env.DB!.prepare('SELECT payload,revision,created_at FROM research_versions WHERE record_id=? AND revision=?').bind(id,Number(rev)).first<{payload:string;revision:number;created_at:string}>();if(!old)return json({error:'Revision not found.'},404);saved={...saved,record:JSON.parse(old.payload),revision:old.revision,updated_at:old.created_at};}
 const format=p.get('format');if(format){const all=(await researchRows(user)).map(r=>savedResearch(r,user)),origin=new URL(request.url).origin;
  const data=format==='ro-crate'?researchCrate(saved,all,origin):format==='datacite'?dataCiteDraft(saved):format==='json'?researchExport(saved,all,origin):null;
  if(!data)return json({error:'Unknown export format.'},400);
  return new Response(JSON.stringify(data,null,2),{headers:{'Content-Type':'application/ld+json; charset=utf-8','Content-Disposition':`attachment; filename="${saved.record.code}-${format}.json"`,'Cache-Control':'no-store'}});
 }
 const history=saved.can_edit?(await env.DB!.prepare('SELECT revision,created_at FROM research_versions WHERE record_id=? ORDER BY revision DESC LIMIT 100').bind(id).all()).results:[];
 return json({...saved,history});
}catch(e){return researchFailure(e)}}
export async function PUT(request:Request){try{
 const user=await getCurrentUser();if(!user)return json({error:'Sign in to save research records.'},401);if(!sameResearchOrigin(request))return json({error:'Same-origin requests required.'},403);
 let raw:string;try{raw=new TextDecoder().decode(await boundedResearchBody(request,100000))}catch{return json({error:'Record exceeds 100 KB.'},413)}let input:any;try{input=JSON.parse(raw)}catch{return json({error:'Invalid JSON.'},400)}
 if(!input||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0||!input.record||typeof input.record.record_id!=='string')return json({error:'Invalid record and revision.'},400);
 const previous=input.record.record_id?await researchRow(input.record.record_id):null;
 if(input.record.record_id&&(!previous||previous.owner_id!==user.userId))return json({error:'Owned record not found.'},404);
 if(input.expected_revision!==(previous?.revision||0))return json({error:'A newer revision exists. Download your draft, then reload the record.'},409);
 const fence=await researchFence(user.userId),owned=await researchRows(user,true);if(!previous&&owned.length>=500)return json({error:'This research workspace supports 500 owned records. Export and contact the maintainer to expand capacity.'},409);
 let record;try{
  if(JSON.stringify(input.record.files)!==JSON.stringify(previous?JSON.parse(previous.payload).files:[]))throw new Error('Original files are server-managed. Use instrument-file ingestion to create a Data set.');
  record=validateResearch(input.record,owned.map(r=>JSON.parse(r.payload)),(await loadSharedCatalog()).records,seed.routes,previous?JSON.parse(previous.payload):undefined);
  if(record.workflow_id){const plan=await env.DB!.prepare('SELECT revision FROM process_workflows WHERE workflow_id=? AND user_id=?').bind(record.workflow_id,user.userId).first<{revision:number}>();if(!plan)throw new Error('Saved protocol plan was not found in your account.');if(record.workflow_revision===null)record.workflow_revision=plan.revision;const version=await env.DB!.prepare('SELECT 1 FROM process_workflow_versions WHERE workflow_id=? AND revision=?').bind(record.workflow_id,record.workflow_revision).first();if(!version)throw new Error('Saved protocol revision was not found.');}
 }catch(e){return json({error:e instanceof Error?e.message:'Invalid record.'},400)}
 if(!previous)record.record_id=newResearchId();
 const revision=(previous?.revision||0)+1,now=new Date().toISOString(),payload=JSON.stringify(record),space=rootSpace(record,[...owned.map(r=>JSON.parse(r.payload)),record]);
 const statement=previous?env.DB!.prepare('UPDATE research_records SET payload=?,revision=CASE WHEN revision=? THEN revision+1 ELSE NULL END,access_scope=?,updated_at=? WHERE record_id=? AND owner_id=?').bind(payload,input.expected_revision,record.access_scope,now,record.record_id,user.userId):env.DB!.prepare('INSERT INTO research_records(record_id,owner_id,space_id,kind,container_id,code,payload,revision,access_scope,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(record.record_id,user.userId,space,record.kind,record.container_id,record.code,payload,revision,record.access_scope,now,now);
 try{await env.DB!.batch([advanceResearchFence(user.userId,fence),statement,env.DB!.prepare('INSERT INTO research_versions(record_id,revision,payload,actor_id,created_at) VALUES(?,?,?,?,?)').bind(record.record_id,revision,payload,user.userId,now)]);}catch(e){if(await researchFenceChanged(user.userId,fence)||previous&&(await researchRow(record.record_id))?.revision!==input.expected_revision)return json({error:'Another window changed the research workspace. Download your draft and reload before saving, so lineage can be checked again.'},409);if(!previous&&await env.DB!.prepare('SELECT 1 FROM research_records WHERE owner_id=? AND container_id=? AND kind=? AND code=?').bind(user.userId,record.container_id,record.kind,record.code).first())return json({error:'This code was created in another window. Choose another code.'},409);throw e;}
 return json({record,revision,created_at:previous?.created_at||now,updated_at:now,can_edit:true,space_id:space});
}catch(e){return researchFailure(e)}}
