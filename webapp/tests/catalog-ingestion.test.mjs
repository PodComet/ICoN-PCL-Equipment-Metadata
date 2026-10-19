import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {materialCost,formulationPlan,unchangedFormulation} from '../app/component-lib.ts';
import {emptyMaterialPlan,newStartingMaterial,withMaterialPlan,materialPlanFor} from '../app/process-materials-lib.ts';
import {replaceMaterial} from '../app/material-options.ts';
import {marketPacks,filterMarketPacks} from '../app/material-market-lib.ts';
import {createWorkflow,slotAccepts,assignInstrument,fillMatchingInstrumentSlots,validateWorkflow} from '../app/process-lib.ts';
import {processDependencyGraph,stepDependencies} from '../app/process-dependencies.ts';
const read=n=>JSON.parse(readFileSync(new URL('../app/data/'+n+'.json',import.meta.url)));
const data=read('components'),catalog=read('catalog');
const route=id=>catalog.routes.find(r=>r.route_id===id);
const marketInput=c=>newStartingMaterial({name:c.name,role:c.role,component_id:c.component_id,component_line_id:c.line_id},'2 mg');

test('reviewed market inputs price only exact identities and user amounts within their scoped process',()=>{
 const c=data.market_components.find(c=>c.component_id==='usnano-us1011-graphene-dry'),m=marketInput(c),plan={...emptyMaterialPlan('P29'),inputs:[m]};
 const cost=materialCost(m,plan,data);assert.equal(cost.status,'priced');assert.equal(cost.cost_usd,.56);assert.equal(cost.formulation_id,'');
 assert.match(cost.reason,/User-entered/);assert.equal(unchangedFormulation(plan,data),null);
 assert.equal(materialCost({...m,amount:''},plan,data).cost_usd,null);
 assert.equal(materialCost({...m,name:'Different graphene'},plan,data).cost_usd,null);
 assert.equal(materialCost(m,{...plan,route_id:'P01'},data).cost_usd,null);
 assert.equal(materialCost({...m,amount:'2 mL'},plan,data).cost_usd,null);
 let w=withMaterialPlan(createWorkflow(route('P29'),catalog.steps),plan);
 assert.deepEqual(materialPlanFor(validateWorkflow(JSON.parse(JSON.stringify(w)),catalog.routes,catalog.records)),plan);
 const replaced=replaceMaterial(plan,m.material_id,{name:'Graphite',role:'feedstock'});
 assert.equal(replaced.inputs[0].component_id,undefined);assert.equal(materialCost(replaced.inputs[0],replaced,data).cost_usd,null);
});

test('dispersion volume stays distinct from dry powder and article-specific nanofillers retain their identities',()=>{
 const c=data.market_components.find(c=>c.component_id==='usnano-us7906-go-water1pct'),m={...marketInput(c),amount:'1 mL'},p={...emptyMaterialPlan('P29'),inputs:[m]};
 assert.ok(Math.abs(materialCost(m,p,data).cost_usd-980/30)<1e-10);
 assert.equal(materialCost({...m,amount:'1 g'},p,data).cost_usd,null);
 for(const rid of ['P16','P20','P37']){
  const f=data.formulations.find(f=>f.route_id===rid);
  assert.ok(f.components.filter(c=>/scaffaro|nanocyl/.test(c.component_id)).every(c=>!c.eligible_offer_ids.some(id=>id.startsWith('PACK-USNANO'))));
 }
 const f=data.formulations.find(f=>f.route_id==='P08'),p8=formulationPlan(f),silica=p8.inputs.find(m=>m.component_id==='silica-50nm');
 assert.ok(Math.abs(materialCost(silica,p8,data).cost_usd-.408)<1e-12);
 assert.ok(data.offers.filter(o=>o.offer_id.startsWith('PACK-USNANO')&&o.image_url).every(o=>/micrograph|microscopy/i.test(o.image_scope)));
});

test('market table exposes curated P links while source recipes and unrelated processes remain separate',()=>{
 const matches=filterMarketPacks(marketPacks(data,catalog.routes),'US4300','P29');
 assert.ok(matches.length>=3);assert.ok(matches.every(p=>p.processes.find(r=>r.route_id==='P29').sources.some(s=>s.formulation_id.startsWith('MARKET-'))));
 assert.equal(filterMarketPacks(marketPacks(data,catalog.routes),'US4300','P01').length,0);
});

test('MBE source compatibility prevents nitride/arsenide swaps and repeated slots share the selected configuration',()=>{
 const n=catalog.records.find(r=>r.equipment_id==='UCLA-UCLA-GEN930-N'),as=catalog.records.find(r=>r.equipment_id==='UCLA-UCLA-GEN930-ASSB');
 let w=createWorkflow(route('P46'),catalog.steps),slot=w.steps[0].slots[0];
 assert.ok(slotAccepts(slot,n,w.steps));assert.equal(slotAccepts(slot,as,w.steps),false);
 assert.throws(()=>assignInstrument(w,slot.slot_id,as),/does not match/);
 w=fillMatchingInstrumentSlots(assignInstrument(w,slot.slot_id,n),slot.slot_id).workflow;assert.ok(w.steps.slice(0,3).every(s=>s.slots[0].instrument.equipment_id===n.equipment_id));
 assert.equal(processDependencyGraph(w).errors.length,0);
 for(const s of w.steps.slice(3))assert.deepEqual(stepDependencies(w,s),[w.steps[2].step_id]);
 for(const id of ['P46','P47']){
  const f=data.formulations.find(f=>f.route_id===id);
  assert.equal(f.completeness,'recipe_not_reported');assert.deepEqual(f.components,[]);
  assert.ok(data.market_components.some(c=>c.route_ids.includes(id)));
 }
});
