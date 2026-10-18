import {env} from 'cloudflare:workers';
import publicSeed from '../../data/evidence-registry.json';
import catalog from '../../data/catalog.json';
import {getChatGPTUser} from '../../chatgpt-auth';
import {loadPositionLibrary} from '../../position-store';
import {evidenceMatches,evidenceDigest,type EvidenceRecord} from '../../evidence-lib';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const escapeLike=(s:string)=>s.replace(/[\\%_]/g,c=>'\\'+c);
export async function GET(request:Request){
 try{
  const user=await getChatGPTUser(),params=new URL(request.url).searchParams,id=params.get('id')||'';
  const sources=structuredClone(publicSeed.records) as EvidenceRecord[],known=new Set(sources.map(r=>r.evidence_id));
  const {library}=await loadPositionLibrary();
  for(const group of library.evidence)for(const entry of group.entries){
   if(known.has(entry.id))continue;known.add(entry.id);
   const profiles=library.profiles.filter(p=>p.interface.evidence_ids.includes(entry.id)||p.interface.fibers.some(f=>f.evidence_ids.includes(entry.id)||f.directions.some(d=>[...d.evidence_ids,...(d.effect_evidence_ids||[])].includes(entry.id))));
   sources.push({schema:'iconpcl-evidence-record/v1',evidence_id:entry.id,record_kind:'source_claim',classification:entry.classification,title:entry.claim,claim:entry.claim,scope:'Administrator-uploaded model-bound claim; review status retained.',recorded_at:entry.source.accessed,sources:[{title:entry.source.title,url:entry.source.url||'',locator:entry.source.section,checked_date:entry.source.accessed}],related_records:profiles.flatMap(p=>{const model=catalog.records.find(r=>r.equipment_id===p.equipment_id);return [{record_type:'equipment',record_id:p.equipment_id,label:p.manufacturer+' '+p.model_name},{record_type:'equipment_class',record_id:model?.category_id||'',label:''},...(model?.related_process_ids||'').split(';').filter(Boolean).map(id=>({record_type:'process',record_id:id,label:'Model planning association'}))];}),source_evidence_ids:[],supersedes_id:'',context:{subject:group.subject,verification:entry.verification}});
  }
  const owner=user?.userId||'__anonymous__';
  if(id){
   if(!/^[a-zA-Z0-9_-]{1,160}$/.test(id))return json({error:'Invalid evidence ID.'},400);
   const source=sources.find(r=>r.evidence_id===id);if(source)return json({record:source,visibility:'public',related:[]});
   const found=await env.DB!.prepare("SELECT payload,owner_id FROM evidence_records WHERE (evidence_id=? OR json_extract(payload,'$.context.stable_evidence_id')=?) AND owner_id IN (?,'__shared__') ORDER BY revision DESC LIMIT 1").bind(id,id,owner).first<{payload:string;owner_id:string}>();
   if(!found)return json({error:'Evidence was not found in the public register or your account.'},404);
   const record=JSON.parse(found.payload) as EvidenceRecord,related:EvidenceRecord[]=[];
   const linked=record.related_records.filter(r=>r.record_type==='sequence').map(r=>r.record_id);
   for(const eid of linked){const parent=await env.DB!.prepare("SELECT payload FROM evidence_records WHERE evidence_id=? AND owner_id IN (?,'__shared__')").bind(eid,owner).first<{payload:string}>();if(parent)related.push(JSON.parse(parent.payload));}
   let workflow_snapshot:unknown=null;
   if(record.record_kind==='workflow_combination'){
    const row=await env.DB!.prepare('SELECT v.payload FROM process_workflow_versions v JOIN process_workflows w ON w.workflow_id=v.workflow_id WHERE v.workflow_id=? AND v.revision=? AND w.user_id=?').bind(String(record.context.workflow_id),Number(record.context.workflow_revision),owner).first<{payload:string}>();
    if(row)workflow_snapshot=JSON.parse(row.payload);
   }
   return json({record,related,workflow_snapshot,workflow_integrity_verified:workflow_snapshot?await evidenceDigest(workflow_snapshot)===record.context.workflow_sha256:null,visibility:found.owner_id==='__shared__'?'public':'your_account'});
  }
  const query=(params.get('q')||'').slice(0,300),kind=params.get('kind')||'',route=params.get('route')||'',scope=params.get('scope')||'all';
  const limit=Math.max(1,Math.min(100,Number(params.get('limit'))||30)),offset=Math.max(0,Math.floor(Number(params.get('offset'))||0));
  if(!['all','public','mine'].includes(scope)||kind&&!['source_claim','control_action','instrument_sequence','workflow_combination','planned_output','workflow_assessment','property_assessment'].includes(kind))return json({error:'Choose a valid evidence filter.'},400);
  if(scope==='mine'&&!user)return json({error:'Sign in to read your saved evidence.'},401);
  const clauses=[scope==='mine'?"owner_id=?":scope==='public'?"owner_id='__shared__'":"owner_id IN (?,'__shared__')"],values:(string|number)[]=scope==='public'?[]:[owner];
  if(kind){clauses.push('record_kind=?');values.push(kind);}
  for(const term of query.trim().split(/\s+/).filter(Boolean)){clauses.push("payload LIKE ? ESCAPE '\\'");values.push('%'+escapeLike(term)+'%');}
  if(route){clauses.push("EXISTS (SELECT 1 FROM json_each(evidence_records.payload,'$.related_records') r WHERE json_extract(r.value,'$.record_type')='process' AND json_extract(r.value,'$.record_id')=?)");values.push(route);}
  const where=clauses.join(' AND '),count=await env.DB!.prepare('SELECT count(*) n FROM evidence_records WHERE '+where).bind(...values).first<{n:number}>(),storedCount=count?.n||0;
  const sourceMatches=scope==='mine'?[]:sources.filter(r=>evidenceMatches(r,query,kind,route));
  const rows=offset<storedCount?await env.DB!.prepare('SELECT payload,owner_id FROM evidence_records WHERE '+where+' ORDER BY created_at DESC,evidence_id DESC LIMIT ? OFFSET ?').bind(...values,limit,offset).all<{payload:string;owner_id:string}>():{results:[]};
  const records=rows.results.map(r=>({...JSON.parse(r.payload),visibility:r.owner_id==='__shared__'?'public':'your_account'}));
  records.push(...sourceMatches.slice(Math.max(0,offset-storedCount),Math.max(0,offset-storedCount)+limit-records.length).map(r=>({...r,visibility:'public'})));
  return json({records,total:storedCount+sourceMatches.length,offset,limit,can_read_private:!!user,public_source_count:sources.length});
 }catch(e){console.error('Evidence read failed',e);return json({error:'The evidence register could not be loaded. Saved records remain stored; retry the request.'},500);}
}
