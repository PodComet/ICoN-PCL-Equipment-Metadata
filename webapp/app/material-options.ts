import type {MaterialDataset,MaterialPlan,MaterialSuggestion} from './process-materials-lib.ts';
export type MaterialImage={image_id:string;name:string;image_url:string;source_url:string;author:string;license:string;license_url:string;scope:string;material_names:string[];output_tags:string[];kind:string;reference_id?:string;article_url?:string};
export type MaterialImages={checked_date:string;images:MaterialImage[]};
export const materialKey=(m:MaterialSuggestion)=>m.role+'|'+m.name;
export const materialName=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function relevantMaterials(data:MaterialDataset,routeId:string){
 const suggestions=[...(data.profiles.find(p=>p.route_id===routeId)?.suggestions||[]),...data.examples.filter(e=>e.route_id===routeId).flatMap(e=>e.inputs)];
 return [...new Map(suggestions.map(m=>[materialKey(m),m])).values()];
}
export function materialPhoto(name:string,data:MaterialImages){return data.images.find(image=>image.material_names.some(alias=>materialName(alias)===materialName(name)))||null;}

/** User-selectable inventory amounts, not recommended experimental doses. */
export function amountChoices(material:MaterialSuggestion,current=''){
 const name=materialName(material.name);
 const kind=material.role==='gas'?'gas':material.role==='target'?'target':material.role==='substrate'?'piece':material.role==='sample'&&/plate/.test(name)?'plate':material.role==='sample'&&/mixture/.test(name)?'well':material.role==='sample'?'sample':material.role==='solvent'||/solution|suspension|dispersion|formulation|extract|liquid|phase|pdms|oleylamine|trioctylphosphine/.test(name)?'liquid':'mass';
 const presets:Record<string,string[]>={mass:['1 mg','5 mg','10 mg','25 mg','50 mg','100 mg','250 mg','500 mg','1 g','5 g','10 g'],liquid:['0.1 mL','0.5 mL','1 mL','5 mL','10 mL','25 mL','50 mL','100 mL','250 mL','500 mL'],target:['1 target','2 targets','3 targets'],piece:['1 piece','2 pieces','5 pieces','10 pieces'],plate:['1 plate','2 plates'],well:['5 µL per well','10 µL per well','20 µL per well','25 µL per well','50 µL per well'],sample:['1 sample','2 samples','5 samples','10 samples'],gas:['Continuous supply','1 gas charge','2 gas charges']};
 const values=presets[kind];
 return [{value:'',label:'Amount not specified'},...(current&&!values.includes(current)?[{value:current,label:current+' (saved)'}]:[]),...values.map(value=>({value,label:value}))];
}
export function replaceMaterial(plan:MaterialPlan,id:string,next:MaterialSuggestion):MaterialPlan{
 return {...plan,example_id:'',expected_output:'',inputs:plan.inputs.map(m=>m.material_id===id?{...m,component_id:undefined,component_line_id:undefined,offer_id:undefined,...next,amount:''}:m)};
}
