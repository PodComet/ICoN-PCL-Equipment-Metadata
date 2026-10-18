import {env} from 'cloudflare:workers';
import seed from '../../data/catalog.json';
import {getChatGPTUser} from '../../chatgpt-auth';
import {loadSharedCatalog,personalRecord} from '../../catalog-store';
import {newProcessId,validateWorkflow,type ProcessWorkflow} from '../../process-lib';
import {normalizeWorkflowClasses} from '../../process-classification-lib';
import materials from '../../data/process-materials.json';
import componentSeed from '../../data/components.json';
import scienceSeed from '../../data/process-science.json';
import {materialPlanFor,type MaterialDataset} from '../../process-materials-lib';
import type {ComponentData} from '../../component-lib';
import type {ConditionLibrary} from '../../process-condition-lib';
import {materialOutcome} from '../../process-outcome-lib';
import {expectedProperties} from '../../process-properties-lib';
import {workflowReadiness,type JsonValue} from '../../process-lib';
import {workflowSequenceEvidence} from '../../sequence-evidence-lib';
import {evidenceStatements} from '../../evidence-store';
import {loadPositionLibrary} from '../../position-store';

const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
type Stored={workflow_id:string;payload:string;revision:number;created_at:string;updated_at:string};
const saved=(r:Stored)=>({workflow:JSON.parse(r.payload),revision:r.revision,created_at:r.created_at,updated_at:r.updated_at});
export async function GET(request:Request){
 try{
  const user=await getChatGPTUser();if(!user)return json({error:'Sign in to load saved workflows.'},401);
  const params=new URL(request.url).searchParams,id=params.get('id'),revision=params.get('revision');
  if(id){
   const row=await env.DB!.prepare('SELECT workflow_id,payload,revision,created_at,updated_at FROM process_workflows WHERE workflow_id=? AND user_id=?').bind(id,user.userId).first<Stored>();
   if(!row)return json({error:'Workflow was not found in your account.'},404);
   if(revision){
    if(!/^\d+$/.test(revision))return json({error:'Invalid revision.'},400);
    const version=await env.DB!.prepare('SELECT payload,revision,created_at FROM process_workflow_versions WHERE workflow_id=? AND revision=?').bind(id,Number(revision)).first<{payload:string;revision:number;created_at:string}>();
    if(!version)return json({error:'Revision not found.'},404);
    return json({workflow:JSON.parse(version.payload),revision:version.revision,created_at:row.created_at,updated_at:version.created_at});
   }
   const history=await env.DB!.prepare('SELECT revision,created_at FROM process_workflow_versions WHERE workflow_id=? ORDER BY revision DESC LIMIT 100').bind(id).all();
   return json({...saved(row),history:history.results});
  }
  const rows=await env.DB!.prepare('SELECT workflow_id,route_id,name,revision,created_at,updated_at FROM process_workflows WHERE user_id=? ORDER BY updated_at DESC LIMIT 500').bind(user.userId).all();
  return json({workflows:rows.results});
 }catch(e){console.error('Workflow read failed',e);return json({error:'Saved workflows could not be loaded. Your current plan is still open.'},500);}
}
export async function PUT(request:Request){
 try{
  const user=await getChatGPTUser();if(!user)return json({error:'Sign in to save workflows.'},401);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Same-origin requests required.'},403);
  if(Number(request.headers.get('content-length')||0)>2_000_000)return json({error:'Workflow exceeds 2 MB.'},413);
  const text=await request.text();if(text.length>2_000_000)return json({error:'Workflow exceeds 2 MB.'},413);
  let input:any;try{input=JSON.parse(text)}catch{return json({error:'Invalid workflow data.'},400)}
  if(!input||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0||!input.workflow||typeof input.workflow.workflow_id!=='string')return json({error:'Invalid workflow revision or identity.'},400);
  let previous:Stored|null=null;
  if(input.workflow.workflow_id){
   previous=await env.DB!.prepare('SELECT workflow_id,payload,revision,created_at,updated_at FROM process_workflows WHERE workflow_id=? AND user_id=?').bind(input.workflow.workflow_id,user.userId).first<Stored>();
   if(!previous)return json({error:'Workflow was not found in your account.'},404);
  }
  if(input.expected_revision!==(previous?.revision||0))return json({error:'This workflow changed in another window. Export your current draft, then reopen the saved workflow.'},409);
  const shared=await loadSharedCatalog(),byId=new Map(shared.records.map(r=>[r.equipment_id,r]));
  const edits=await env.DB!.prepare('SELECT equipment_id,payload FROM equipment_edits WHERE user_id=?').bind(user.userId).all<{equipment_id:string;payload:string}>();
  for(const edit of edits.results)byId.set(edit.equipment_id,personalRecord(byId.get(edit.equipment_id),JSON.parse(edit.payload)));
  const records=[...byId.values()],existing=previous?normalizeWorkflowClasses(JSON.parse(previous.payload),seed.steps,records,seed.categories):undefined;
  // Derived evidence is server-owned and regenerated from the validated declaration.
  // Removing it first also keeps prior snapshots out of extension complexity limits.
  if(input.workflow.extensions&&typeof input.workflow.extensions==='object')for(const key of ['output_evidence_snapshot','output_evidence_revision','control_evidence_snapshot'])delete input.workflow.extensions[key];
  if(Array.isArray(input.workflow.steps))for(const step of input.workflow.steps)if(Array.isArray(step?.slots))for(const slot of step.slots)if(slot?.instrument?.extensions&&typeof slot.instrument.extensions==='object')delete slot.instrument.extensions.saved_control_evidence;
  let workflow:ProcessWorkflow;try{workflow=validateWorkflow(input.workflow,seed.routes,records,existing)}catch(e){return json({error:e instanceof Error?e.message:'Invalid workflow.'},400)}
  const now=new Date().toISOString(),revision=(previous?.revision||0)+1;
  if(!previous)workflow.workflow_id=newProcessId('PROC-'+workflow.route_id);
  workflow.extensions.output_evidence_revision=revision;
  const plan=materialPlanFor(workflow),science=scienceSeed as unknown as ConditionLibrary,complete=workflowReadiness(workflow,seed.steps).complete;
  const outcome=materialOutcome(plan,materials as MaterialDataset,workflow,componentSeed as unknown as ComponentData);
  const assessments=expectedProperties(workflow,plan,componentSeed as unknown as ComponentData,science,complete);
  const used=new Set([...assessments.flatMap(p=>p.source_evidence_ids),...outcome.conditions.flatMap(s=>s.conditions.flatMap(c=>science.conditions.filter(t=>t.template_id===c.reference_condition_id).map(t=>t.evidence_id)))]);
  workflow.extensions.output_evidence_snapshot={schema:'process-output-evidence/v1',revision,assessed_at:now,...outcome,property_assessments:assessments,source_evidence:science.evidence.filter(e=>used.has(e.evidence_id))} as unknown as JsonValue;
  const controls=await workflowSequenceEvidence(workflow,revision,now,(await loadPositionLibrary()).library,existing);workflow=controls.workflow;
  const payload=JSON.stringify(workflow),created=previous?.created_at||now;
  const statement=previous?
   env.DB!.prepare('UPDATE process_workflows SET name=?,payload=?,revision=CASE WHEN revision=? THEN revision+1 ELSE NULL END,updated_at=? WHERE workflow_id=? AND user_id=?').bind(workflow.name,payload,input.expected_revision,now,workflow.workflow_id,user.userId):
   env.DB!.prepare('INSERT INTO process_workflows(workflow_id,user_id,route_id,name,payload,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(workflow.workflow_id,user.userId,workflow.route_id,workflow.name,payload,revision,created,now);
  try{await env.DB!.batch([statement,env.DB!.prepare('INSERT INTO process_workflow_versions(workflow_id,revision,payload,created_at) VALUES(?,?,?,?)').bind(workflow.workflow_id,revision,payload,now),...evidenceStatements(controls.records,user.userId)]);}catch(e){
   if(previous){const latest=await env.DB!.prepare('SELECT revision FROM process_workflows WHERE workflow_id=? AND user_id=?').bind(workflow.workflow_id,user.userId).first<{revision:number}>();if(latest?.revision!==input.expected_revision)return json({error:'Another window saved this workflow first. Your draft remains open; export it before reopening the latest version.'},409);}
   throw e;
  }
  return json({workflow,revision,created_at:created,updated_at:now});
 }catch(e){console.error('Workflow save failed',e);return json({error:'The workflow could not be saved. Your draft is still open; you can export it.'},500);}
}
