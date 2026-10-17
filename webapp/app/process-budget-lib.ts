import {workflowBudget,type ProcessStep} from './process-lib.ts';
import {materialsBudget,type ComponentData} from './component-lib.ts';
import {usdConversion} from './currency-lib.ts';
import type {MaterialPlan} from './process-materials-lib.ts';
export const processMoney=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
export function overallProcessBudget(steps:ProcessStep[],plan:MaterialPlan,data:ComponentData){
 const equipment=workflowBudget(steps),materials=materialsBudget(plan,data);
 let low=0,high=0,conversionMissing=0;
 for(const t of equipment.totals){const a=usdConversion(t.low,t.currency),b=usdConversion(t.high,t.currency);if(a&&b){low+=a.value;high+=b.value;}else conversionMissing++;}
 return {schema:'process-budget/v1',currency:'USD',equipment,materials,equipment_low_usd:low,equipment_high_usd:high,total_low_usd:low+materials.consumed_subtotal_usd,total_high_usd:high+materials.consumed_subtotal_usd,partial:equipment.missing+materials.unpriced+conversionMissing>0,conversion_missing:conversionMissing};
}
