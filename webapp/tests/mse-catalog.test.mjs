import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {refreshResearchEvidence,withSharedResearchOverrides} from '../app/research-policy.ts';
import {sellerPrice} from '../app/seller-prices.ts';

const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url)));
const updates=JSON.parse(readFileSync(new URL('../app/data/research-updates.json',import.meta.url)));
const review=JSON.parse(readFileSync(new URL('../../catalog/mse_catalog_review_2026-10-19.json',import.meta.url)));

test('MSE exact-model photos reach untouched saved profiles and preserve deliberate image edits',()=>{
 for(const photo of review.instrument_images){
  const current=seed.records.find(r=>r.equipment_id===photo.equipment_id);
  const prior={...current,...photo.before,notes:'Keep my local experiment notes'};
  const refreshed=refreshResearchEvidence(prior,updates);
  assert.equal(refreshed.image_url,photo.after.image_url,current.model_name);
  assert.equal(refreshed.notes,prior.notes);
  const custom={...prior,image_url:'https://example.org/my-instrument.jpg'};
  assert.equal(refreshResearchEvidence(custom,updates).image_url,custom.image_url);
  assert.equal(refreshResearchEvidence(withSharedResearchOverrides(prior,['image_url']),updates).image_url,prior.image_url);
  assert.equal(refreshResearchEvidence({...prior,model_name:'An unrelated machine'},updates).image_url,prior.image_url);
 }
});

test('new pump prices retain exact sensor/ballast configurations and cannot transfer to another model',()=>{
 for(const offered of review.seller_offers){
  const record=seed.records.find(r=>r.equipment_id===offered.equipment_id),quote=sellerPrice(record);
  assert.ok(quote);
  assert.equal(quote.price_value,offered.price_value);
  assert.equal(quote.price_kind,'published_price');
  assert.ok(quote.scope.includes(offered.seller_sku));
  assert.ok(quote.source_url.includes(String(offered.variant_id)));
  assert.equal(sellerPrice({...record,model_name:'Different pump'}),null);
 }
});
