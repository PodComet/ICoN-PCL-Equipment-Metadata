import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {withMsrpEstimates} from '../app/msrp-policy.ts';
import {pricePresentation} from '../app/catalog-lib.ts';
import {priceSnapshot} from '../app/process-lib.ts';
import {buildPlan,csvUpdateText} from '../app/csv-updates.ts';
const policy=JSON.parse(readFileSync(new URL('../app/data/msrp-policy.json',import.meta.url)));
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url)));
const row=(id,value='',currency='USD',patch={})=>({equipment_id:id,manufacturer:'Maker',model_name:id,category_id:'M99',category_name:'Test class',msrp_value:value,msrp_currency:currency,price_source_url:'https://maker.test/'+id,price_checked_date:'2026-10-16',...patch});
const review=(id,target)=>({equipment_id:id,manufacturer:'Maker',model_name:id,lifecycle_status:'newer_model_confirmed',successor_model_name:target,successor_relationship:'direct_successor',successor_product_url:'https://maker.test/'+target,successor_evidence_url:'https://maker.test/news'});
test('closest documented older priced generation wins before category extrema',()=>{
 const records=[row('old','1000'),row('middle','2000'),row('new'),row('expensive','10000')],reviews=[review('old','middle'),review('middle','new')];
 const out=withMsrpEstimates(records,reviews,policy).find(r=>r.equipment_id==='new');assert.equal(out.estimated_msrp_low,'2400');assert.equal(out.estimated_msrp_high,'2400');assert.equal(out.estimate_method,'older_model_plus_20');assert.equal(out.estimate_benchmark_ids,'middle');
 records[1].msrp_value='';assert.equal(withMsrpEstimates(records,reviews,policy)[2].estimated_msrp_low,'1200');
});
test('category interval uses 120% of minimum and 80% of maximum without mixing currencies',()=>{
 const records=[row('low','1000'),row('high','5000'),row('yen','1000000','JPY'),row('target')];
 const out=withMsrpEstimates(records,[],policy).at(-1);assert.equal(out.estimated_msrp_low,'1200');assert.equal(out.estimated_msrp_high,'4000');assert.equal(out.estimate_currency,'USD');assert.equal(out.estimate_method,'category_120_80');
 assert.equal(pricePresentation(out).estimated,true);assert.equal(priceSnapshot(out).kind,'estimate');
});
test('narrow/single benchmark ranges stay unavailable rather than being reversed',()=>{
 for(const records of [[row('only','1000'),row('target')],[row('low','1000'),row('high','1200'),row('target')]]){
  const out=withMsrpEstimates(records,[],policy).at(-1);assert.equal(out.estimate_status,'inverted_range');assert.equal(out.estimated_msrp_low,'');assert.equal(out.estimated_msrp_high,'');
 }
});
test('only explicit MSRP and qualifying list prices anchor a range; estimates/sales/starting prices never do',()=>{
 const priced=kind=>row(kind,'','USD',{manufacturer_price_value:kind==='list_price'?'1000':'5000',manufacturer_price_currency:'USD',manufacturer_price_kind:kind,manufacturer_price_source_url:'https://maker.test/'+kind,manufacturer_price_checked_date:'2026-10-16',manufacturer_price_scope:'Named configuration'});
 const values=[priced('list_price'),priced('sale_price'),priced('starting_price'),priced('published_price'),row('target','',undefined,{estimated_msrp_low:'1',estimated_msrp_high:'100000'})];
 assert.equal(withMsrpEstimates(values,[],policy).at(-1).estimate_status,'inverted_range');
 assert.equal(withMsrpEstimates(values,[],{...policy,benchmark_policy:'explicit_msrp_only'}).at(-1).estimate_status,'no_benchmarks');
});
test('browser and offline seed use identical formulas, sources and status for every model',()=>{
 const calculated=withMsrpEstimates(seed.records,seed.model_lifecycle,policy);
 for(const [i,r] of calculated.entries())for(const key of Object.keys(r).filter(k=>k.startsWith('estimate')))assert.equal(r[key],seed.records[i][key],r.equipment_id+' '+key);
});
test('CSV preview recalculates and clears inherited estimates on new models',()=>{
 const plan=buildPlan(csvUpdateText([{operation:'add_equipment',equipment_id:'QA-NEW-M03',category_id:'M03',manufacturer:'IKA',model_name:'New test model'}]),seed.records,seed.categories,seed.routes,seed.manufacturers,seed.category_aliases);
 assert.deepEqual(plan.errors,[]);assert.equal(plan.changes[0].after.estimate_method,'category_120_80');assert.equal(plan.changes[0].after.estimated_msrp_low,'2788.8');
});
