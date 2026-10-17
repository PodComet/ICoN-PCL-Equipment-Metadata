import test from 'node:test';
import assert from 'node:assert/strict';
import {sellerOffers,sellerPrice,validateSellerOffer} from '../app/seller-prices.ts';
import {pricePresentation,manufacturerPrice} from '../app/catalog-lib.ts';
import {priceSnapshot} from '../app/process-lib.ts';
import {readFileSync} from 'node:fs';
const record={equipment_id:'QA-ONE',manufacturer:'Example',model_name:'Example 250'};
const quote={offer_id:'OFFER-ONE',...record,seller_name:'Research Seller',price_value:'1000',currency:'USD',price_kind:'list_price',condition:'new',source_url:'https://example.org/product',checked_date:'2026-10-17',scope:'Exact 250 model, 120 V base unit, accessories excluded.'};
test('seller offers require complete dated evidence and preserve their label and condition',()=>{
 assert.equal(validateSellerOffer(quote),'');
 for(const patch of [{condition:'probably_new'},{price_kind:'MSRP'},{price_value:''},{price_value:'NaN'},{price_value:'0'},{currency:'$'},{source_url:'javascript:alert(1)'},{checked_date:'2026-02-30'},{seller_name:''},{scope:''}])assert.ok(validateSellerOffer({...quote,...patch}));
 const [p]=sellerOffers(record,[quote]);assert.equal(p.label,'Seller list price');assert.equal(p.value,'$1,000');assert.equal(p.conditionLabel,'New');
});
test('renamed, copied and different-capacity instruments cannot inherit seller offers',()=>{
 for(const patch of [{equipment_id:'QA-COPY'},{model_name:'Example 400'},{manufacturer:'Another brand'}])assert.deepEqual(sellerOffers({...record,...patch},[quote]),[]);
});
test('only explicitly new equipment is eligible for new-equipment planning prices',()=>{
 for(const condition of ['used','refurbished','unspecified']){
  const offer={...quote,condition};assert.equal(sellerPrice(record,true,[offer]),null);assert.equal(sellerPrice(record,false,[offer]).condition,condition);
 }
 assert.equal(sellerPrice(record,true,[{...quote,condition:'used',price_value:'100'},quote]).price_value,'1000');
 assert.equal(sellerPrice(record,true,[{...quote,currency:'ZZZ'}]),null);
});
test('seller source amounts retain currency and display their dated USD equivalent',()=>{
 const p=sellerPrice(record,true,[{...quote,currency:'EUR'}]);assert.notEqual(p.value,'$1,000');assert.equal(p.currency,'EUR');assert.equal(p.price_value,'1000');
});
test('published manufacturer/new seller prices precede estimates and snapshots use the same source',()=>{
 const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
 const offers=JSON.parse(readFileSync(new URL('../app/data/seller-offers.json',import.meta.url),'utf8')).offers;
 for(const r of seed.records){
  const published=manufacturerPrice(r),seller=sellerPrice(r),p=pricePresentation(r);
  if(!r.msrp_value&&published){assert.equal(p.label,published.label);assert.equal(priceSnapshot(r).kind,'manufacturer');}
  else if(!r.msrp_value&&seller){assert.equal(p.label,seller.label);assert.equal(priceSnapshot(r).kind,'seller');assert.equal(priceSnapshot(r).source_url,seller.source_url);}
 }
 for(const o of offers){assert.equal(validateSellerOffer(o),'',o.offer_id);const r=seed.records.find(r=>r.equipment_id===o.equipment_id);assert.ok(r,o.equipment_id);assert.ok(sellerOffers(r).some(p=>p.offer_id===o.offer_id));}
});
