import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {manufacturerBadge,verifiedManufacturer,photoFirstGroups} from '../app/catalog-lib.ts';
import {createWorkflow,newSlot,slotAccepts,routeCandidates} from '../app/process-lib.ts';
import {refreshResearchEvidence} from '../app/research-policy.ts';
const read=n=>JSON.parse(readFileSync(new URL('../app/data/'+n+'.json',import.meta.url),'utf8'));
const seed=read('catalog'),updates=read('research-updates');
const row=id=>seed.records.find(r=>r.equipment_id===id);
const plan=id=>createWorkflow(seed.routes.find(r=>r.route_id===id),seed.steps);

test('owner-confirmed manufacturer stars keep model-specific pricing and manual evidence separate',()=>{
 const records=seed.records.filter(r=>['Theris','Theris Nanotechnology','EVG'].includes(r.manufacturer));
 assert.equal(records.length,30);
 for(const r of records){
  assert.ok(verifiedManufacturer(r));assert.match(manufacturerBadge(r).label,/User-confirmed manufacturer/);
  assert.equal(r.msrp_value,'');assert.equal(r.manufacturer_price_value,'');
  assert.notEqual(r.manual_match_status,'verified_operating_manual');
 }
 assert.equal(row('THERIS-NC400').image_url,'');
 assert.equal(row('M60-07').image_url,'');
 assert.match(row('THERIS-SMPL-MH4I').image_scope,/family|Exact MH4i identity not established/i);
 assert.equal(row('THERIS-TAS-RFI').brochure_url,'');
 assert.equal(row('THERIS-SMPL-MH4I').brochure_url,'');
});

test('source accessories cannot fill complete deposition or MBE system slots',()=>{
 const shell=row('THERIS-NANOSHELL'),atom=row('THERIS-TAS30');
 assert.equal(shell.category_id,'M116');assert.equal(slotAccepts(newSlot(['M23']),shell),false);
 assert.equal(slotAccepts(newSlot(['M54']),shell),false);
 assert.equal(slotAccepts(newSlot(['M116']),shell),true);
 assert.equal(slotAccepts(newSlot(['M100']),atom),false);
 assert.equal(slotAccepts(newSlot(['M110']),atom),true);
});

test('configured resist tracks and maskless exposure are explicit planning alternatives',()=>{
 const w=plan('P06'),prep=w.steps[0],pattern=w.steps[1],inspect=w.steps[4];
 const trackSlot=prep.slots.find(s=>s.allowed_category_ids.includes('M115'));
 const station=row('EVG261018-EVG101'),track=row('EVG261018-EVG120');
 assert.equal(slotAccepts(trackSlot,station,w.steps),false,'Single-chamber station does not supply a documented integrated bake branch');
 assert.equal(slotAccepts(trackSlot,track,w.steps),true);
 const exposureSlot=pattern.slots.find(s=>s.allowed_category_ids.includes('M113'));
 const exposure=row('EVG261018-LITHOSCALE');
 assert.ok(slotAccepts(exposureSlot,exposure,w.steps));
 assert.equal(slotAccepts(newSlot(['M58']),exposure),false,'Digital exposure is not a mask-aligner platform');
 assert.ok(inspect.slots.some(s=>s.allowed_category_ids.includes('M114')));
 const p42=plan('P42'),coat=p42.steps[0].slots.find(s=>s.allowed_category_ids.includes('M115'));
 assert.ok(slotAccepts(coat,station,p42.steps));
 assert.ok(routeCandidates(seed.records,seed.routes.find(r=>r.route_id==='P06'),null,w.steps).some(r=>r.equipment_id===track.equipment_id));
 for(const r of seed.records.filter(r=>r.category_id==='M115')){
  assert.equal(r.estimated_msrp_low,'');assert.equal(r.estimated_msrp_high,'');
 }
});

test('model/configuration chips keep their own images and old snapshots receive scoped link repairs',()=>{
 for(const id of ['EVG261018-EVG150','EVG261018-HERCULES_NIL']){
  const variants=seed.records.filter(r=>r.equipment_id.startsWith(id+'-'));
  assert.equal(variants.length,2);assert.equal(new Set(variants.map(r=>r.product_family_id)).size,1);
  assert.equal(new Set(variants.map(r=>r.image_url)).size,2);
  assert.equal(new Set(variants.map(r=>r.technical_spec_url)).size,2);
  assert.equal(photoFirstGroups(variants.map(record=>({record}))).length,1);
 }
 assert.equal(row('M58-02').product_family_id,row('M60-03').product_family_id);
 assert.equal(row('M60-08').product_family_id,row('EVG261018-EVG7200LA').product_family_id);
 const historical={...row('M54-02'),product_page_url:'',product_page_scope:'',technical_spec_url:'',brochure_url:'',documentation_url:''};
 const repaired=refreshResearchEvidence(historical,updates);
 assert.equal(repaired.product_page_url,row('M54-02').product_page_url);
 assert.equal(repaired.brochure_url,row('M54-02').brochure_url);
 const custom=refreshResearchEvidence({...historical,technical_spec_url:'https://example.org/custom-spec'},updates,['technical_spec_url']);
 assert.equal(custom.technical_spec_url,'https://example.org/custom-spec');
 assert.equal(row('M58-08').model_name,'EVG6200 NT');
 assert.notEqual(row('M58-08').lifecycle_status,'newer_model_confirmed');
 const oldIdentity={...row('M58-08'),model_name:'EVG6200',image_url:'',image_source_url:'',image_scope:'',media_checked_date:''};
 const corrected=refreshResearchEvidence(oldIdentity,updates);
 assert.equal(corrected.model_name,'EVG6200 NT');assert.equal(corrected.image_url,row('M58-08').image_url);
 const retained=refreshResearchEvidence(oldIdentity,updates,['model_name']);
 assert.equal(retained.model_name,'EVG6200');assert.equal(retained.image_url,'');
});
