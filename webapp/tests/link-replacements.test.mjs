import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {repairRetiredLinks} from '../app/link-policy.ts';
import {refreshResearchEvidence} from '../app/research-policy.ts';
import {documentationLink} from '../app/catalog-lib.ts';

const data=name=>JSON.parse(readFileSync(new URL('../app/data/'+name+'.json',import.meta.url),'utf8'));
const rules=data('link-replacements'),research=data('research-updates'),seed=data('catalog');
const base=seed.records.find(r=>r.equipment_id==='REQ-EQ-013');
const brochure=rules[0].replacement_url;

test('old saved Mazak links repair after prior evidence updates without changing machine identity',()=>{
 const saved={...base,product_page_url:rules[0].old_url,model_evidence_url:rules[0].old_url,technical_spec_url:'',brochure_url:'',notes:'My machining notes'};
 const refreshed=repairRetiredLinks(refreshResearchEvidence(saved,research),rules);
 assert.equal(refreshed.product_page_url,brochure);assert.equal(refreshed.brochure_url,brochure);
 assert.equal(refreshed.technical_spec_url,'');assert.equal(documentationLink(refreshed).label,'Brochure');
 assert.match(refreshed.model_evidence_url,/\/us-en\/news-media\/customer-success\//);
 assert.equal(refreshed.notes,saved.notes);assert.equal(refreshed.category_id,'X-CNC');
 assert.equal(refreshed.purdue_list,'true');assert.equal(refreshed.model_name,base.model_name);
 assert.equal(refreshed.manufacturer_price_value,'');
 assert.deepEqual(repairRetiredLinks(refreshed,rules),refreshed);
});

test('explicit retired URL repair covers stored overrides, tracking URLs and class references',()=>{
 const saved={...base,_shared_fields:'["product_page_url"]',product_page_url:rules[0].old_url+'?utm_source=old#specs',estimate_source_urls:rules[0].old_url+';https://www.yornew.com/en/vmc300.asp',notes:'Keep this note'};
 const repaired=repairRetiredLinks(saved,rules);
 assert.equal(repaired.product_page_url,brochure);
 assert.equal(repaired.estimate_source_urls,brochure+';https://www.yornew.com/en/vmc300.asp');
 assert.equal(repaired.notes,saved.notes);
 const other={...base,product_page_url:'https://example.org/machine/vc-500a-5x/',brochure_url:'https://example.org/custom.pdf',technical_spec_url:'https://www.mazak.com/us-en/products/am/vc-500a-5x-am-hwd/'};
 assert.deepEqual(repairRetiredLinks(other,rules),other,'Unreviewed links must not be guessed or redirected');
});

test('a retired presentation never becomes a verified operator manual',()=>{
 const repaired=repairRetiredLinks({...base,manual_url:rules[1].old_url,manual_match_status:'verified_operating_manual',brochure_url:''},rules);
 assert.equal(repaired.manual_url,'');assert.equal(repaired.manual_match_status,'not_verified');
 assert.equal(repaired.brochure_url,brochure);
});

test('current Mazak seed points to US sources and does not substitute the AM HWD hybrid',()=>{
 for(const [field,value] of Object.entries(base))if(field.endsWith('_url')||field.endsWith('_urls'))assert.ok(!value.includes('virtual.mazakusa.com'),field);
 assert.ok(base.product_page_url.startsWith('https://www.mazak.com/us-en/'));
 assert.ok(base.brochure_url.startsWith('https://www.mazak.com/us-en/'));
 assert.equal(base.technical_spec_url,'');assert.match(base.product_page_scope,/form may be required/);
 assert.ok(!base.product_page_url.includes('/am/'));
 assert.equal(seed.manufacturers.find(r=>r.manufacturer==='MAZAK').official_website_url,'https://www.mazak.com/us-en/');
});
