import {env} from 'cloudflare:workers';
import {freezeRecipe,verifyRecipeBytes,readRunLinks,validateRunLinks,runBindingIssues,isExperiment,type RecipeSnapshot,type MachineUnit,type RunLinks} from './workflow-token-lib';
import {savedSequenceRef} from './sequence-evidence-lib';
import {evidenceDigest,sealEvidence,type EvidenceRecord} from './evidence-lib';
import type {ProcessWorkflow} from './process-lib';
import type {ResearchRecord} from './research-lib';

export async function machineUnitsFor(owner:string):Promise<MachineUnit[]>{const rows=await env.DB!.prepare('SELECT payload FROM machine_units WHERE owner_id=? ORDER BY created_at,machine_token LIMIT 2001').bind(owner).all<{payload:string}>();if(rows.results.length>2000)throw new Error('Machine registry capacity reached.');return rows.results.map(r=>JSON.parse(r.payload));}
export const recipeStatement=(owner:string,s:RecipeSnapshot,now:string)=>env.DB!.prepare('INSERT OR IGNORE INTO recipe_manifests(owner_id,recipe_token,manifest_text,created_at) VALUES(?,?,?,?)').bind(owner,s.recipe_token,s.manifest_text,now);
export async function frozenRecipe(owner:string,token:string):Promise<RecipeSnapshot|null>{const row=await env.DB!.prepare('SELECT manifest_text FROM recipe_manifests WHERE owner_id=? AND recipe_token=?').bind(owner,token).first<{manifest_text:string}>();if(!row)return null;if(!await verifyRecipeBytes(token,row.manifest_text))throw new Error('Stored recipe checksum did not match.');return {recipe_token:token,hash_profile:'sha256-exact-manifest-bytes/v1',manifest_text:row.manifest_text,manifest:JSON.parse(row.manifest_text)};}
export async function recipeForWorkflow(owner:string,workflow:ProcessWorkflow){
 const token=workflow.extensions.recipe_token;if(typeof token==='string'){const saved=await frozenRecipe(owner,token);if(!saved)throw new Error('The frozen recipe manifest is unavailable.');return saved;}
 const ids=[...new Set(workflow.steps.flatMap(s=>s.slots).flatMap(s=>s.instrument?savedSequenceRef(s.instrument)?.evidence_id||[]:[]))];
 const records:EvidenceRecord[]=[];
 for(const id of ids){const row=await env.DB!.prepare('SELECT payload FROM evidence_records WHERE evidence_id=? AND owner_id=?').bind(id,owner).first<{payload:string}>();if(row)records.push(JSON.parse(row.payload));}
 return freezeRecipe(workflow,records);
}
export async function recipeForVersion(owner:string,id:string,revision:number){
 const row=await env.DB!.prepare('SELECT v.payload FROM process_workflow_versions v JOIN process_workflows w ON w.workflow_id=v.workflow_id WHERE v.workflow_id=? AND v.revision=? AND w.user_id=?').bind(id,revision,owner).first<{payload:string}>();
 if(!row)throw new Error('The saved recipe revision was not found in your account.');return {workflow:JSON.parse(row.payload) as ProcessWorkflow,recipe:await recipeForWorkflow(owner,JSON.parse(row.payload))};
}
export async function attachWorkflowRecipe(workflow:ProcessWorkflow,records:EvidenceRecord[]){
 const recipe=await freezeRecipe(workflow,records);workflow.extensions.recipe_token=recipe.recipe_token;
 for(let i=0;i<records.length;i++)if(records[i].record_kind==='workflow_combination'){
  records[i].context.workflow_sha256=await evidenceDigest(workflow);records[i]=await sealEvidence(records[i]);
 }
 return {workflow,records,recipe};
}

async function bindResearchSource(owner:string,id:string,revision:number|null,sharedSpace:string|null){
 const current=await env.DB!.prepare('SELECT owner_id,space_id,access_scope,revision,payload FROM research_records WHERE record_id=? AND owner_id=?').bind(id,owner).first<{owner_id:string;space_id:string;access_scope:string;revision:number;payload:string}>();
 if(!current)throw new Error('Linked material or specimen was not found in your account.');
 if(sharedSpace&&(current.access_scope!=='space'||current.space_id!==sharedSpace))throw new Error('Share linked material/specimen records with viewers of this same Space before sharing the run.');
 const rev=revision||current.revision;
 const version=await env.DB!.prepare('SELECT payload FROM research_versions WHERE record_id=? AND revision=?').bind(id,rev).first<{payload:string}>();if(!version)throw new Error('The linked material/specimen revision was not found.');
 const r=JSON.parse(version.payload) as ResearchRecord;
 if(r.kind!=='object'||!['MATERIAL','SAMPLE'].includes(r.type_code))throw new Error('Link a material or sample object.');
 return {revision:rev,snapshot:{name:r.name,type_code:r.type_code,status:r.status}};
}
export async function bindExperimentTokens(owner:string,record:ResearchRecord,previous:ResearchRecord|undefined,space:string){
 if(!isExperiment(record))return null;
 const raw=record.properties.ontology_run_tokens;
 // Do not turn an old, completed experiment into a newly asserted execution.
 if(previous&&!raw&&!readRunLinks(previous)&&previous.status!=='planned')return null;
 const links=validateRunLinks(raw,record,previous);let recipe:RecipeSnapshot|null=null;
 if(record.workflow_id&&record.workflow_revision){
  const version=await recipeForVersion(owner,record.workflow_id,record.workflow_revision);recipe=version.recipe;
  const old=previous?readRunLinks(previous):null;
  if(old?.recipe_token&&old.recipe_token!==recipe.recipe_token)throw new Error('The experiment keeps its original immutable recipe token. Create a new experiment for another recipe.');
  links.recipe_token=recipe.recipe_token;
 }else if(links.recipe_token)throw new Error('Choose the saved workflow revision for this recipe.');
 const units=await machineUnitsFor(owner);
 if(links.machine_bindings.length&&!recipe)throw new Error('Choose a saved recipe before binding its machines.');
 if(recipe){const allowed=new Set(recipe.manifest.machine_roles.map(r=>r.role_id));for(const b of links.machine_bindings){const unit=units.find(u=>u.machine_token===b.machine_token),role=recipe.manifest.machine_roles.find(r=>r.role_id===b.machine_role);if(!unit||!allowed.has(b.machine_role)||!role?.catalog_equipment_ids.includes(unit.catalog_equipment_id))throw new Error('Choose a registered machine matching the saved recipe model.');}}
 for(const b of links.material_bindings)if(b.record_id){const source=await bindResearchSource(owner,b.record_id,b.record_revision,record.access_scope==='space'?space:null);b.record_revision=source.revision;b.record_snapshot=source.snapshot;}
 for(const b of links.specimen_bindings){
  if(b.kind==='reported'&&!['completed','withdrawn'].includes(record.status))throw new Error('Keep planned specimens as expected until the experiment is completed.');
  if(b.record_id){const source=await bindResearchSource(owner,b.record_id,b.record_revision,record.access_scope==='space'?space:null);if(b.kind==='reported'&&source.snapshot.status!=='completed')throw new Error('A reported specimen must link to a completed sample/material record.');b.record_revision=source.revision;b.record_snapshot=source.snapshot;}
  else if(b.kind==='reported')throw new Error('Link a completed sample/material record for each reported specimen.');
 }
 const issues=recipe?runBindingIssues(links,recipe.manifest,units):['Choose an immutable saved recipe.'];
 if(['in_progress','completed'].includes(record.status)&&issues.length)throw new Error('Complete this run’s bindings first: '+issues.join(' '));
 record.properties.ontology_run_tokens=links;
 return {recipe,issues,links};
}
