import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {manufacturerPrice,validateManufacturerPrice,pricePresentation,MANUFACTURER_PRICE_FIELDS} from '../app/catalog-lib.ts';
import {buildPlan,csvUpdateText} from '../app/csv-updates.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const plan=rows=>buildPlan(csvUpdateText(rows),seed.records,seed.categories,seed.routes,seed.manufacturers);
test('published list prices keep their source and never become exact MSRP',()=>{
 const rows=seed.records.filter(r=>r.manufacturer_price_value);
 assert.equal(rows.length,9);
 for(const r of rows){assert.equal(validateManufacturerPrice(r),'');assert.equal(manufacturerPrice(r).label,'Manufacturer list price');assert.equal(r.msrp_value,'');assert.equal(pricePresentation(r).estimated,true)}
});
test('published prices require complete evidence and clearing removes stale metadata',()=>{
 const base={operation:'update',equipment_id:'M02-01',manufacturer_price_value:'1000',manufacturer_price_currency:'USD',manufacturer_price_kind:'list_price',manufacturer_price_source_url:'https://example.org/model',manufacturer_price_checked_date:'2026-02-30',manufacturer_price_scope:'Model and configuration'};
 assert.ok(plan([base]).errors.length);
 assert.ok(plan([{...base,manufacturer_price_checked_date:'2026-10-14',manufacturer_price_kind:'MSRP'}]).errors.length);
 assert.ok(plan([{...base,manufacturer_price_checked_date:'2026-10-14',manufacturer_price_source_url:'javascript:alert(1)'}]).errors.length);
 const cleared=plan([{operation:'update',equipment_id:'M02-01',manufacturer_price_value:'[CLEAR]'}]);
 assert.equal(cleared.errors.length,0);for(const k of MANUFACTURER_PRICE_FIELDS)assert.equal(cleared.changes[0].after[k],'');
});
test('a new variant cannot inherit a parent configuration price',()=>{
 const result=plan([{operation:'add_variant',equipment_id:'QA-VARIANT-PRICE',parent_equipment_id:'M02-01',model_name:'New configuration'}]);
 assert.equal(result.errors.length,0);for(const k of MANUFACTURER_PRICE_FIELDS)assert.equal(result.changes[0].after[k],'');
 assert.equal(manufacturerPrice(result.changes[0].after),null);
});
