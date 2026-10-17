import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {relevantMaterials,materialKey,amountChoices,materialPhoto,replaceMaterial} from '../app/material-options.ts';
import {materialOutcome,compositionExample,outputReference} from '../app/process-outcome-lib.ts';
import {emptyMaterialPlan,newStartingMaterial,planFromExample,withMaterialPlan,materialPlanFor} from '../app/process-materials-lib.ts';
import {createWorkflow,assignInstrument,validateWorkflow} from '../app/process-lib.ts';
const read=name=>JSON.parse(readFileSync(new URL('../app/data/'+name+'.json',import.meta.url)));
const data=read('process-materials'),seed=read('catalog'),media=read('material-images');
const workflow=id=>createWorkflow(seed.routes.find(r=>r.route_id===id),seed.steps);

test('material dropdowns use the chosen process and include its documented composition ingredients',()=>{
 const a=relevantMaterials(data,'P03'),b=relevantMaterials(data,'P33');
 assert.ok(a.some(m=>m.name==='Gold (Au)'));assert.ok(!a.some(m=>m.name==='Sodium hydroxide'));
 assert.ok(b.some(m=>m.name==='Sodium hydroxide'));assert.ok(b.some(m=>m.name==='Nitrogen'));
 for(const p of data.profiles){const choices=relevantMaterials(data,p.route_id);assert.equal(new Set(choices.map(materialKey)).size,choices.length);}
});
test('amount lists distinguish material forms and retain legacy amounts without changing input IDs',()=>{
 const solid={name:'Silver nitrate',role:'precursor'},water={name:'Water',role:'solvent'},wafer={name:'Silicon wafer',role:'substrate'};
 assert.ok(amountChoices(solid).some(a=>a.value==='10 mg'));assert.ok(!amountChoices(solid).some(a=>a.value==='10 mL'));
 assert.ok(amountChoices(water).some(a=>a.value==='10 mL'));assert.ok(amountChoices(wafer).some(a=>a.value==='1 piece'));
 assert.ok(amountChoices(water,'legacy 17.3 mL').some(a=>a.value==='legacy 17.3 mL'));
 const p={...emptyMaterialPlan('P03'),inputs:[newStartingMaterial(solid,'10 mg')],expected_output:'Old target',example_id:'old'};
 const changed=replaceMaterial(p,p.inputs[0].material_id,water);assert.equal(changed.inputs[0].material_id,p.inputs[0].material_id);assert.equal(changed.inputs[0].amount,'');assert.equal(changed.expected_output,'');assert.equal(p.inputs[0].name,'Silver nitrate');
});
test('all source compositions can be recognized through dropdown choices without assuming recipe quantities',()=>{
 for(const example of data.examples){const plan={...planFromExample(example),expected_output:'',example_id:''};
  assert.equal(compositionExample(plan,data).example_id,example.example_id);
  const result=materialOutcome(plan,data,workflow(plan.route_id));assert.equal(result.label,example.output_label);assert.equal(result.basis,'source_example');assert.equal(result.products[0].amount,'Output amount not established');
  plan.inputs.pop();assert.equal(compositionExample(plan,data),null);
 }
});
test('output card preserves the input amounts and actual equipment sequence without predicting yield',()=>{
 let w=workflow('P03');const input={...emptyMaterialPlan('P03'),inputs:[newStartingMaterial({name:'Gold (Au)',role:'target'},'1 target'),newStartingMaterial({name:'Water',role:'solvent'},'50 mL')]};
 w=withMaterialPlan(w,input);const slot=w.steps.flatMap(s=>s.slots).find(s=>s.allowed_category_ids.includes('M56')),instrument=seed.records.find(r=>r.category_id==='M56');w=assignInstrument(w,slot.slot_id,instrument);
 const before=JSON.stringify(w),result=materialOutcome(input,data,w);assert.equal(result.label,'Gold (Au) nanoparticle dispersion in Water');assert.equal(result.inputs[1].amount,'50 mL');
 assert.ok(result.sequence.some(s=>s.instruments.some(i=>i.equipment_id===instrument.equipment_id&&i.category_id==='M56')));
 assert.equal(result.products[0].amount,'Output amount not established');assert.equal(JSON.stringify(w),before);
 const saved=validateWorkflow(JSON.parse(JSON.stringify(w)),seed.routes,seed.records);assert.deepEqual(materialPlanFor(saved),input);
});

test('custom component names and free-text amounts survive saving and output export verbatim',()=>{
 const plan={...emptyMaterialPlan('P39'),inputs:[newStartingMaterial({name:'Cellulose blend A (research sample)',role:'feedstock'},'2.5 g in 40 mL; 3 aliquots'),newStartingMaterial({name:'Water',role:'solvent'},'17.3 mL + rinse as needed')]};
 const saved=validateWorkflow(JSON.parse(JSON.stringify(withMaterialPlan(workflow('P39'),plan))),seed.routes,seed.records);
 assert.deepEqual(materialPlanFor(saved),plan);
 const exported=JSON.parse(JSON.stringify(materialOutcome(materialPlanFor(saved),data,saved)));
 assert.deepEqual(exported.inputs,plan.inputs);
 assert.ok(exported.label.includes('Cellulose blend A'));
 assert.equal(exported.example,null);
 assert.equal(exported.products[0].amount,'Output amount not established');
});
test('supporting liquids alone produce no inferred chemical product and output references stay scoped',()=>{
 const plan={...emptyMaterialPlan('P03'),inputs:[newStartingMaterial({name:'Water',role:'solvent'},'50 mL')]},empty=materialOutcome(plan,data,workflow('P03'));
 assert.deepEqual(empty.products,[]);assert.equal(outputReference(empty,media),null);
 assert.ok(materialPhoto('Gold (Au)',media));assert.equal(materialPhoto('PLGA',media),null);assert.equal(materialPhoto('PDMS',media),null);
 plan.inputs.unshift(newStartingMaterial({name:'Gold (Au)',role:'target'}));const outcome=materialOutcome(plan,data,workflow('P03'));assert.ok(outputReference(outcome,media).output_tags.includes('gold nanoparticles'));
 assert.ok(!materialPhoto('Gold (Au)',media).output_tags.includes('gold nanoparticles'));
 const dry={...emptyMaterialPlan('P01'),inputs:[newStartingMaterial({name:'Gold (Au)',role:'feedstock'})]};assert.equal(outputReference(materialOutcome(dry,data,workflow('P01')),media),null);
});
test('material photos retain source, license and exact identity attribution',()=>{
 assert.equal(media.images.length,12);assert.equal(new Set(media.images.map(i=>i.image_id)).size,12);
 for(const image of media.images){assert.match(image.image_url,/^https:\/\//);assert.match(image.source_url,/^https:\/\//);assert.ok(image.author&&image.license&&image.license_url&&image.scope);}
});
