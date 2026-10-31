import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyEquipmentIO,equipmentIOText,equipmentIOFragments} from '../app/equipment-io.ts';

const library=JSON.parse(fs.readFileSync(new URL('../app/data/equipment-io.json',import.meta.url),'utf8'));
const seed=JSON.parse(fs.readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const model=name=>seed.records.find(r=>r.model_name===name);

test('every existing Purdue-list record receives its exact spreadsheet model values',()=>{
 const purdue=seed.records.filter(r=>r.purdue_list==='true');
 assert.equal(purdue.length,44);
 for(const r of purdue){const updated=applyEquipmentIO(r,library),source=library.records.find(v=>v.equipment_id===r.equipment_id);assert.ok(source,r.equipment_id);for(const field of ['inputs_and_states','outputs_and_states','units_of_measure'])assert.equal(updated[field],source[field]);}
});

test('latest Core and Thor interfaces retain their distinct power limits',()=>{
 const core=applyEquipmentIO(model('Standard Bots Core'),library),thor=applyEquipmentIO(model('Standard Bots Thor'),library);
 assert.match(core.outputs_and_states,/3 A continuous maximum/);
 assert.match(thor.outputs_and_states,/6 A continuous maximum/);
 assert.match(core.equipment_io_source_workbook,/manuals2_updated/);
});

test('a renamed model, new variant or other manufacturer never inherits spreadsheet facts',()=>{
 const r=library.records[0],copied={...r,model_name:r.model_name+' new version'};
 for(const candidate of [copied,{...r,equipment_id:'USER-new'},{...r,manufacturer:'Another manufacturer'}]){
  const result=applyEquipmentIO(candidate,library);
  assert.equal(result.inputs_and_states,undefined);assert.equal(result.outputs_and_states,undefined);assert.equal(result.units_of_measure,undefined);assert.equal(result.equipment_io_source_row,undefined);
 }
});

test('plus-suffixed models remain distinct and uncertainty is preserved verbatim',()=>{
 const source={equipment_id:'a',manufacturer:'Cytiva',model_name:'Ignite+',inputs_and_states:'Qualified reference only',equipment_io_source_row:'2'};
 assert.equal(applyEquipmentIO({...source,model_name:'Ignite'},{records:[source]}).inputs_and_states,undefined);
 assert.equal(applyEquipmentIO(source,{records:[source]}).inputs_and_states,'Qualified reference only');
 const cb=library.records.find(r=>r.model_name.includes('CB1-04'));
 assert.match(cb.inputs_and_states,/PARTIAL FAMILY REFERENCE/);assert.match(cb.outputs_and_states,/CB3-80W performance limits were not transferred/);
});

test('all imported identities exist in the catalog and all three boxes have source text',()=>{
 const ids=new Set(seed.records.map(r=>r.equipment_id));
 assert.equal(library.records.length,1115);
 assert.equal(new Set(library.records.map(r=>r.equipment_id)).size,1115);
 for(const r of library.records){assert.ok(ids.has(r.equipment_id));assert.match(r.equipment_io_source_sha256,/^[a-f0-9]{64}$/);for(const field of ['inputs_and_states','outputs_and_states','units_of_measure'])assert.equal(typeof r[field],'string');}
});

test('display removes local PDF footnotes without discarding subsequent controls or qualifiers',()=>{
 const value='Family reference only.\nSources: H PDF pp. 2, 40.\nAdditional documented controls: lid locking.\nSource: Manuals/local.pdf, PDF p. 16.';
 const result=equipmentIOText(value);
 assert.doesNotMatch(result,/Sources?:|local\.pdf|PDF pp?\./);
 assert.match(result,/Family reference only/);assert.match(result,/Additional documented controls: lid locking/);
 const core=library.records.find(r=>r.model_name==='Standard Bots Core');
 assert.doesNotMatch(equipmentIOText(core.inputs_and_states),/Manuals2\/|\.pdf/i);
 assert.match(core.inputs_and_states,/\.pdf/,'Raw provenance remains unchanged');
});

test('reachable references, including web PDFs, remain linkable and sentence punctuation stays outside links',()=>{
 const value='Not installed-unit verification.\nSource: https://example.org/manual.pdf\nMore: https://example.org/spec (https://example.org/document).';
 const text=equipmentIOText(value),parts=equipmentIOFragments(text);
 assert.deepEqual(parts.filter(p=>p.url).map(p=>p.url),['https://example.org/manual.pdf','https://example.org/spec','https://example.org/document']);
 assert.equal(parts.map(p=>p.text).join(''),text);
 assert.equal(equipmentIOFragments('Materials: solid → liquid.').some(p=>p.url),false);
});

test('all current displayed fields omit inaccessible PDF source notes and retain substantive states',()=>{
 for(const r of library.records)for(const field of ['inputs_and_states','outputs_and_states','units_of_measure']){
  const text=equipmentIOText(r[field]);
  assert.doesNotMatch(text,/^\s*Sources?\s*:|Manuals2?\/|\.pdf\b/im,r.equipment_id+' '+field);
  if(r[field].includes('Additional documented controls'))assert.match(text,/Additional documented controls/);
 }
 const labjack=library.records.find(r=>r.equipment_id==='EXT-M86-62BA2209CDF0');
 assert.equal(equipmentIOFragments(equipmentIOText(labjack.inputs_and_states)).filter(p=>p.url).length,2);
});
