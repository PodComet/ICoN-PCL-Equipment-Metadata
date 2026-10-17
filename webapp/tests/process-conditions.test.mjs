import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkflow,validateWorkflow} from '../app/process-lib.ts';
import {CONDITION_DEFINITIONS,conditionCanonical,conditionError,conditionSummary,loadSourceConditions,newCondition,reconcileConditionScopes,sourceConditionMatch,stepConditions,withStepConditions} from '../app/process-condition-lib.ts';
import {materialOutcome} from '../app/process-outcome-lib.ts';
import {OUTPUT_EVIDENCE_KEY,outputNamespace,productEvidence,withOutputEvidence} from '../app/output-evidence-lib.ts';
import {emptyMaterialPlan,newStartingMaterial,withMaterialPlan,materialPlanFor} from '../app/process-materials-lib.ts';
const read=n=>JSON.parse(readFileSync(new URL('../app/data/'+n+'.json',import.meta.url)));
const catalog=read('catalog'),materials=read('process-materials');
const workflow=()=>createWorkflow(catalog.routes.find(r=>r.route_id==='P03'),catalog.steps);
const value=(parameter,n,unit)=>({...newCondition(parameter),value:n,unit});

test('equivalent physical units compare correctly without collapsing distinct process quantities',()=>{
 assert.ok(sourceConditionMatch(value('temperature',273.15,'K'),value('temperature',0,'°C')));
 assert.ok(sourceConditionMatch(value('temperature',212,'°F'),value('temperature',100,'°C')));
 assert.ok(sourceConditionMatch(value('duration',2,'h'),value('duration',120,'min')));
 assert.ok(sourceConditionMatch(value('liquid_flow',60,'mL/h'),value('liquid_flow',1,'mL/min')));
 assert.equal(sourceConditionMatch(value('pulse_duration',7,'ns'),value('pulse_duration',8,'ns')),false);
 assert.equal(sourceConditionMatch(value('centrifuge_speed',5000,'rpm'),value('relative_centrifugal_force',5000,'×g')),false);
 assert.equal(sourceConditionMatch(value('pressure_gauge',1,'bar'),value('pressure_absolute',1,'bar')),false);
 assert.equal(sourceConditionMatch(value('pressure_unspecified',1,'bar'),value('pressure_absolute',1,'bar')),false);
 assert.equal(sourceConditionMatch(value('gas_flow',1,'L/min'),value('gas_flow',1000,'sccm')),false);
 assert.equal(conditionCanonical(value('gas_flow',1,'L/min')).unit,'mL/min');
 assert.equal(sourceConditionMatch(value('mass_concentration',1,'g/L'),value('molar_concentration',1,'mol/L')),false);
});

test('typed conditions preserve zero, ranges and unknown values and reject incompatible units or physical impossibilities',()=>{
 assert.equal(conditionError(value('temperature',-274,'°C')),'Value is outside the physical bounds for this condition.');
 assert.equal(conditionError(value('temperature',-1,'K')),'Value is outside the physical bounds for this condition.');
 assert.ok(conditionError(value('duration',2,'rpm')));assert.ok(conditionError(value('duration',-1,'min')));
 assert.ok(conditionError(value('mass_fraction',101,'wt%')));assert.ok(conditionError(value('cycles',1.5,'count')));
 assert.equal(conditionError(value('voltage',0,'V')),'');assert.equal(conditionError(newCondition('temperature')),'');
 assert.equal(conditionCanonical(newCondition('temperature')),null);
 const range={...value('temperature',20,'°C'),operator:'range',upper_value:40};assert.equal(conditionError(range),'');
 assert.ok(sourceConditionMatch(range,{...range,unit:'K',value:293.15,upper_value:313.15}));
 assert.equal(sourceConditionMatch(range,value('temperature',30,'°C')),false,'A study range is not a selected set point.');
 assert.ok(Object.keys(CONDITION_DEFINITIONS).length>=35);
});

test('step and occurrence conditions survive save/reload and export with stable identities and source context',()=>{
 let w=workflow();const step=w.steps[1],c={...value('temperature',25,'°C'),slot_id:step.slots[0].slot_id,label:'Ablation bath',notes:'Measured liquid temperature',citation_url:'https://example.org/study',citation_locator:'Methods 2'};
 w=withStepConditions(w,step.step_id,[c]);w=validateWorkflow(JSON.parse(JSON.stringify(w)),catalog.routes,catalog.records);
 assert.deepEqual(stepConditions(w.steps[1]),[c]);assert.deepEqual(conditionSummary(w),{count:1,specified:1,steps:1});
 const materialPlan={...emptyMaterialPlan('P03'),inputs:[newStartingMaterial({name:'Silver (Ag)',role:'target'})]};w=withMaterialPlan(w,materialPlan);
 const result=materialOutcome(materialPlanFor(w),materials,w);assert.deepEqual(result.conditions[1].conditions,[c]);
 const bad=structuredClone(w);bad.steps[0].extensions.operating_conditions=[c];assert.throws(()=>validateWorkflow(bad,catalog.routes,catalog.records),/scope|unique/);
 const duplicate=structuredClone(w);duplicate.steps[1].extensions.operating_conditions.push(c);assert.throws(()=>validateWorkflow(duplicate,catalog.routes,catalog.records),/unique/);
});

test('source loading is explicit, maps by stable source-step order and never overwrites researcher edits',()=>{
 const w=workflow(),step=w.steps[1],condition={...value('temperature',20,'°C'),label:'Bath',reference_condition_id:'PC-1'};
 const template={...condition,template_id:'PC-1',route_id:'P03',formulation_id:'F1',source_step_order:step.source_step_order,evidence_id:'SRC-1',scope:'Synthetic fixture only',match_scope:'example'};
 const library={schema:'process-science/v1',checked_date:'2026-10-17',conditions:[template],evidence:[],properties:[],route_reviews:[]};
 assert.equal(stepConditions(w.steps[1]).length,0);
 const loaded=loadSourceConditions(w,'F1',library);assert.equal(loaded.loaded.length,1);assert.equal(stepConditions(loaded.workflow.steps[1])[0].value,20);
 const edited=withStepConditions(loaded.workflow,step.step_id,[{...stepConditions(loaded.workflow.steps[1])[0],value:30}]);
 const repeated=loadSourceConditions(edited,'F1',library);assert.equal(repeated.loaded.length,0);assert.equal(stepConditions(repeated.workflow.steps[1])[0].value,30);
 const moved={...w,steps:[...w.steps].reverse()};assert.equal(loadSourceConditions(moved,'F1',library).workflow.steps.find(s=>s.step_id===step.step_id).extensions.operating_conditions.length,1);
});

test('every planned output has a unique persistent evidence ID without claiming experimental validation',()=>{
 const a=workflow(),b=workflow();assert.notEqual(outputNamespace(a),outputNamespace(b));assert.notEqual(productEvidence(a,0).evidence_id,productEvidence(a,1).evidence_id);
 const legacy=structuredClone(a);delete legacy.extensions[OUTPUT_EVIDENCE_KEY];assert.equal(outputNamespace(legacy),outputNamespace(legacy));
 const migrated=withOutputEvidence(legacy);assert.equal(outputNamespace(migrated),outputNamespace(legacy));
 const restored=validateWorkflow(JSON.parse(JSON.stringify(a)),catalog.routes,catalog.records,a);assert.equal(productEvidence(restored,0).evidence_id,productEvidence(a,0).evidence_id);
 const replaced=structuredClone(a);replaced.extensions[OUTPUT_EVIDENCE_KEY]=b.extensions[OUTPUT_EVIDENCE_KEY];assert.throws(()=>validateWorkflow(replaced,catalog.routes,catalog.records,a),/evidence identity/);
 const p={...emptyMaterialPlan('P03'),inputs:[newStartingMaterial({name:'Silver (Ag)',role:'target'})]};const result=materialOutcome(p,materials,a);
 assert.equal(result.products[0].evidence_status,'planned_output');assert.equal(result.products[0].validation_status,'experimental_validation_roadmap');assert.ok(result.products[0].evidence_id);
 assert.equal(JSON.parse(JSON.stringify(result)).products[0].evidence_id,result.products[0].evidence_id);
});

test('removing an instrument slot preserves its conditions and marks their detached scope for review',()=>{
 const w=workflow(),step=w.steps[1],slot=step.slots[0],c={...value('temperature',25,'°C'),slot_id:slot.slot_id};
 const prepared=withStepConditions(w,step.step_id,[c]);prepared.steps[1].slots=prepared.steps[1].slots.filter(s=>s.slot_id!==slot.slot_id);
 const corrected=reconcileConditionScopes(prepared),kept=stepConditions(corrected.steps[1])[0];
 assert.equal(kept.condition_id,c.condition_id);assert.equal(kept.value,25);assert.equal(kept.slot_id,'');assert.equal(kept.scope_review_required,true);assert.match(kept.notes,/removed/);
 assert.doesNotThrow(()=>validateWorkflow(corrected,catalog.routes,catalog.records));
});
