import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPositionPlan,positionCSV,positionExport} from '../app/position-csv.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url))),library=JSON.parse(readFileSync(new URL('../app/data/positions.json',import.meta.url)));
const model=seed.records?.[0]||seed.equipment?.[0];
const records=seed.equipment||seed.records;
const tc=library.profiles[0],base={equipment_id:tc.equipment_id,manufacturer:tc.manufacturer,model_name:tc.model_name,position:'closed',fiber_id:'closed-access',fiber_description:'Access interface',direction:'open',direction_description:'Request lid opening'};
test('position spreadsheet preserves quotes, exact model identity, tree structure and unverified effect sources',()=>{
 const text=positionCSV([{...base,effect_summary:'A declared, process-specific effect\nNeeds review',effect_evidence_id:'TEST-EFFECT-1',effect_source_url:'https://example.org/study',effect_source_title:'Test fixture',effect_source_section:'Results',accessed:'2026-10-17'},{...base,direction:'close',direction_description:'Close lid'}]);
 const plan=buildPositionPlan(text,records,library);assert.deepEqual(plan.errors,[]);assert.equal(plan.changes.length,1);assert.equal(plan.changes[0].after.interface.fibers[0].directions.length,2);assert.equal(plan.changes[0].evidence[0].entries[0].verification.status,'unverified');assert.ok(plan.changes[0].after.interface.fibers[0].directions[0].effect_summary.includes('\n'));
});
test('mismatched models, duplicate directions and inconsistent fibers cannot be applied',()=>{
 assert.ok(buildPositionPlan(positionCSV([{...base,model_name:'Different model'}]),records,library).errors.length);
 assert.ok(buildPositionPlan(positionCSV([base,base]),records,library).errors.length);
 assert.ok(buildPositionPlan(positionCSV([base,{...base,direction:'close',fiber_description:'Conflicting description'}]),records,library).errors.length);
 assert.ok(buildPositionPlan(positionCSV([base,{...base,position:'other',direction:'close'}]),records,library).errors.length);
});
test('unknown or unsafe evidence sources and privilege columns are rejected',()=>{
 for(const extra of [{effect_summary:'Test',effect_evidence_id:'missing'},{effect_summary:'Test',effect_evidence_id:'x',effect_source_url:'javascript:alert(1)',effect_source_title:'Test',effect_source_section:'Test',accessed:'2026-10-17'}])assert.ok(buildPositionPlan(positionCSV([{...base,...extra}]),records,library).errors.length);
 assert.ok(buildPositionPlan(positionCSV([base]).replace('equipment_id','verification_status'),records,library).errors.length);
});
test('current interfaces roundtrip all direction, fiber and interface evidence IDs',()=>{
 const plan=buildPositionPlan(positionExport(library),records,library);assert.deepEqual(plan.errors,[]);
 const original=tc.interface,after=plan.changes[0].after.interface;
 assert.equal(after.name,original.name);assert.equal(after.description,original.description);assert.deepEqual(after.evidence_ids,original.evidence_ids);
 for(let i=0;i<original.fibers.length;i++){assert.deepEqual(after.fibers[i].evidence_ids,original.fibers[i].evidence_ids);for(let j=0;j<original.fibers[i].directions.length;j++)assert.deepEqual(after.fibers[i].directions[j].evidence_ids,original.fibers[i].directions[j].evidence_ids);}
});
test('empty templates and a partially invalid batch report errors without granting a verified profile',()=>{
 assert.ok(buildPositionPlan(positionCSV(),records,library).errors.length);const plan=buildPositionPlan(positionCSV([base,{...base,equipment_id:'unknown'}]),records,library);assert.ok(plan.errors.length);assert.equal(plan.changes[0].after.status,'uploaded_needs_review');
});
