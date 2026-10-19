import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {componentQuantity,parseComponentAmount,formulationPlan,materialCost,materialsBudget,unchangedFormulation,componentOffers} from '../app/component-lib.ts';
import {overallProcessBudget} from '../app/process-budget-lib.ts';
import {materialPlanFor,withMaterialPlan} from '../app/process-materials-lib.ts';
import {assignInstrument,createWorkflow,validateWorkflow,workflowBudget} from '../app/process-lib.ts';
const read=name=>JSON.parse(readFileSync(new URL('../app/data/'+name+'.json',import.meta.url)));
const data=read('components'),catalog=read('catalog');
const route=id=>catalog.routes.find(r=>r.route_id===id),workflow=id=>createWorkflow(route(id),catalog.steps);
const formulation=id=>data.formulations.find(f=>f.route_id===id);

test('United MSL3X1 dealer quotes remain selectable reusable-substrate acquisitions for P27',()=>{
 const f=formulation('P27'),plan=formulationPlan(f),line=f.components.find(c=>c.line_id==='P27-LITERATURE-20261017-C10');
 const material=plan.inputs.find(m=>m.component_line_id===line.line_id);
 const offers=componentOffers(line,data).filter(o=>o.offer_id.startsWith('PACK-UNITED261018-'));
 assert.equal(line.cost_scope,'reusable');assert.equal(offers.length,3);
 assert.deepEqual(offers.map(o=>o.price_value).sort((a,b)=>a-b),[6.66,7,7.98]);
 for(const offer of offers){
  assert.equal(offer.sku,'MSL3X1');assert.equal(offer.pack_quantity,72);assert.equal(offer.pack_unit,'piece');assert.equal(offer.currency,'USD');
  const cost=materialCost({...material,offer_id:offer.offer_id},plan,data);
  assert.equal(cost.offer.offer_id,offer.offer_id);assert.equal(cost.cost_usd,null);
 }
 const photographed=offers.filter(o=>o.image_url);assert.equal(photographed.length,1);
 assert.equal(photographed[0].seller,'Nexera Scientific');assert.ok(photographed[0].image_source_url.includes('nexerasci.com/products/'));
});

test('every P-class has reviewed component coverage and P43 has no invented nanomaterial recipe',()=>{
 assert.equal(data.formulations.length,46);
 assert.deepEqual(data.formulations.map(f=>f.route_id).sort(),catalog.routes.filter(r=>r.route_id.startsWith('P')).map(r=>r.route_id).sort());
 assert.equal(formulation('P43').completeness,'not_applicable');assert.equal(formulation('P43').components.length,0);
 for(const f of data.formulations){assert.ok(f.batch_basis&&f.source_url&&f.scope);const p=formulationPlan(f);assert.ok(p.inputs.length<=30);validateWorkflow(withMaterialPlan(workflow(f.route_id),p),catalog.routes,catalog.records);}
});
test('only absolute compatible quantities are parsed; concentration, gas flow, ranges and compound text need review',()=>{
 assert.deepEqual(parseComponentAmount('200 mg'),{value:.2,dimension:'mass'});
 assert.deepEqual(parseComponentAmount('500 µL'),{value:.5,dimension:'volume'});
 assert.deepEqual(componentQuantity(1,'L'),{value:1000,dimension:'volume'});
 for(const value of ['5 wt%','0.1 M','20 sccm','10–20 mL','2.5 g in 50 mL','-5 g','Infinity g','1 mL + wash'])assert.equal(parseComponentAmount(value),null,value);
});
test('P30 DMSO consumption is prorated from the verified pack quote and changes with an edited amount',()=>{
 const p=formulationPlan(formulation('P30')),m=p.inputs.find(m=>m.name==='Dimethyl sulfoxide'),cost=materialCost(m,p,data);
 assert.equal(cost.status,'priced');assert.ok(Math.abs(cost.cost_usd-29.144)<1e-8);
 assert.ok(Math.abs(materialCost({...m,amount:'100 mL'},p,data).cost_usd-14.572)<1e-8);
 assert.equal(materialCost({...m,amount:'20 wt%'},p,data).cost_usd,null);
 assert.equal(materialCost({...m,amount:'100 mg'},p,data).cost_usd,null);
 assert.equal(materialCost({...m,name:'Different custom chemical'},p,data).cost_usd,null);
});
test('changing a formulation amount removes exact-formulation status while retaining source context and input IDs',()=>{
 const p=formulationPlan(formulation('P30'));assert.equal(unchangedFormulation(p,data).route_id,'P30');
 const altered={...p,inputs:p.inputs.map(m=>m.name==='Dimethyl sulfoxide'?{...m,amount:'100 mL'}:m)};
 assert.equal(unchangedFormulation(altered,data),null);assert.equal(altered.inputs[0].material_id,p.inputs[0].material_id);
 const saved=validateWorkflow(JSON.parse(JSON.stringify(withMaterialPlan(workflow('P30'),altered))),catalog.routes,catalog.records);assert.deepEqual(materialPlanFor(saved),altered);
});
test('dilute stocks, ambiguous quantities, stock preparations and reusable targets do not inherit a neat reagent price',()=>{
 for(const id of ['P01','P03','P10','P18','P31','P34','P40']){
  const p=formulationPlan(formulation(id));for(const m of p.inputs){const c=formulation(id).components.find(c=>c.line_id===m.component_line_id);if(c.amount_status==='ambiguous'||c.cost_scope!=='consumed')assert.equal(materialCost(m,p,data).cost_usd,null,m.name);}
 }
 const p=formulationPlan(formulation('P18')),stock=p.inputs.find(m=>/silver nitrate/i.test(m.name));assert.equal(materialCost(stock,p,data).cost_usd,null);
});
test('overall total adds selected materials once to equipment and preserves partial-price status',()=>{
 const p=formulationPlan(formulation('P30'));let w=workflow('P30');
 const empty=overallProcessBudget(w.steps,{...p,inputs:[]},data);assert.equal(empty.total_low_usd,0);assert.equal(empty.partial,false);
 const onlyMaterials=overallProcessBudget(w.steps,p,data);assert.ok(Math.abs(onlyMaterials.total_low_usd-29.144)<1e-8);assert.ok(onlyMaterials.partial);assert.ok(onlyMaterials.materials.unpriced>0);
 const slot=w.steps.flatMap(s=>s.slots)[0],instrument=catalog.records.find(r=>slot.allowed_category_ids.includes(r.category_id));w=assignInstrument(w,slot.slot_id,instrument);
 const total=overallProcessBudget(w.steps,p,data),equipment=workflowBudget(w.steps);
 assert.equal(total.total_low_usd,total.equipment_low_usd+materialsBudget(p,data).consumed_subtotal_usd);assert.deepEqual(total.equipment,equipment);
});
test('quote identity and price evidence survive workflow budget snapshot export',()=>{
 const p=formulationPlan(formulation('P30')),w=withMaterialPlan(workflow('P30'),p),budget=overallProcessBudget(w.steps,p,data);
 w.extensions.process_budget_snapshot=budget;
 const saved=validateWorkflow(JSON.parse(JSON.stringify(w)),catalog.routes,catalog.records),quote=saved.extensions.process_budget_snapshot.materials.lines.find(l=>l.status==='priced');
 assert.ok(quote.offer.sku&&quote.offer.source_url&&quote.offer.checked_date);assert.equal(quote.offer.currency,'USD');assert.equal(quote.conversion.rate,1);
});

test('a sourced molecular weight prices a molar solid amount without inventing liquid density',()=>{
 const p=formulationPlan(formulation('P32')),salt=p.inputs.find(m=>m.name.startsWith('Potassium acetate')),liquid=p.inputs.find(m=>m.name.startsWith('Titanium(IV) isopropoxide'));
 const quote=materialCost(salt,p,data);assert.equal(quote.status,'priced');assert.ok(quote.offer.molar_mass_source_url);assert.ok(Math.abs(quote.quantity.value-0.559398)<1e-8);
 assert.equal(materialCost(liquid,p,data).cost_usd,null);
});

test('reviewed quote aliases appear in selection while incompatible reference packs never acquire a dose cost',()=>{
 const p=formulationPlan(formulation('P30')),m=p.inputs.find(m=>m.name==='Dimethyl sulfoxide'),c=formulation('P30').components.find(c=>c.line_id===m.component_line_id),source=data.offers.find(o=>c.eligible_offer_ids.includes(o.offer_id));
 const alias={...source,component_id:'reviewed-alternate-identity'},bound={...data,offers:data.offers.map(o=>o.offer_id===alias.offer_id?alias:o)};
 assert.ok(componentOffers(c,bound).some(o=>o.offer_id===alias.offer_id));assert.equal(materialCost(m,p,bound).status,'priced');
 for(const id of ['P10','P18','P22','P24','P27','P37']){
  const plan=formulationPlan(formulation(id));
  for(const material of plan.inputs){
   const line=formulation(id).components.find(c=>c.line_id===material.component_line_id);
   if(/silver-nitrate-.*aqueous|silver-nitrate-1mm|pdms-sylgard184|sylgard184-curing/.test(line.component_id)){
    assert.ok(componentOffers(line,data).length>0);assert.equal(materialCost(material,plan,data).cost_usd,null);
   }
  }
 }
});
