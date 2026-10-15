import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {csvText,groupRows,matches,safeUrl,VERIFIED,documentationLink,pricePresentation,verifiedManufacturer,applyManufacturerAudit,filterRows,filterCounts,rangeSelection} from '../app/catalog-lib.ts';

const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const rows=seed.records.map(record=>({record,revision:0}));

test('Purdue filter contains exactly the requested distinct records',()=>{
 const result=rows.filter(r=>matches(r,'','','','',false,true));
 assert.equal(result.length,44);
 assert.equal(result.filter(r=>r.record.model_name==='Renishaw AM400').length,1);
});
test('material/process/name filters compose without searching checksum noise',()=>{
 const result=rows.filter(r=>matches(r,'Genizer','M43','N06','',false,false));
 assert.ok(result.length>=5);
 assert.ok(result.every(r=>r.record.category_id==='M43'));
 const sourced=rows.find(r=>r.record.source_sha256);
 assert.equal(matches(sourced,sourced.record.source_sha256,'','','',false,false),false);
});
test('real capacity variants share one equipment card',()=>{
 const extruders=rows.filter(r=>r.record.model_name.startsWith('Genizer GJE-'));
 assert.equal(groupRows(extruders).length,1);
 assert.deepEqual(extruders.map(r=>r.record.capacity_ml),['10','100','800','3000','10000']);
});
test('manual filter does not promote source or generation-uncertain documents',()=>{
 const result=rows.filter(r=>matches(r,'','','','',true,false));
 assert.equal(result.length,seed.coverage.manual_coverage[VERIFIED]);
 assert.ok(result.every(r=>r.record.manual_match_status===VERIFIED));
});
test('external URLs and spreadsheet exports reject executable prefixes',()=>{
 assert.equal(safeUrl('javascript:alert(1)'), '');
 assert.equal(safeUrl('data:text/html,hello'), '');
 assert.ok(safeUrl('https://www.purdue.edu/'));
 const csv=csvText([{equipment_id:'one',model_name:'=HYPERLINK("bad")',notes:'a,b\nsecond line'}]);
 assert.ok(csv.startsWith('\ufeff'));
 assert.ok(csv.includes("'=HYPERLINK"));
 assert.ok(csv.includes('"a,b\nsecond line"'));
});

test('exact MSRP takes priority over clearly marked class estimates',()=>{
 const r={equipment_id:'price-test',model_name:'Test',estimated_msrp_low:'5000',estimated_msrp_high:'20000',estimate_currency:'USD'};
 assert.deepEqual(pricePresentation(r),{label:'Estimated MSRP*',value:'$5,000–$20,000',estimated:true});
 const actual=pricePresentation({...r,msrp_value:'7500',msrp_currency:'USD'});
 assert.equal(actual.estimated,false);assert.equal(actual.label,'MSRP');assert.equal(actual.value,'$7,500');
});
test('card documentation selects manual before specifications and rejects unsafe URLs',()=>{
 const r={equipment_id:'doc-test',model_name:'Test',manual_url:'https://example.com/manual',manual_match_status:VERIFIED,technical_spec_url:'https://example.com/spec'};
 assert.equal(documentationLink(r).label,'Operating manual');
 assert.equal(documentationLink({...r,manual_url:'javascript:bad'}).label,'Technical specifications');
 assert.equal(documentationLink({...r,manual_url:'',technical_spec_url:''}),null);
});

test('missing checked manuals fall back to specifications, brochure and product page',()=>{
 const r={equipment_id:'fallback-doc',model_name:'Instrument',manual_match_status:'not_verified',manual_url:'https://example.com/unreviewed-manual',technical_spec_url:'https://example.com/spec',brochure_url:'https://example.com/brochure',product_page_url:'https://example.com/model'};
 assert.equal(documentationLink(r).label,'Technical specifications');
 assert.equal(documentationLink({...r,technical_spec_url:''}).label,'Brochure');
 assert.equal(documentationLink({...r,technical_spec_url:'',brochure_url:''}).label,'Manufacturer product page');
 assert.equal(documentationLink({...r,technical_spec_url:'javascript:bad',brochure_url:'https://example.com/brochure'}).label,'Brochure');
 assert.equal(documentationLink({...r,manual_match_status:VERIFIED}).label,'Operating manual');
});

test('every class has explicit estimates and component estimates avoid full-system bands',()=>{
 assert.ok(seed.records.every(r=>Number(r.estimated_msrp_low)>0&&Number(r.estimated_msrp_high)>=Number(r.estimated_msrp_low)&&r.estimate_basis&&r.estimate_source_urls));
 const mobile=seed.records.find(r=>r.equipment_id==='REQ-EQ-043');
 assert.equal(mobile.estimate_subject,'Research mobile base, excluding robot arm');
 assert.ok(Number(mobile.estimated_msrp_high)<25000);
 const cell=seed.records.find(r=>r.equipment_id==='REQ-EQ-027');
 assert.match(cell.estimate_subject,/excluding potentiostat/);
 assert.ok(seed.records.filter(r=>r.image_url).every(r=>safeUrl(r.image_url)&&safeUrl(r.image_source_url)&&r.image_scope));
});

test('Proto AXRD has an official manufacturer link and a scoped family photo',()=>{
 const r=seed.records.find(r=>r.equipment_id==='M37-09');
 assert.equal(new URL(r.product_page_url).hostname,'www.protoxrd.com');
 assert.ok(safeUrl(r.image_url));assert.match(r.image_scope,/configuration is unspecified/);
});

test('green stars require both official presence and independent research evidence',()=>{
 const r={equipment_id:'brand-test',model_name:'Instrument',manufacturer:'Example',manufacturer_brand_identity_status:'verified_manufacturer',manufacturer_official_website_url:'https://example.com',manufacturer_research_use_status:'research_supplier_claim_only',manufacturer_research_evidence_url:'https://example.com/research'};
 assert.equal(verifiedManufacturer(r),false);
 assert.equal(verifiedManufacturer({...r,manufacturer_research_use_status:'documented_research_use',manufacturer_research_evidence_url:'https://research.edu/lab'}),true);
 const changed=applyManufacturerAudit({...r,manufacturer:'Unknown',manufacturer_research_use_status:'documented_research_use'},[]);
 assert.equal(verifiedManufacturer(changed),false);
 assert.equal(changed.manufacturer_official_website_url,'');
});

test('FRITSCH confirmation grants its star without inventing independent research evidence',()=>{
 const brand=seed.manufacturers.find(b=>b.manufacturer==='FRITSCH');
 const records=seed.records.filter(r=>r.manufacturer==='FRITSCH');
 assert.equal(brand.verification_basis,'user_confirmation');
 assert.equal(brand.research_use_status,'research_supplier_claim_only');
 assert.equal(records.length,5);assert.ok(records.every(verifiedManufacturer));
 const unknown=applyManufacturerAudit({...records[0],manufacturer:'Unconfirmed maker'},seed.manufacturers);
 assert.equal(unknown.manufacturer_verification_basis,'');assert.equal(verifiedManufacturer(unknown),false);
});

test('multi-select filters use OR inside each list and AND across lists',()=>{
 const filters={query:'',category:['M13','M37'],manufacturer:['Eppendorf','Proto'],material:[],process:[],manualOnly:false,requestedOnly:false};
 assert.equal(filterRows(rows,filters).length,6);
 const narrowed=filterRows(rows,{...filters,material:['N06']});
 assert.equal(narrowed.length,4);assert.ok(narrowed.every(r=>r.record.manufacturer==='Eppendorf'));
});
test('option counts respect other filters without constraining their own list',()=>{
 const filters={query:'',category:['M37'],manufacturer:['Eppendorf'],material:[],process:[],manualOnly:false,requestedOnly:false};
 assert.equal(filterRows(rows,filters).length,0);
 const counts=filterCounts(rows,filters,'category');assert.equal(counts.get('M13'),4);assert.equal(counts.get('M37')||0,0);
});
test('shift selection adds or removes a contiguous range and preserves unrelated selections',()=>{
 assert.deepEqual(rangeSelection(['z'],['a','b','c','d'],'a','c',true),['z','a','b','c']);
 assert.deepEqual(rangeSelection(['z','a','b','c'],['a','b','c','d'],'b','c',false),['z','a']);
});
