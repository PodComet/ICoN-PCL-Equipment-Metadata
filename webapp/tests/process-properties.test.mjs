import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expectedProperties} from '../app/process-properties-lib.ts';
import {conditionError,loadSourceConditions,newCondition,stepConditions,withStepConditions} from '../app/process-condition-lib.ts';
import {assignInstrument,createWorkflow,slotAccepts,validateWorkflow,workflowReadiness} from '../app/process-lib.ts';
import {formulationPlan} from '../app/component-lib.ts';
import {withStepDependencies} from '../app/process-dependencies.ts';
import {productEvidence} from '../app/output-evidence-lib.ts';
const read=n=>JSON.parse(readFileSync(new URL('../app/data/'+n+'.json',import.meta.url)));
const science=read('process-science'),catalog=read('catalog'),components=read('components');
const source=components.formulations.find(f=>f.route_id==='P20'),plan=formulationPlan(source);
function matchingWorkflow(){
 let w=createWorkflow(catalog.routes.find(r=>r.route_id==='P20'),catalog.steps);
 w=loadSourceConditions(w,source.formulation_id,science).workflow;
 for(const step of w.steps)for(const slot of step.slots){const record=catalog.records.find(r=>slotAccepts(slot,r));assert.ok(record);w=assignInstrument(w,slot.slot_id,record);}
 assert.equal(workflowReadiness(w,catalog.steps).complete,true);return w;
}

test('all curated source conditions have compatible units, resolvable evidence and preserved ambiguities',()=>{
 const ids=new Set(science.evidence.map(e=>e.evidence_id));assert.equal(ids.size,science.evidence.length);assert.equal(science.conditions.length,289);assert.equal(science.properties.length,32);
 for(const c of science.conditions){assert.equal(conditionError(c),'',c.template_id+' '+c.parameter+' '+c.unit);assert.ok(ids.has(c.evidence_id));}
 for(const p of science.properties){assert.ok(ids.has(p.evidence_id));for(const id of p.required_condition_ids)assert.ok(science.conditions.some(c=>c.template_id===id&&c.formulation_id===p.formulation_id));}
 assert.ok(science.conditions.some(c=>c.parameter==='pressure_differential'&&c.value===1.5));assert.ok(science.conditions.some(c=>c.parameter==='compaction_pressure'&&c.value===80));
 assert.ok(science.conditions.some(c=>c.parameter==='duration'&&c.operator==='text'&&/overnight/i.test(c.text_value)));
 assert.ok(science.relationship_candidates.every(c=>c.interpolation_enabled===false));
});

test('a reviewed source formulation and fixed settings produce explicitly unvalidated analogue expectations',()=>{
 const w=matchingWorkflow(),rows=expectedProperties(w,plan,components,science,true);assert.equal(rows.length,2);
 assert.ok(rows.every(r=>r.method==='conditional_literature_analogue'&&r.checks.every(c=>c.status==='matched')));
 assert.deepEqual(rows.map(r=>r.expected_value),[92,.00721]);assert.equal(new Set(rows.map(r=>r.evidence_id)).size,2);
 assert.ok(rows.every(r=>r.output_evidence_id===productEvidence(w,0).evidence_id&&r.validation_status==='experimental_validation_roadmap'));
 const saved=validateWorkflow(w,catalog.routes,catalog.records);assert.deepEqual(expectedProperties(saved,plan,components,science,true),rows);
});

test('equivalent units retain expectations while changed conditions, materials and incomplete equipment withdraw them',()=>{
 const w=matchingWorkflow(),step=w.steps.find(s=>stepConditions(s).some(c=>c.parameter==='temperature')),temperature=stepConditions(step).find(c=>c.parameter==='temperature');
 const kelvin=withStepConditions(w,step.step_id,stepConditions(step).map(c=>c===temperature?{...c,value:298.15,unit:'K'}:c));assert.ok(expectedProperties(kelvin,plan,components,science,true).every(r=>r.expected_value!==null));
 const changed=withStepConditions(w,step.step_id,stepConditions(step).map(c=>c===temperature?{...c,value:30}:c));assert.ok(expectedProperties(changed,plan,components,science,true).every(r=>r.expected_value===null));
 const amount={...plan,inputs:plan.inputs.map((m,i)=>i?m:{...m,amount:'Different amount'})};assert.ok(expectedProperties(w,amount,components,science,true).every(r=>r.expected_value===null));
 assert.ok(expectedProperties(w,plan,components,science,false).every(r=>r.expected_value===null));
 const added=withStepConditions(w,w.steps[0].step_id,[newCondition('duration')]);assert.ok(expectedProperties(added,plan,components,science,true).every(r=>r.expected_value===null));
 for(const field of ['configuration','operating_parameters','operation_sequence']){
  const configured=structuredClone(w),instrument=configured.steps.flatMap(s=>s.slots).find(s=>s.instrument).instrument;
  instrument[field]=field==='operation_sequence'?['Custom irradiation action']:{custom_setting:10};
  assert.ok(expectedProperties(configured,plan,components,science,true).every(r=>r.expected_value===null&&r.reasons.some(reason=>reason.includes('control actions'))));
 }
});

test('missing evidence and changed prerequisite order cannot inherit a source-property estimate',()=>{
 const w=matchingWorkflow(),property=science.properties.find(p=>p.route_id==='P20');
 const missing={...science,evidence:science.evidence.filter(e=>e.evidence_id!==property.evidence_id)};assert.equal(expectedProperties(w,plan,components,missing,true).find(r=>r.anchor_id===property.anchor_id).expected_value,null);
 const forming=w.steps.find(s=>s.source_step_order==='3'),parallel=withStepDependencies(w,forming.step_id,[]);
 assert.ok(expectedProperties(parallel,plan,components,science,true).every(r=>r.expected_value===null));
 const other=createWorkflow(catalog.routes.find(r=>r.route_id==='P12'),catalog.steps),f=components.formulations.find(f=>f.route_id==='P12');
 assert.ok(expectedProperties(other,formulationPlan(f),components,science,true).every(r=>r.method==='not_estimated'));
});
