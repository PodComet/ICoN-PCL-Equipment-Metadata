import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {formulationPlan} from '../app/component-lib.ts';
import {metricAmount,changeMetricScale,formatMetric} from '../app/metric-quantity-lib.ts';
import {anticipatedQuantity} from '../app/output-quantity-lib.ts';
const data=JSON.parse(readFileSync(new URL('../app/data/components.json',import.meta.url),'utf8'));
const plan=id=>formulationPlan(data.formulations.find(f=>f.route_id===id));

test('metric scales preserve physical quantities and keep mass and volume distinct',()=>{
 assert.equal(changeMetricScale('200 mg','g'),'0.2 g');
 assert.equal(changeMetricScale('750 ml','L'),'0.75 L');
 assert.equal(changeMetricScale('2 g','mg'),'2000 mg');
 assert.equal(changeMetricScale('2 g','mL'),null);
 assert.equal(metricAmount('2 mg/mL'),null);
 assert.equal(formatMetric(.2,'mass'),'200 mg');
 assert.equal(formatMetric(750,'volume'),'750 mL');
});
test('source-bound output quantities scale with selected inputs without claiming experimental yield',()=>{
 const p=plan('P07'),w={extensions:{}};
 let q=anticipatedQuantity(p,data,w);assert.equal(q.value,10);assert.equal(q.status,'theoretical_mass_ceiling');
 p.inputs[0].amount='200 mg';q=anticipatedQuantity(p,data,w);assert.equal(q.value,.2);assert.match(q.display,/200 mg/);
 q=anticipatedQuantity(p,data,{extensions:{output_recovery_percent:50}});assert.equal(q.value,.1);assert.equal(q.status,'user_recovery_assumption');assert.match(q.display,/assumed recovery/);
 assert.equal(anticipatedQuantity(p,data,{extensions:{output_recovery_percent:101}}).value,null);
 p.inputs[0].name='Different precursor';assert.equal(anticipatedQuantity(p,data,w).value,null);
});
test('carrier volume is separate from particle mass and missing batch quantities remain unknown',()=>{
 const p=plan('P03');p.inputs[1].amount='750 mL';const q=anticipatedQuantity(p,data,{extensions:{}});
 assert.equal(q.value,750);assert.match(q.display,/carrier liquid/);assert.match(q.reason,/mass.*unreported/);
 const noModel=anticipatedQuantity(plan('P44'),data,{extensions:{}});assert.equal(noModel.value,null);
 const lignin=plan('P30');lignin.inputs[0].amount='5 mg/mL';assert.equal(anticipatedQuantity(lignin,data,{extensions:{}}).value,null);
});
