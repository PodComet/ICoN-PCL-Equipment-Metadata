import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assignInstrument,createWorkflow,validateWorkflow,workflowReadiness,routeCandidates} from '../app/process-lib.ts';
import {isProcessRoute,isPurdueEquipment} from '../app/catalog-lib.ts';
import {materialOutcome} from '../app/process-outcome-lib.ts';
import {emptyMaterialPlan,newStartingMaterial,withMaterialPlan} from '../app/process-materials-lib.ts';
const read=name=>JSON.parse(readFileSync(new URL('../app/data/'+name+'.json',import.meta.url),'utf8'));
const seed=read('catalog'),materials=read('process-materials'),components=read('components');

test('all six workflows have eligible equipment, valid dependency order and fillable declared branches',()=>{
 for(const rid of ['P90','P91','P92','P93','P94','P95']){
  const route=seed.routes.find(r=>r.route_id===rid);assert.ok(isProcessRoute(route));
  let workflow=createWorkflow(route,seed.steps);
  assert.equal(workflowReadiness(workflow,seed.steps).complete,false);
  for(const step of workflow.steps){
   const req=step.extensions.requirements;assert.equal(req.unresolved_required_equipment,false);
   for(const cid of req.required_branches[0]){
    const slot=step.slots.find(s=>s.allowed_category_ids.includes(cid)&&!s.instrument);
    assert.ok(slot,cid);
    const candidate=routeCandidates(seed.records,route,slot,workflow.steps)[0];assert.ok(candidate,cid);
    workflow=assignInstrument(workflow,slot.slot_id,candidate);
   }
  }
  assert.equal(workflowReadiness(workflow,seed.steps).complete,true,rid);
  assert.equal(validateWorkflow(workflow,seed.routes,seed.records).route_id,rid);
 }
});

test('computational inputs persist as data and completion never predicts a material yield or executed result',()=>{
 for(const rid of ['P90','P91','P92']){
  const route=seed.routes.find(r=>r.route_id===rid);let workflow=createWorkflow(route,seed.steps);
  const plan=emptyMaterialPlan(rid);plan.inputs=[newStartingMaterial({name:'Structure dataset',role:'sample'},'500 structures')];
  workflow=withMaterialPlan(workflow,plan);
  const saved=validateWorkflow(workflow,seed.routes,seed.records);
  assert.equal(saved.extensions.material_plan.inputs[0].amount,'500 structures');
  const output=materialOutcome(plan,materials,workflow,components);
  assert.equal(output.workflow_kind,'computational_workflow');
  assert.equal(output.execution_status,'planned_not_executed');
  assert.equal(output.products[0].quantity_assessment,null);
  assert.match(output.detail,/Execute the calculation/);
 }
});

test('Purdue flag follows the exact documented compute host without flagging other Dell models',()=>{
 const added=seed.records.filter(r=>r.catalog_scope==='cnc_computational_expansion');
 assert.equal(added.filter(isPurdueEquipment).length,1);
 assert.equal(added.find(isPurdueEquipment).model_name,'PowerEdge R7525');
});
