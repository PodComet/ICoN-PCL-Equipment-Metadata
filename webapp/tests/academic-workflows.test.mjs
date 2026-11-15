import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkflow, routeCandidates} from '../app/process-lib.ts';
import {emptyMaterialPlan, materialOutput, newStartingMaterial} from '../app/process-materials-lib.ts';
import {canonicalizeEquipment} from '../app/category-policy.ts';
import {purdueInstallationSource} from '../app/catalog-lib.ts';

const read = name => JSON.parse(readFileSync(new URL('../app/data/'+name+'.json', import.meta.url),'utf8'));
const catalog = read('catalog');
const profiles = read('process-materials').profiles;
const byId = new Map(catalog.records.map(r => [r.equipment_id, r]));

function candidateNames(pid, order, mid) {
 const route = catalog.routes.find(r => r.route_id === pid);
 const workflow = createWorkflow(route,catalog.steps);
 const slot = workflow.steps.find(s => s.source_step_order === order).slots.find(s => s.allowed_category_ids.includes(mid));
 return routeCandidates(catalog.records,route,slot,workflow.steps).map(r => r.model_name);
}

test('existing classes retain process-specific instrument configurations', () => {
 assert.ok(candidateNames('P73','2','M38').includes('Quanta 650 FEG'));
 assert.ok(!candidateNames('P73','2','M38').includes('Phenom Desktop SEM (Purdue MSE configuration)'));
 assert.ok(candidateNames('P78','2','M37').includes('D8 FOCUS'));
 assert.ok(!candidateNames('P78','2','M37').includes('Proto iXRD Mini'));
 assert.ok(candidateNames('P89','2','M23').includes('Kurt J. Lesker PVD75'));
 assert.ok(!candidateNames('P89','2','M23').includes('Cressington 208HR'));
 assert.deepEqual(candidateNames('P85','4','M67'),['MSK-HPR-MR100A']);
});

test('existing model edits receive the documented Purdue installation and preserve their notes', () => {
 const base = byId.get('M23-07');
 const stale = {...base, institution_label:'', ownership_status:'', access_evidence_url:'', equipment_subtype:'', related_process_ids:'', notes:'Local setup description'};
 const merged = canonicalizeEquipment(stale,byId,catalog.categories,catalog.category_aliases);
 assert.ok(purdueInstallationSource(merged));
 assert.equal(merged.equipment_subtype,'sem_sample_sputter_coater');
 assert.ok(merged.related_process_ids.split(';').includes('P72'));
 assert.equal(merged.notes,stale.notes);
});

test('an academic analysis labels the selected specimen in the output', () => {
 const plan = emptyMaterialPlan('P81');
 plan.inputs.push(newStartingMaterial({name:'PET',role:'sample'}));
 assert.equal(materialOutput(plan,profiles,[]).label,'Heat-flow and thermal transition data for PET');
});
