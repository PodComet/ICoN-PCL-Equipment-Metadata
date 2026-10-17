import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {positionGroups,separateFiber,validatePositionInterface,positionProfile} from '../app/position-lib.ts';
import {instrumentDetails} from '../app/instrument-card.ts';
const library=JSON.parse(readFileSync(new URL('../app/data/positions.json',import.meta.url)));
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url)));
const base=library.profiles[0].interface;

test('legacy model-bound interfaces group without altering the supplied poly-fibers representation',()=>{
 const before=JSON.stringify(base),groups=positionGroups(base);
 assert.equal(groups.length,2);assert.equal(groups[0].position,'lid_open');assert.equal(groups[0].fibers.length,1);
 assert.equal(groups[0].fibers[0].label,'Fiber 1');assert.equal(groups[0].fibers[0].fiber.directions[0].direction,'tc.close_lid');
 assert.equal(JSON.stringify(base),before);assert.deepEqual(validatePositionInterface(base,library.evidence),base);
 const other=seed.records.find(r=>r.equipment_id==='M13-01');assert.deepEqual(positionGroups(positionProfile(other,library).interface),[]);
});

test('one position supports several explicitly identified fibers with independent directions and evidence',()=>{
 const value=structuredClone(base),first=value.fibers[0];
 first.fiber_id='lid_motion';first.fiber_label='Lid motion';
 value.fibers.push({...structuredClone(first),fiber_id:'thermal_controls',fiber_label:'Thermal controls',directions:[structuredClone(first.directions[1])]});
 assert.doesNotThrow(()=>validatePositionInterface(value,library.evidence));
 const group=positionGroups(value)[0];assert.equal(group.fibers.length,2);assert.equal(group.fibers[1].label,'Thermal controls');
 assert.deepEqual(group.fibers[0].fiber.evidence_ids,first.evidence_ids);assert.equal(group.fibers[1].fiber.directions.length,1);
 const single=separateFiber(value,'lid_open','thermal_controls');assert.equal(single.fibers.length,1);assert.equal(single.fibers[0].fiber_id,'thermal_controls');
 single.fibers[0].directions[0].description='changed export';assert.notEqual(value.fibers[2].directions[0].description,'changed export');
 assert.equal(separateFiber(value,'lid_open').fibers.length,2);assert.equal(value.fibers.length,3);
});

test('ambiguous fibers, duplicate IDs and unknown direction evidence are rejected',()=>{
 const value=structuredClone(base);value.fibers.push(structuredClone(value.fibers[0]));
 assert.throws(()=>validatePositionInterface(value,library.evidence),/unique name/);
 value.fibers[0].fiber_id='same';value.fibers[2].fiber_id='same';assert.throws(()=>validatePositionInterface(value,library.evidence),/unique/);
 value.fibers[2].fiber_id='other';value.fibers[2].directions[0].evidence_ids=['invented-evidence'];assert.throws(()=>validatePositionInterface(value,library.evidence),/direction/);
 assert.throws(()=>separateFiber(base,'lid_open','missing'),/recorded position and fiber/);
});

test('instrument popups resolve the exact model and family, preserving unavailable workflow snapshots',()=>{
 const rows=seed.records.map(record=>({record,revision:0})),model=rows.find(r=>r.record.equipment_id==='EXT-M70-OPENTRONS-GEN2');
 const popup=instrumentDetails(rows,model.record.equipment_id,structuredClone(model.record));
 assert.equal(popup.snapshot,false);assert.ok(popup.rows.some(r=>r.record.equipment_id===model.record.equipment_id));
 assert.ok(popup.rows.every(r=>r.record.product_family_id===model.record.product_family_id));
 const historical={...structuredClone(model.record),model_name:'Historical exact model'};
 const saved=instrumentDetails(rows,model.record.equipment_id,historical);assert.equal(saved.snapshot,true);assert.equal(saved.rows[0].record.model_name,historical.model_name);
 const missing=instrumentDetails([],historical.equipment_id,historical);assert.equal(missing.snapshot,true);missing.rows[0].record.notes='edit';assert.notEqual(historical.notes,'edit');
 assert.equal(instrumentDetails([],'missing'),null);
});
