import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {marketPacks,filterMarketPacks} from '../app/material-market-lib.ts';
const data=JSON.parse(readFileSync(new URL('../app/data/components.json',import.meta.url)));
const catalog=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url)));

test('pack aliases preserve every sourced process and cannot merge grades or pack sizes',()=>{
 const offer={...data.offers[0],offer_id:'a',component_id:'a',seller:'Synthetic vendor',sku:'TEST-1',grade:'Grade A',pack_quantity:1,pack_unit:'g'};
 const data2={...data,offers:[offer,{...offer,offer_id:'b',component_id:'b',checked_date:'2026-10-18'},{...offer,offer_id:'c',component_id:'c',grade:'Grade B'},{...offer,offer_id:'d',component_id:'d',pack_quantity:2}],formulations:[{...data.formulations[0],route_id:'P01',components:[{...data.formulations[0].components[0],component_id:'a',eligible_offer_ids:[]}]},{...data.formulations[0],route_id:'P27',components:[{...data.formulations[0].components[0],component_id:'b',eligible_offer_ids:[]}]}]};
 const packs=marketPacks(data2,catalog.routes);assert.equal(packs.length,3);
 const merged=packs.find(p=>p.component_ids.includes('b'));assert.equal(merged.offer.offer_id,'b');assert.deepEqual(merged.processes.map(p=>p.route_id),['P01','P27']);
 assert.equal(packs.find(p=>p.component_ids.includes('c')).processes.length,0);
 assert.equal(packs.find(p=>p.component_ids.includes('d')).processes.length,0);
});

test('market searches and P filters use documented formulation links without changing budget eligibility',()=>{
 const before=JSON.stringify(data),packs=marketPacks(data,catalog.routes);
 const matches=filterMarketPacks(packs,'cesium','P44');assert.ok(matches.length>0);
 assert.ok(matches.every(p=>p.processes.some(p=>p.route_id==='P44'&&p.sources.every(s=>s.source_url))));
 assert.equal(filterMarketPacks(packs,'cesium','P27').length,0);
 assert.ok(filterMarketPacks(packs,'P44').some(p=>p.offer.component_id==='cesium-carbonate'));
 assert.equal(JSON.stringify(data),before);
 for(const p of matches)assert.ok(!data.formulations.flatMap(f=>f.components).some(c=>c.eligible_offer_ids.includes(p.offer.offer_id)));
});
