import test from 'node:test';
import assert from 'node:assert/strict';
import {usdConversion,usdText,usdPrice,currencyReference} from '../app/currency-lib.ts';
import {pricePresentation} from '../app/catalog-lib.ts';
import {priceSnapshot,workflowBudget} from '../app/process-lib.ts';
test('USD is unchanged and EUR, JPY and INR use the dated ECB cross-rate',()=>{
 assert.equal(usdConversion(6000,'USD').value,6000);assert.equal(usdText(6000,'USD'),'$6,000');
 for(const c of ['EUR','JPY','INR']){const q=usdConversion(1000,c);assert.equal(q.currency,'USD');assert.ok(Math.abs(q.value-1000*currencyReference.units_per_eur.USD/currencyReference.units_per_eur[c])<1e-10);assert.equal(q.original_currency,c);assert.equal(q.rate_date,currencyReference.date);assert.match(q.rate_source_url,/ecb.europa.eu/);}
});
test('unknown currencies, invalid values and missing prices are never silently treated as USD',()=>{
 for(const [amount,code] of [[100,'XYZ'],['','USD'],[-1,'USD'],['not a price','USD']])assert.equal(usdConversion(amount,code),null);assert.equal(usdConversion(0,'JPY').value,0);assert.equal(usdText(1,'XYZ'),'USD conversion unavailable');
});
test('source MSRP retains its native quote and gains a distinct USD-equivalent label',()=>{
 const source={msrp_value:'100000',msrp_currency:'JPY',price_source_url:'https://example.org/model',price_checked_date:'2026-10-16'};
 assert.equal(pricePresentation(source).label,'MSRP (USD equivalent)');assert.ok(pricePresentation(source).value.startsWith('$'));const q=priceSnapshot(source);assert.equal(q.currency,'USD');assert.equal(q.original_quote.currency,'JPY');assert.equal(q.original_quote.low,100000);assert.equal(q.fx_rate_date,currencyReference.date);assert.equal(source.msrp_currency,'JPY');
});
test('already converted price snapshots are not converted twice',()=>{
 const q={kind:'msrp',currency:'EUR',low:200,high:200,scope:'Source quote'},usd=usdPrice(q);assert.equal(usdPrice(usd).low,usd.low);assert.equal(q.currency,'EUR');assert.equal(usd.original_quote.low,200);
});
test('historic native-currency snapshots total in USD and unavailable conversions remain missing',()=>{
 const instrument=(id,currency,low)=>({instance_id:id,equipment_id:id,quantity:1,extensions:{},price_snapshot:{kind:'msrp',currency,low,high:low,scope:'Historical quote'}});
 const b=workflowBudget([{slots:[{instrument:instrument('a','EUR',100)},{instrument:instrument('b','USD',50)},{instrument:instrument('c','XYZ',10)}]}]);assert.equal(b.totals.length,1);assert.equal(b.totals[0].currency,'USD');assert.equal(b.totals[0].low,usdConversion(100,'EUR').value+50);assert.equal(b.missing,1);
});
