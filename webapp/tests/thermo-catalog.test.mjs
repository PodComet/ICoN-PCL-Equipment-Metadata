import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {refreshResearchEvidence,withSharedResearchOverrides} from '../app/research-policy.ts';

const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url)));
const updates=JSON.parse(readFileSync(new URL('../app/data/research-updates.json',import.meta.url)));
const review=JSON.parse(readFileSync(new URL('../../catalog/thermo_catalog_review_2026-10-19.json',import.meta.url)));

test('Thermo photos and official prices refresh untouched saved profiles without replacing user edits',()=>{
 for(const change of [...review.instrument_images,...review.manufacturer_prices]){
  const current=seed.records.find(r=>r.equipment_id===change.equipment_id);
  const prior={...current,...change.before,notes:'My private experiment notes'};
  const refreshed=refreshResearchEvidence(prior,updates);
  for(const [key,value] of Object.entries(change.after))assert.equal(refreshed[key],value,current.model_name);
  assert.equal(refreshed.notes,prior.notes);
  const field=change.before.image_url!==undefined?'image_url':'manufacturer_price_value';
  const custom={...prior,[field]:'my custom value'};
  assert.equal(refreshResearchEvidence(custom,updates)[field],custom[field]);
  assert.equal(refreshResearchEvidence(withSharedResearchOverrides(prior,[field]),updates)[field],prior[field]);
  assert.equal(refreshResearchEvidence({...prior,model_name:'Unrelated model'},updates)[field],prior[field]);
 }
});
