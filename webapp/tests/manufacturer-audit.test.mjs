import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyManufacturerAudit,manufacturerBadge,matches,verifiedManufacturer} from '../app/catalog-lib.ts';

const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const equipment=id=>seed.records.find(r=>r.equipment_id===id);

test('owner confirmations grant manufacturer stars without upgrading academic-adoption evidence',()=>{
 for(const manufacturer of ['BaltiCold','IKA','Radleys','Asynt','Chemglass','Buchi AG','Berghof','Amar','Genizer']){
  const brand=seed.manufacturers.find(b=>b.manufacturer===manufacturer);
  assert.equal(brand.verification_basis,'user_confirmation');
  assert.notEqual(brand.research_use_status,'documented_research_use');
  const records=seed.records.filter(r=>r.manufacturer===manufacturer);
  assert.ok(records.length>0);
  assert.ok(records.every(r=>verifiedManufacturer(applyManufacturerAudit(r,seed.manufacturers))));
 }
});

test('EDMMax has a vendor-scoped EDM Network badge, not an OEM-manufacturer claim',()=>{
 const record=applyManufacturerAudit(equipment('REQ-EQ-014'),seed.manufacturers);
 assert.equal(record.manufacturer,'EDMMax');
 assert.equal(record.manufacturer_brand_identity_status,'verified_brand');
 assert.equal(record.manufacturer_vendor_name,'EDM Network');
 const badge=manufacturerBadge(record);
 assert.equal(badge.label,'User-confirmed vendor: EDM Network');
 assert.equal(badge.href,'https://www.edmnetwork.com/pages/why-choose-us');
 assert.match(record.manufacturer_verification_notes,/does not independently establish the underlying OEM/);
});

test('Buchiglasuster reactor maker stays distinct from BUCHI Labortechnik evaporators and freeze dryers',()=>{
 const reactor=equipment('M04-07'),evaporator=equipment('M16-01'),dryer=equipment('M17-02');
 assert.equal(reactor.manufacturer,'Buchi AG');
 assert.match(reactor.manufacturer_display_name,/buchiglasuster/);
 assert.equal(evaporator.manufacturer,'BUCHI');
 assert.equal(dryer.manufacturer,'BUCHI');
 assert.equal(evaporator.manufacturer_display_name,'BUCHI Labortechnik');
 assert.equal(evaporator.manufacturer_research_use_status,'documented_research_use');
 assert.ok(verifiedManufacturer(reactor)&&verifiedManufacturer(evaporator));
 assert.ok(matches({record:reactor,revision:0},'buchiglasuster','','','',false,false));
 assert.ok(!matches({record:evaporator,revision:0},'buchiglasuster','','','',false,false));
 for(const query of ['EDM Network','EDMNetwork'])assert.ok(matches({record:equipment('REQ-EQ-014'),revision:0},query,'','','',false,false));
});

test('defunct status survives saved-record hydration and cannot acquire an active-company badge',()=>{
 const stale={...equipment('REQ-EQ-016'),manufacturer_company_status:'',manufacturer_company_status_note:'',manufacturer_company_status_source_url:''};
 const refreshed=applyManufacturerAudit(stale,seed.manufacturers);
 assert.equal(refreshed.manufacturer_company_status,'defunct');
 assert.match(refreshed.manufacturer_company_status_note,/2018.*2025/);
 assert.ok(refreshed.manufacturer_company_status_source_url);
 assert.equal(manufacturerBadge(refreshed),null);
 assert.equal(verifiedManufacturer({...refreshed,manufacturer_brand_identity_status:'verified_manufacturer',manufacturer_verification_basis:'user_confirmation'}),false);
});

test('changing equipment identity clears stale vendor, alias and defunct metadata',()=>{
 const changed=applyManufacturerAudit({...equipment('REQ-EQ-014'),manufacturer:'Asynt',manufacturer_display_name:'Wrong alias',manufacturer_company_status:'defunct'},seed.manufacturers);
 assert.equal(changed.manufacturer_vendor_name,'');
 assert.equal(changed.manufacturer_display_name,'');
 assert.notEqual(changed.manufacturer_company_status,'defunct');
 assert.equal(manufacturerBadge(changed).label,'User-confirmed manufacturer: Asynt');
 const unknown=applyManufacturerAudit({...changed,manufacturer:'Unknown manufacturer'},seed.manufacturers);
 assert.equal(manufacturerBadge(unknown),null);
});
