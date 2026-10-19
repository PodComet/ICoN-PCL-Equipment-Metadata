import {newStartingMaterial,type MaterialPlan,type StartingMaterial,type MaterialRole} from './process-materials-lib.ts';
import {usdConversion} from './currency-lib.ts';

export type FormulationComponent={line_id:string;component_id:string;name:string;role:MaterialRole;source_role:string;amount:string;quantity_value:number|null;quantity_unit:string;concentration:string;scope:string;amount_status:string;cost_scope:string;eligible_offer_ids:string[];offer_match_notes:string};
export type ComponentFormulation={formulation_id:string;route_id:string;label:string;output_label:string;batch_basis:string;source_url:string;source_title:string;source_locator:string;reference_ids:string[];scope:string;completeness:string;components:FormulationComponent[]};
export type ComponentOffer={offer_id:string;component_id:string;name:string;seller:string;manufacturer:string;sku:string;grade:string;form:string;pack_quantity:number|null;pack_unit:string;price_value:number;currency:string;price_kind:string;source_url:string;checked_date:string;image_url:string;image_source_url:string;image_scope:string;condition:string;notes:string;cas_number?:string;molar_mass_g_mol?:number;molar_mass_source_url?:string};
export type MarketComponent=FormulationComponent & {route_ids:string[];source_url:string;source_title:string;checked_date:string};
export type ComponentData={checked_date:string;formulations:ComponentFormulation[];offers:ComponentOffer[];market_components?:MarketComponent[];output_quantity_models?:import('./output-quantity-lib.ts').OutputQuantityModel[]};
const key=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function formulationFor(plan:MaterialPlan,data:ComponentData){return data.formulations.find(f=>f.formulation_id===plan.formulation_id&&f.route_id===plan.route_id)||null;}
export function componentFor(material:StartingMaterial,plan:MaterialPlan,data:ComponentData){
 const formulation=formulationFor(plan,data),component=formulation?.components.find(c=>c.line_id===material.component_line_id)||(data.market_components||[]).find(c=>c.line_id===material.component_line_id&&c.route_ids.includes(plan.route_id));
 return component&&component.component_id===material.component_id&&key(component.name)===key(material.name)&&component.role===material.role?component:null;
}
export function componentOffers(component:FormulationComponent|null,data:ComponentData){
 return component?data.offers.filter(o=>o.component_id===component.component_id||component.eligible_offer_ids.includes(o.offer_id)):[];
}
export function formulationPlan(formulation:ComponentFormulation):MaterialPlan{
 return {schema:'process-materials/v1',route_id:formulation.route_id,formulation_id:formulation.formulation_id,example_id:'',expected_output:formulation.output_label,inputs:formulation.components.map(c=>({...newStartingMaterial({name:c.name,role:c.role},c.amount),component_id:c.component_id,component_line_id:c.line_id,offer_id:c.eligible_offer_ids[0]||''}))};
}
export function unchangedFormulation(plan:MaterialPlan,data:ComponentData){
 const f=formulationFor(plan,data);if(!f||f.output_label!==plan.expected_output||f.components.length!==plan.inputs.length)return null;
 return f.components.every(c=>plan.inputs.some(m=>m.component_line_id===c.line_id&&m.name===c.name&&m.role===c.role&&m.amount===c.amount))?f:null;
}
type Quantity={value:number;dimension:'mass'|'volume'|'count'|'moles'};
const units:Record<string,[Quantity['dimension'],number]>={ug:['mass',1e-6],mg:['mass',.001],g:['mass',1],kg:['mass',1000],ul:['volume',.001],ml:['volume',1],l:['volume',1000],mol:['moles',1],mmol:['moles',.001],umol:['moles',1e-6],piece:['count',1],pieces:['count',1],wafer:['count',1],wafers:['count',1],target:['count',1],targets:['count',1],grid:['count',1],grids:['count',1]};
export function componentQuantity(value:number|null,unit:string):Quantity|null{
 const entry=units[unit.normalize('NFKC').toLowerCase().replace(/[μµ]/g,'u').trim()];
 return entry&&value!==null&&Number.isFinite(value)&&value>=0?{value:value*entry[1],dimension:entry[0]}:null;
}
export function parseComponentAmount(amount:string):Quantity|null{
 const match=amount.trim().match(/^((?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(µg|μg|ug|mg|kg|g|µL|μL|uL|mL|L|µmol|μmol|umol|mmol|mol|pieces?|wafers?|targets?|grids?)$/i);
 return match?componentQuantity(Number(match[1]),match[2]):null;
}
export function materialCost(material:StartingMaterial,plan:MaterialPlan,data:ComponentData){
 const component=componentFor(material,plan,data),f=formulationFor(plan,data);
 const referenceOffers=componentOffers(component,data);
 const selected=referenceOffers.find(o=>o.offer_id===material.offer_id),offer=selected||referenceOffers.find(o=>component?.eligible_offer_ids.includes(o.offer_id))||referenceOffers[0]||null;
 const unknown=(reason:string)=>({material_id:material.material_id,name:material.name,amount:material.amount,status:'unpriced' as const,reason,cost_usd:null as number|null,offer,formulation_id:component?.line_id.startsWith('MARKET-')?'':f?.formulation_id||'',component_line_id:component?.line_id||''});
 if(!component)return unknown('Choose a sourced formulation or reviewed market material to establish product identity; custom inputs have no verified price match.');
 if(component.cost_scope!=='consumed')return unknown(component.cost_scope==='stock_preparation'?'Stock preparation is shown for context; charge only its allocated consumed portion.':component.cost_scope==='reusable'?'Reusable target, substrate or media: consumption is not established.':'Reference / alternative material; not automatically charged.');
 if(!offer)return unknown('No public market price sourced.');
 if(!component.eligible_offer_ids.includes(offer.offer_id))return unknown('Reference offer only: grade, form, concentration or dimensions need matching.');
 if(offer.condition!=='new')return unknown('Offer condition is not confirmed new.');
 if(component.amount_status==='ambiguous')return unknown('Source quantity is ambiguous and needs review.');
 let amount=material.amount===component.amount&&component.amount_status==='reported'?componentQuantity(component.quantity_value,component.quantity_unit):parseComponentAmount(material.amount);
 if(!amount)amount=parseComponentAmount(material.amount);
 const pack=componentQuantity(offer.pack_quantity,offer.pack_unit),quote=usdConversion(offer.price_value,offer.currency);
 if(!amount)return unknown('No absolute consumed amount: concentration, gas flow and free-text ranges are not treated as quantities.');
 if(amount.dimension==='moles'&&pack?.dimension==='mass'&&offer.molar_mass_g_mol&&offer.molar_mass_source_url)amount={value:amount.value*offer.molar_mass_g_mol,dimension:'mass'};
 if(!pack||pack.value<=0||amount.dimension!==pack.dimension)return unknown('Selected amount cannot be compared with the priced pack.');
 if(!quote)return unknown('USD conversion unavailable.');
 return {material_id:material.material_id,name:material.name,amount:material.amount,status:'priced' as const,reason:component.line_id.startsWith('MARKET-')?'User-entered consumption prorated from the exact market pack. Process suitability and dose are not experimentally validated.':'Estimated consumption cost prorated from the dated pack price.',cost_usd:quote.value*amount.value/pack.value,offer,formulation_id:component.line_id.startsWith('MARKET-')?'':f?.formulation_id||'',component_line_id:component.line_id,quantity:amount,pack_quantity:pack,conversion:quote};
}
export function materialsBudget(plan:MaterialPlan,data:ComponentData){
 const lines=plan.inputs.filter(m=>m.name.trim()).map(m=>materialCost(m,plan,data));
 return {schema:'component-budget/v1',checked_date:data.checked_date,consumed_subtotal_usd:lines.reduce((sum,line)=>sum+(line.cost_usd??0),0),priced:lines.filter(l=>l.status==='priced').length,unpriced:lines.filter(l=>l.status==='unpriced').length,lines};
}
