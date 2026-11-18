import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createWorkflow,newStep,assignInstrument,reuseInstrument,updateInstrumentAssignment} from '../app/process-lib.ts';
import {freezeRecipe,verifyRecipeBytes,blankRunLinks,validateRunLinks,runBindingIssues,runToken,addRunTokenGraph,RUN_LINKS_KEY,workflowMachineBindingIssues} from '../app/workflow-token-lib.ts';
import {newCondition,withStepConditions} from '../app/process-condition-lib.ts';
import {blankResearch} from '../app/research-lib.ts';
import {newStartingMaterial,withMaterialPlan} from '../app/process-materials-lib.ts';
const catalog=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url))),model=catalog.records.find(r=>r.equipment_id==='REQ-EQ-005');
const uuid='11111111-1111-4111-8111-111111111111';
function workflow(){let w=createWorkflow(catalog.routes.find(r=>r.route_id==='P48'),catalog.steps);w.workflow_id='PROC-P48-'+uuid;w.name='Synthetic token test';w.steps=[newStep(['M117']),newStep(['M117'])];w=assignInstrument(w,w.steps[0].slots[0].slot_id,model);w=reuseInstrument(w,w.steps[1].slots[0].slot_id,w.steps[0].slots[0].slot_id);return w;}
function experiment(){return {...blankResearch('collection'),record_id:'RSR-'+uuid,workflow_id:'PROC-P48-'+uuid,workflow_revision:1};}

test('recipe token verifies exact downloaded bytes and excludes save/evidence timestamps, IDs and prices',async()=>{
 const w=workflow(),first=await freezeRecipe(w),next=structuredClone(w);
 next.extensions.output_evidence_snapshot={assessed_at:'later',products:[{evidence_id:'random'}]};next.extensions.control_evidence_snapshot={evidence_id:'new-random'};next.extensions.recipe_token='sha256:'+'0'.repeat(64);next.extensions.process_budget_snapshot={price:999};
 for(const s of next.steps)for(const slot of s.slots){slot.instrument.price_snapshot.low=999999;slot.instrument.extensions.saved_control_evidence={evidence_id:'different'};slot.instrument.extensions.machine_token='urn:uuid:22222222-2222-4222-8222-222222222222';}
 const second=await freezeRecipe(next);assert.equal(first.recipe_token,second.recipe_token);
 assert.equal(await verifyRecipeBytes(first.recipe_token,first.manifest_text),true);
 assert.equal(first.recipe_token,'sha256:'+createHash('sha256').update(first.manifest_text).digest('hex'));
 assert.equal(await verifyRecipeBytes(first.recipe_token,JSON.stringify(first.manifest,null,2)),false);
});

test('settings and step conditions are recipe content, while material binding can be left to each run',async()=>{
 const w=workflow(),first=await freezeRecipe(w),next=structuredClone(w);next.steps[0].slots[0].instrument.operating_parameters.power={value:125,unit:'W'};
 assert.notEqual((await freezeRecipe(next)).recipe_token,first.recipe_token);
 const condition={...newCondition('temperature'),value:60,unit:'°C'};const conditioned=withStepConditions(w,w.steps[0].step_id,[condition]);assert.notEqual((await freezeRecipe(conditioned)).recipe_token,first.recipe_token);
 condition.value=70;assert.notEqual((await freezeRecipe(withStepConditions(w,w.steps[0].step_id,[condition]))).recipe_token,(await freezeRecipe(conditioned)).recipe_token);
 const a=newStartingMaterial({name:'Powder A',role:'feedstock'},'500 g');
 let material=withMaterialPlan(w,{schema:'process-materials/v1',route_id:w.route_id,inputs:[a],expected_output:'Coupon',example_id:''});
 const included=await freezeRecipe(material);material.extensions.material_plan.inputs[0].name='Powder B';assert.notEqual((await freezeRecipe(material)).recipe_token,included.recipe_token);
 material.extensions.recipe_materials_mode='per_run';const omitted=await freezeRecipe(material);material.extensions.material_plan.inputs[0].amount='700 g';material.extensions.material_plan.inputs[0].name='Powder C';assert.equal((await freezeRecipe(material)).recipe_token,omitted.recipe_token);
 assert.equal(omitted.manifest.material_requirements.length,0);
});

test('reused machine occurrences form one role and each recipe can declare several machine roles',async()=>{
 const w=workflow(),first=await freezeRecipe(w);assert.equal(first.manifest.machine_roles.length,1);assert.equal(first.manifest.machine_roles[0].placement_ids.length,2);
 const distinct=assignInstrument(w,w.steps[1].slots[0].slot_id,model);assert.equal((await freezeRecipe(distinct)).manifest.machine_roles.length,2);
});

test('registering or clearing a reused physical unit follows every occurrence without overwriting settings',()=>{
 const w=workflow(),first=w.steps[0].slots[0].instrument,token='urn:uuid:'+uuid;
 w.steps[1].slots[0].instrument.operating_parameters.local_setting=25;
 const registered=updateInstrumentAssignment(w,w.steps[0].slots[0].slot_id,{...first,extensions:{...first.extensions,machine_token:token}});
 assert.ok(registered.steps.every(s=>s.slots[0].instrument.extensions.machine_token===token));
 assert.equal(registered.steps[1].slots[0].instrument.operating_parameters.local_setting,25);
 const units=[{machine_token:token,catalog_equipment_id:model.equipment_id}];
 assert.deepEqual(workflowMachineBindingIssues(registered,units),[]);
 const inconsistent=structuredClone(registered);delete inconsistent.steps[1].slots[0].instrument.extensions.machine_token;
 assert.ok(workflowMachineBindingIssues(inconsistent,units).some(s=>s.includes('Reused occurrences')));
 const cleared=updateInstrumentAssignment(registered,registered.steps[0].slots[0].slot_id,first);
 assert.ok(cleared.steps.every(s=>!s.slots[0].instrument.extensions.machine_token));
});

test('complete 3D design, dimensions and checksum are frozen; incomplete geometry remains a draft declaration',async()=>{
 const w=workflow();w.extensions.recipe_geometry={schema:'iconpcl-geometry/v1',shape:'Annular coupon',design_url:'https://example.org/coupon.step',design_sha256:'a'.repeat(64),format:'model/step',coordinate_frame:'right handed mm',build_orientation:'Z up',dimensions:[{name:'outer_diameter',value:12,unit:'mm'}],tolerance:'Inspect after manufacture'};
 const first=await freezeRecipe(w);assert.equal(first.manifest.workflow_kind,'manufacturing_3d');assert.equal(first.manifest.geometry.dimensions.outer_diameter.unit_uri,'http://qudt.org/vocab/unit/MilliM');
 w.extensions.recipe_geometry.dimensions[0].value=14;assert.notEqual((await freezeRecipe(w)).recipe_token,first.recipe_token);
 w.extensions.recipe_geometry.design_sha256='';const draft=await freezeRecipe(w);assert.equal(draft.manifest.geometry,undefined);assert.ok(draft.manifest.steps[0].parameters.some(p=>p.parameter_id==='draft_3d_geometry'));
});

test('each experiment retains one server-derived run UUID and cannot silently change its pinned recipe',()=>{
 const r=experiment(),links=blankRunLinks();assert.equal(validateRunLinks(links,r).run_token,runToken(r.record_id));
 const old=structuredClone(r);old.properties[RUN_LINKS_KEY]={...validateRunLinks(links,r),recipe_token:'sha256:'+'a'.repeat(64)};
 const changed=structuredClone(r);changed.workflow_revision=2;assert.throws(()=>validateRunLinks(links,changed,old),/original recipe revision/);
 assert.throws(()=>validateRunLinks({...links,run_token:'urn:uuid:22222222-2222-4222-8222-222222222222'},r),/server/);
 const another={...r,record_id:'RSR-22222222-2222-4222-8222-222222222222'};assert.notEqual(validateRunLinks(links,another).run_token,validateRunLinks(links,r).run_token);
});

test('run bindings require registered matching models, material batches/amounts and specimens',async()=>{
 const recipe=await freezeRecipe(workflow()),links=blankRunLinks(),role=recipe.manifest.machine_roles[0],token='urn:uuid:'+uuid;
 assert.ok(runBindingIssues(links,recipe.manifest,[]).some(x=>x.includes('physical unit')));
 const unit={machine_token:token,catalog_equipment_id:model.equipment_id};links.machine_bindings=[{machine_role:role.role_id,machine_token:token}];links.material_bindings=[{binding_id:'MB-1',input_role:'feedstock',name:'316L',batch_id:'LOT-1',amount:'500 g',record_id:'',record_revision:null}];links.specimen_bindings=[{specimen_id:'SPC-'+uuid,label:'Coupon',kind:'expected',record_id:'',record_revision:null,notes:''}];
 assert.deepEqual(runBindingIssues(links,recipe.manifest,[unit]),[]);assert.ok(runBindingIssues(links,recipe.manifest,[{...unit,catalog_equipment_id:'another-model'}]).length);
});

test('RO-Crate token links stay explicit and never turn expected specimens into observed generation',async()=>{
 const r=experiment(),recipe=await freezeRecipe(workflow()),links=blankRunLinks();links.recipe_token=recipe.recipe_token;links.run_token=runToken(r.record_id);links.machine_bindings=[{machine_role:'machine-1',machine_token:'urn:uuid:'+uuid}];links.specimen_bindings=[{specimen_id:'SPC-'+uuid,label:'Expected coupon',kind:'expected',record_id:'',record_revision:null,notes:''}];r.properties[RUN_LINKS_KEY]=links;
 const entity={'@id':'metadata-record'},graph=[entity];addRunTokenGraph(graph,entity,r,'https://example.org');assert.equal(entity['icon:runToken'],links.run_token);assert.ok(graph.some(n=>n['dct:identifier']===recipe.recipe_token));assert.ok(graph.some(n=>n['icon:specimenStatus']==='expected'));assert.ok(graph.every(n=>!n['prov:used']&&!n['prov:wasGeneratedBy']));
});
