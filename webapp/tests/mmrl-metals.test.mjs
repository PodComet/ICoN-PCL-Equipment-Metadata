import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkflow, routeCandidates} from '../app/process-lib.ts';
import {emptyMaterialPlan, materialOutput, newStartingMaterial} from '../app/process-materials-lib.ts';
import {canonicalizeEquipment} from '../app/category-policy.ts';

const read = file => JSON.parse(readFileSync(new URL('../app/data/' + file + '.json', import.meta.url), 'utf8'));
const catalog = read('catalog');
const profiles = read('process-materials').profiles;
const route = id => catalog.routes.find(r => r.route_id === id);
const candidates = (id, order, category) => {
 const workflow = createWorkflow(route(id), catalog.steps);
 const slot = workflow.steps.find(s => s.source_step_order === order).slots.find(s => s.allowed_category_ids.includes(category));
 return routeCandidates(catalog.records, route(id), slot, workflow.steps);
};

test('metals workflows expose models only for the correct feed and postprocessing', () => {
 const powder = candidates('P50', '2', 'M119');
 const wire = candidates('P68', '2', 'M119');
 assert.ok(powder.some(r => r.model_name === 'FormAlloy L2'));
 assert.ok(wire.some(r => r.model_name === 'M600'));
 assert.ok(powder.every(r => r.equipment_subtype === 'powder_laser_ded'));
 assert.ok(wire.every(r => r.equipment_subtype === 'wire_laser_ded'));
 assert.deepEqual(candidates('P51', '2', 'M137').map(r => r.model_name), ['Wash-1']);
 assert.deepEqual(candidates('P70', '2', 'M137').map(r => r.model_name), ['D200-E']);
 assert.ok(candidates('P60', '2', 'M37').some(r => r.model_name === 'Proto iXRD Mini'));
});

test('metal metrology labels the result for the selected specimen', () => {
 const plan = emptyMaterialPlan('P60');
 plan.inputs.push(newStartingMaterial({name: '316L steel', role: 'sample'}));
 assert.equal(materialOutput(plan, profiles, []).label, 'XRD residual stress measurements for 316L steel');
});

test('a stored equipment edit acquires the reviewed class and keeps personal notes', () => {
 const byId = new Map(catalog.records.map(r => [r.equipment_id,r]));
 const base = byId.get('REQ-EQ-013');
 const saved = {...base, category_id:'X-CNC', equipment_subtype:'', related_process_ids:'', notes:'Existing workholding notes'};
 const canonicalize = row => canonicalizeEquipment(row,byId,catalog.categories,catalog.category_aliases);
 const updated = canonicalize(saved);
 assert.equal(updated.category_id,'M124');
 assert.equal(updated.equipment_subtype,'five_axis_mill');
 assert.ok(updated.related_process_ids.split(';').includes('P55'));
 assert.equal(updated.notes,saved.notes);
 assert.equal(updated.purdue_list,'true');
 const otherModel = {...saved,model_name:'Custom different model'};
 assert.deepEqual(canonicalize(otherModel),otherModel);
});
