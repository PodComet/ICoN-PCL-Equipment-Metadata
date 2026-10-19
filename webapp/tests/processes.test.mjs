import {usdConversion} from '../app/currency-lib.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assignInstrument,budgetLabel,clearWorkflowEquipment,createWorkflow,instrumentFor,moveInstrument,newSlot,priceSnapshot,processPhotoSources,routeCandidates,validateWorkflow,workflowBudget} from '../app/process-lib.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const process=seed.routes.find(r=>r.route_id==='P03');
const base={equipment_id:'TEST-M13',model_name:'Test centrifuge',manufacturer:'Test',category_id:'M13',legacy_category_ids:'X-FILTER',related_process_ids:'P03'};
const record={...base,msrp_value:'6000',msrp_currency:'USD'};
const workflow=()=>createWorkflow(process,seed.steps);

test('literature processes open with ordered source stages, eligible apparatus and zero initial budget',()=>{
 for(const rid of ['P15','P16','P17','P18','P19','P20','P21','P22','P23']){
  const route=seed.routes.find(r=>r.route_id===rid),draft=createWorkflow(route,seed.steps);
  assert.ok(draft.steps.length>=3);assert.equal(budgetLabel(workflowBudget(draft.steps)),'$0');
  assert.ok(draft.steps.some(s=>s.slots.length));
  const candidates=routeCandidates(seed.records,route,null);
  assert.ok(candidates.length);
  if(rid!=='P23')assert.ok(candidates.some(r=>r.catalog_scope==='literature_reported'));
  else assert.ok(candidates.every(r=>['M13','M02','M03','M101','M105','M106','M107'].includes(r.category_id)));
 }
 const gripper=seed.records.find(r=>r.equipment_id==='LIT-M62-YOO2023-RG2');
 assert.equal(priceSnapshot(gripper).kind,'unpriced');
});

test('source process sequences keep order, alternatives and empty equipment slots',()=>{
 const w=workflow(),source=seed.steps.filter(s=>s.route_id==='P03').sort((a,b)=>Number(a.step_order)-Number(b.step_order));
 assert.equal(w.steps.length,source.length);
 for(let n=0;n<source.length;n++){
  assert.equal(w.steps[n].label,source[n].step_label);assert.equal(w.steps[n].source_sequence,source[n].equipment_sequence);
  assert.ok(w.steps[n].slots.every(s=>s.instrument===null));
  assert.ok(source[n].equipment_category_ids.split(';').filter(Boolean).every(cid=>w.steps[n].slots.some(slot=>slot.allowed_category_ids.includes(cid))));
 }
 assert.equal(budgetLabel(workflowBudget(w.steps)),'$0');
});
test('assignment enforces slot classes and candidates include saved user variants',()=>{
 const w=workflow();w.steps[0].slots=[newSlot(['M13'])];const slot=w.steps[0].slots[0];
 assert.deepEqual(routeCandidates([record,{...record,equipment_id:'USER-model'}, {...record,equipment_id:'wrong',category_id:'M56',legacy_category_ids:''}],process,slot).map(r=>r.equipment_id),['TEST-M13','USER-model']);
 assert.throws(()=>assignInstrument(w,slot.slot_id,{...record,category_id:'M56',legacy_category_ids:''}),/does not match/);
 const result=assignInstrument(w,slot.slot_id,record),i=result.steps[0].slots[0].instrument;
 assert.match(i.instance_id,/^M13-[0-9a-f-]{36}$/);assert.deepEqual(i.category_refs,['M13','X-FILTER']);assert.equal(i.equipment_id,record.equipment_id);
 assert.equal(w.steps[0].slots[0].instrument,null);
});
test('process instruments follow the current step classes before narrowing to a slot',()=>{
 const w=workflow();w.steps[0].slots=[newSlot(['M13']),newSlot(['M15'])];w.steps=w.steps.slice(0,1);
 const records=[record,{...record,equipment_id:'filter',category_id:'M15',legacy_category_ids:''},
  {...record,equipment_id:'tag-only',category_id:'M56',legacy_category_ids:''},
  {...record,equipment_id:'legacy',category_id:'M99',legacy_category_ids:'M15'}];
 assert.deepEqual(routeCandidates(records,process,null,w.steps).map(r=>r.equipment_id),['TEST-M13','filter','legacy']);
 assert.deepEqual(routeCandidates(records,process,w.steps[0].slots[0],w.steps).map(r=>r.equipment_id),['TEST-M13']);
 const wildcard=newSlot();w.steps[0].slots.push(wildcard);
 assert.deepEqual(routeCandidates(records,process,wildcard,w.steps),[],'A classless slot cannot act as a wildcard for the process pool');
 w.steps[0].slots.push(newSlot(['M56']));
 assert.ok(routeCandidates(records,process,null,w.steps).some(r=>r.equipment_id==='tag-only'),'Explicitly added step classes become relevant');
 w.steps[0].slots=[newSlot()];
 assert.deepEqual(routeCandidates(records,process,w.steps[0].slots[0],w.steps),[],'Unclassified slots must not expose the entire ontology');
 assert.deepEqual(routeCandidates(records,process,null,[]),[],'Removing all classified slots removes the candidate list');
});
test('moving an instance preserves its ID, configuration, signals and prices without double counting',()=>{
 let w=workflow();w.steps[0].slots=[newSlot(['M13']),newSlot(['M13'])];const [a,b]=w.steps[0].slots;
 w=assignInstrument(w,a.slot_id,record);const i=w.steps[0].slots[0].instrument;
 i.configuration={volume:{value:250,unit:'mL'}};i.operating_parameters={speed:{value:1000,unit:'rpm'}};i.signals={ready:{protocol:'digital'}};
 const moved=moveInstrument(w,a.slot_id,b.slot_id);
 assert.equal(moved.steps[0].slots[0].instrument,null);assert.deepEqual(moved.steps[0].slots[1].instrument,i);
 assert.equal(budgetLabel(workflowBudget(moved.steps)),'$6,000');
});
test('USD budget converts foreign quotes and respects quantities, ranges, zero and missing prices',()=>{
 const variants=[record,{...base,equipment_id:'eur',msrp_value:'200',msrp_currency:'EUR'},{...base,equipment_id:'estimate',estimated_msrp_low:'10',estimated_msrp_high:'100',estimate_currency:'USD'},{...base,equipment_id:'missing'},{...base,equipment_id:'free',msrp_value:'0',msrp_currency:'USD'}];
 const w=workflow();w.steps[0].slots=variants.map(r=>({...newSlot(),instrument:instrumentFor(r)}));w.steps[0].slots[0].instrument.quantity=2;
 const b=workflowBudget(w.steps);
 assert.equal(b.assigned,6);assert.equal(b.missing,1);assert.deepEqual(b.totals.map(t=>[t.currency,t.low,t.high,t.estimated]),[['USD',12010+usdConversion(200,'EUR').value,12100+usdConversion(200,'EUR').value,true]]);
 assert.equal(priceSnapshot({...base,msrp_value:'',msrp_currency:'USD'}).kind,'unpriced');
 assert.equal(priceSnapshot({...record,msrp_value:'0'}).low,0);
});
test('new saves use trusted ontology identity and pricing while preserving future namespaces',()=>{
 const w=workflow();w.steps[0].slots=[newSlot(['M13'])];const slot=w.steps[0].slots[0];
 const assigned=assignInstrument(w,slot.slot_id,record),i=assigned.steps[0].slots[0].instrument;
 i.equipment_snapshot.model_name='Forged';i.price_snapshot.low=1;i.category_refs=['M56'];i.configuration={container:{volume:250,unit:'mL'}};i.inputs={feed:{schema_version:3,channels:['temperature','flow']}};i.extensions={future:{typed:{enabled:true}}};
 assigned.extensions={future_ontology_schema:{version:2}};
 const checked=validateWorkflow(assigned,seed.routes,[record]);const stored=checked.steps[0].slots[0].instrument;
 assert.equal(stored.equipment_snapshot.model_name,record.model_name);assert.equal(stored.price_snapshot.low,6000);assert.deepEqual(stored.category_refs,['M13','X-FILTER']);
 assert.deepEqual(stored.configuration,i.configuration);assert.deepEqual(stored.inputs,i.inputs);assert.deepEqual(checked.extensions.future_ontology_schema,assigned.extensions.future_ontology_schema);assert.match(checked.extensions.output_evidence_namespace,/^OUT-EV-/);
 const saved=structuredClone(checked);saved.workflow_id='PROC-P03-'+crypto.randomUUID();
 const edited=structuredClone(saved);edited.steps[0].slots[0].instrument.price_snapshot.low=999;
 const rechecked=validateWorkflow(edited,seed.routes,[{...record,msrp_value:'7000'}],saved);
 assert.equal(rechecked.steps[0].slots[0].instrument.price_snapshot.low,6000,'Historical price changed without replacement');
 assert.equal(rechecked.steps[0].slots[0].instrument.instance_id,stored.instance_id);
});
test('invalid, duplicate, unknown and incompatible assignments cannot be saved',()=>{
 const make=()=>{const w=workflow();w.steps[0].slots=[newSlot(['M13'])];return assignInstrument(w,w.steps[0].slots[0].slot_id,record)};
 for(const mutate of [w=>w.steps[0].slots.push(structuredClone(w.steps[0].slots[0])),w=>w.steps[0].slots[0].instrument.quantity=-1,w=>w.steps[0].slots[0].instrument.equipment_id='missing',w=>w.steps[0].slots[0].allowed_category_ids=['M56'],w=>w.schema_version=9,w=>w.steps[0].slots[0].instrument.instance_id='fake']){
  const w=make();mutate(w);assert.throws(()=>validateWorkflow(w,seed.routes,[record]));
 }
 const w=make();w.steps[0].slots[0].instrument.extensions=JSON.parse('{"__proto__":{"bad":true}}');assert.throws(()=>validateWorkflow(w,seed.routes,[record]),/property name/);
});


test('clear all empties assignments and costs while preserving workflow identity, custom steps and slot metadata',()=>{
 let w=workflow();w.workflow_id='PROC-P03-'+crypto.randomUUID();w.notes='Keep these planning notes';w.extensions={future:{keep:true}};
 w.steps[0].slots=[newSlot(['M13'],'Custom recovery slot'),newSlot(['M13'],'Backup')];w=assignInstrument(w,w.steps[0].slots[0].slot_id,record);
 w.steps[0].notes='Keep the step notes';w.steps[0].slots[0].extensions={future_field:['keep']};w.steps[0].slots[0].instrument.configuration={volume:{value:250,unit:'mL'}};
 const original=structuredClone(w),cleared=clearWorkflowEquipment(w);
 assert.equal(cleared.workflow_id,w.workflow_id);assert.equal(cleared.name,w.name);assert.equal(cleared.notes,w.notes);assert.deepEqual(cleared.extensions,w.extensions);
 assert.deepEqual(cleared.steps,w.steps.map(step=>({...step,slots:step.slots.map(slot=>({...slot,instrument:null}))})));
 assert.deepEqual(w,original,'Clearing mutated the backup used for Undo');assert.equal(workflowBudget(cleared.steps).assigned,0);assert.equal(budgetLabel(workflowBudget(cleared.steps)),'$0');
});
test('process photos can refresh blank or broken old snapshots only from the same exact catalog identity',()=>{
 const saved={...record,image_url:'',image_scope:'',image_source_url:''};
 const current={...record,image_url:'https://example.org/current.png',image_scope:'Exact model photo',image_source_url:'https://example.org/model'};
 assert.deepEqual(processPhotoSources(saved,[current]),[current]);assert.equal(saved.image_url,'');
 assert.deepEqual(processPhotoSources(saved,[{...current,model_name:'Different model'}]),[]);
 assert.deepEqual(processPhotoSources(saved,[{...current,manufacturer:'Different brand'}]),[]);
 assert.deepEqual(processPhotoSources(saved,[{...current,equipment_id:'different-id'}]),[]);
 const old={...saved,image_url:'https://example.org/older-photo.png'};
 assert.deepEqual(processPhotoSources(old,[current]).map(p=>p.image_url),[old.image_url,current.image_url]);
 assert.equal(processPhotoSources(current,[current]).length,1);
 assert.deepEqual(processPhotoSources({...saved,image_url:'javascript:bad'},[]),[]);
});


test('breadth routes expose only their supported classes and start with empty zero-cost slots',()=>{
 for(let n=24;n<=35;n++){
  const route=seed.routes.find(r=>r.route_id==='P'+n),draft=createWorkflow(route,seed.steps);
  assert.ok(draft.steps.length>=3);assert.equal(budgetLabel(workflowBudget(draft.steps)),'$0');
  assert.ok(draft.steps.some(s=>s.slots.length));
  for(const slot of draft.steps.flatMap(s=>s.slots))assert.equal(routeCandidates(seed.records,route,slot).length>0,slot.extensions.requirement_role!=='unclassified');
 }
 const dialysis=seed.routes.find(r=>r.route_id==='P30');
 assert.ok(routeCandidates(seed.records,dialysis,null).every(r=>r.category_id==='M66'));
 const alloy=seed.routes.find(r=>r.route_id==='P35');
 assert.equal(alloy.related_material_ids,'N10');
 assert.ok(routeCandidates(seed.records,alloy,null).every(r=>['M74','M19','M20','M75','M64','M65','M84','M94','M98','M99'].includes(r.category_id)));
});

test('all-years citation routes expose only classes used by their actual current steps',()=>{
 for(let n=36;n<=42;n++){
  const route=seed.routes.find(r=>r.route_id==='P'+n),draft=createWorkflow(route,seed.steps);
  const classes=new Set(draft.steps.flatMap(s=>s.slots.flatMap(slot=>slot.allowed_category_ids)));
  const candidates=routeCandidates(seed.records,route,null,draft.steps);
  assert.ok(candidates.length);assert.equal(budgetLabel(workflowBudget(draft.steps)),'$0');
  assert.ok(candidates.every(r=>classes.has(r.category_id)));
  for(const slot of draft.steps.flatMap(s=>s.slots))assert.equal(routeCandidates(seed.records,route,slot,draft.steps).length>0,slot.extensions.requirement_role!=='unclassified');
 }
});
