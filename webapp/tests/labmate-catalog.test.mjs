import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupRows,pricePresentation,documentationLink,verifiedManufacturer} from '../app/catalog-lib.ts';
const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url)));
const rows=seed.records.filter(r=>r.manufacturer==='Labmate');
test('Labmate variants retain their own photos/prices and do not acquire unverified green stars or manuals',()=>{
 assert.equal(rows.length,8);
 assert.equal(groupRows(rows.map(record=>({record,revision:0}))).length,7);
 for(const r of rows){
  assert.ok(r.image_url&&r.image_scope);
  assert.equal(verifiedManufacturer(r),false);
  assert.equal(pricePresentation(r).estimated,false);
  assert.equal(documentationLink(r).url,r.technical_spec_url);
  assert.notEqual(documentationLink(r).label,'Operating manual');
  assert.equal(r.purdue_list,'false');
 }
 const family=rows.filter(r=>r.category_id==='M63');
 assert.equal(new Set(family.map(r=>r.product_family_id)).size,1);
 assert.equal(new Set(family.map(r=>r.manufacturer_price_value)).size,2);
 assert.equal(new Set(family.map(r=>r.image_url)).size,2);
});
