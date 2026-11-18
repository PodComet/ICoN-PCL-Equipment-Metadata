import {env} from 'cloudflare:workers';
import {getCurrentUser} from '../../current-user';
import {blankResearch,newResearchId,rootSpace,type ResearchRecord} from '../../research-lib';
import {researchRows,researchRow,savedResearch,canReadResearch,researchFence,advanceResearchFence,researchFenceChanged,sameResearchOrigin,boundedResearchBody,researchJson as json} from '../../research-store';
import {recipeForVersion,recipeStatement,bindExperimentTokens,machineUnitsFor,frozenRecipe} from '../../workflow-token-store';
import {blankRunLinks,RUN_LINKS_KEY,isExperiment,runToken,readRunLinks} from '../../workflow-token-lib';
import {materialPlanFor} from '../../process-materials-lib';

export async function POST(request:Request){try{
 const user=await getCurrentUser();if(!user)return json({error:'Sign in to create experiment runs.'},401);if(!sameResearchOrigin(request))return json({error:'Same-origin requests required.'},403);
 let input:any;try{input=JSON.parse(new TextDecoder().decode(await boundedResearchBody(request,6000)))}catch{return json({error:'Invalid experiment request.'},400)}
 if(typeof input.workflow_id!=='string'||!Number.isSafeInteger(input.workflow_revision)||input.workflow_revision<1||typeof input.request_key!=='string'||!/^[0-9a-f-]{36}$/i.test(input.request_key))return json({error:'Choose a saved workflow revision.'},400);
 const prior=await env.DB!.prepare("SELECT * FROM research_records WHERE owner_id=? AND kind='collection' AND json_extract(payload,'$.properties.run_creation_key')=?").bind(user.userId,input.request_key).first<any>();
 if(prior){const r=JSON.parse(prior.payload);if(r.workflow_id!==input.workflow_id||r.workflow_revision!==input.workflow_revision)return json({error:'This run request key belongs to another recipe.'},409);return json(savedResearch(prior,user));}
 const fence=await researchFence(user.userId),owned=await researchRows(user,true),records=owned.map(r=>JSON.parse(r.payload) as ResearchRecord),created:ResearchRecord[]=[];
 const version=await recipeForVersion(user.userId,input.workflow_id,input.workflow_revision),workflow=version.workflow,recipe=version.recipe;
 let space=records.find(r=>r.kind==='space'&&r.code==='WORKFLOW_RUNS');
 if(!space){space={...blankResearch('space'),record_id:newResearchId(),code:'WORKFLOW_RUNS',name:'Workflow experiments'};created.push(space);}
 let project=records.find(r=>r.kind==='project'&&r.container_id===space!.record_id&&r.code==='RUNS');
 if(!project){project={...blankResearch('project'),record_id:newResearchId(),container_id:space.record_id,code:'RUNS',name:'Saved recipe experiments'};created.push(project);}
 const record:ResearchRecord={...blankResearch('collection'),record_id:newResearchId(),container_id:project.record_id,type_code:'EXPERIMENT',code:'RUN_'+crypto.randomUUID().replaceAll('-','').toUpperCase(),name:workflow.name+' — experiment',workflow_id:workflow.workflow_id,workflow_revision:input.workflow_revision,process_ids:[workflow.route_id],equipment_ids:[...new Set(recipe.manifest.machine_roles.flatMap(r=>r.catalog_equipment_ids))],category_ids:[...new Set(recipe.manifest.machine_roles.flatMap(r=>r.category_ids))],properties:{run_creation_key:input.request_key}};
 const links=blankRunLinks(),units=await machineUnitsFor(user.userId);
 for(const role of recipe.manifest.machine_roles){const assigned=workflow.steps.flatMap(s=>s.slots).find(s=>role.placement_ids.includes(s.slot_id)&&s.instrument?.extensions.machine_token);const token=assigned?.instrument?.extensions.machine_token;if(typeof token==='string'&&units.some(u=>u.machine_token===token&&role.catalog_equipment_ids.includes(u.catalog_equipment_id)))links.machine_bindings.push({machine_role:role.role_id,machine_token:token});}
 const plan=materialPlanFor(workflow);
 links.material_bindings=plan.inputs.map((m,i)=>({binding_id:'MB-'+crypto.randomUUID(),input_role:workflow.extensions.recipe_materials_mode==='per_run'?'feedstock':'material-'+(i+1),name:m.name,batch_id:'',amount:m.amount,record_id:'',record_revision:null}));
 if(recipe.manifest.workflow_kind!=='computational')links.specimen_bindings=[{specimen_id:'SPC-'+crypto.randomUUID(),label:plan.expected_output||workflow.route_name,kind:'expected',record_id:'',record_revision:null,notes:''}];
 record.properties[RUN_LINKS_KEY]=links;
 const spaceId=rootSpace(record,[...records,...created,record]);await bindExperimentTokens(user.userId,record,undefined,spaceId);
 created.push(record);if(owned.length+created.length>500)return json({error:'Research workspace capacity reached. No run was created.'},409);
 const now=new Date().toISOString();
 const statements=[advanceResearchFence(user.userId,fence)];
 for(const r of created){const payload=JSON.stringify(r),root=rootSpace(r,[...records,...created]);statements.push(env.DB!.prepare('INSERT INTO research_records(record_id,owner_id,space_id,kind,container_id,code,payload,revision,access_scope,created_at,updated_at) VALUES(?,?,?,?,?,?,?,1,?,?,?)').bind(r.record_id,user.userId,root,r.kind,r.container_id,r.code,payload,r.access_scope,now,now),env.DB!.prepare('INSERT INTO research_versions(record_id,revision,payload,actor_id,created_at) VALUES(?,1,?,?,?)').bind(r.record_id,payload,user.userId,now));}
 statements.push(recipeStatement(user.userId,recipe,now));
 try{await env.DB!.batch(statements)}catch(e){if(await researchFenceChanged(user.userId,fence))return json({error:'The workspace changed. Retry creating this run; the same request will not duplicate it.'},409);throw e;}
 return json({record,revision:1,created_at:now,updated_at:now,can_edit:true,space_id:spaceId},201);
}catch(e){console.error('Experiment creation failed',e);return json({error:'The experiment was not created. Your saved recipe is unchanged.'},503)}}

export async function GET(request:Request){try{
 const user=await getCurrentUser();if(!user)return json({error:'Sign in to retrieve experiment runs.'},401);
 const id=new URL(request.url).searchParams.get('id')||'',row=await researchRow(id);if(!row||!await canReadResearch(row,user))return json({error:'Experiment not found or not shared.'},404);
 const record=JSON.parse(row.payload) as ResearchRecord;if(!isExperiment(record))return json({error:'Choose an EXPERIMENT collection.'},400);if(record.status==='withdrawn')return json({error:'This experiment has been withdrawn. Metadata remain available, but package downloads are blocked.'},410);
 const links=readRunLinks(record),recipe=links?.recipe_token?await frozenRecipe(row.owner_id,links.recipe_token):null;
 const machines=links?(await machineUnitsFor(row.owner_id)).filter(u=>links.machine_bindings.some(b=>b.machine_token===u.machine_token)).map(({label,...u})=>({...u,label:u.manufacturer+' '+u.model_name})):[];
 const body={schema:'iconpcl-experiment-run/v1',run_token:runToken(record.record_id),record_id:record.record_id,record_revision:row.revision,workflow_id:record.workflow_id,workflow_revision:record.workflow_revision,status:record.status,links,recipe:recipe?{recipe_token:recipe.recipe_token,hash_profile:recipe.hash_profile,manifest_text:recipe.manifest_text}:null,machines,scope:'Versioned user-declared experiment metadata. Planned inputs/specimens remain distinct from reported completed records. This is not an autonomous device-execution log.'};
 return new Response(JSON.stringify(body,null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="'+record.code+'-three-tokens.json"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){console.error('Experiment export failed',e);return json({error:'The experiment token package could not be exported.'},503)}}
