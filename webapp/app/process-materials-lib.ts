import type {JsonValue,ProcessWorkflow} from './process-lib.ts';

export const MATERIAL_ROLES={feedstock:'Feedstock',target:'Deposition / ablation target',precursor:'Precursor',polymer:'Polymer / matrix',nanofiller:'Nanofiller',substrate:'Substrate',solvent:'Solvent / liquid phase',reagent:'Reagent',dopant:'Dopant',ligand:'Ligand / surface modifier',gas:'Gas',sample:'Sample'} as const;
export type MaterialRole=keyof typeof MATERIAL_ROLES;
export type MaterialSuggestion={name:string;role:MaterialRole;component_id?:string;component_line_id?:string;offer_id?:string};
export type StartingMaterial=MaterialSuggestion & {material_id:string;amount:string;component_id?:string;component_line_id?:string;offer_id?:string};
export type MaterialPlan={schema:'process-materials/v1';route_id:string;inputs:StartingMaterial[];expected_output:string;example_id:string;formulation_id?:string};
export type MaterialProfile={route_id:string;naming_mode:string;suggestions:MaterialSuggestion[];basis:string};
export type MaterialExample={example_id:string;route_id:string;label:string;output_label:string;inputs:MaterialSuggestion[];reference_ids:string;source_url:string;source_locator:string;scope:string};
export type MaterialDataset={profiles:MaterialProfile[];examples:MaterialExample[]};
export function emptyMaterialPlan(routeId:string):MaterialPlan{return {schema:'process-materials/v1',route_id:routeId,inputs:[],expected_output:'',example_id:''};}
export function validateMaterialPlan(value:unknown,routeId:string,allowBlankNames=false):asserts value is MaterialPlan{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid starting-material plan.');
 const p=value as MaterialPlan;
 if(p.schema!=='process-materials/v1'||p.route_id!==routeId||!Array.isArray(p.inputs)||p.inputs.length>30)throw new Error('Use up to 30 starting materials for this process.');
 if(typeof p.expected_output!=='string'||p.expected_output.length>240||typeof p.example_id!=='string'||p.example_id.length>100)throw new Error('Invalid material output target.');
 const ids=new Set<string>();
 if(p.formulation_id!==undefined&&(typeof p.formulation_id!=='string'||p.formulation_id.length>100))throw new Error('Invalid formulation reference.');
 for(const m of p.inputs){
  if(!m||typeof m!=='object'||!/^MAT-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(m.material_id)||ids.has(m.material_id))throw new Error('Starting materials need unique system IDs.');
  ids.add(m.material_id);
  if(typeof m.name!=='string'||!allowBlankNames&&!m.name.trim()||m.name.length>180||!Object.hasOwn(MATERIAL_ROLES,m.role)||typeof m.amount!=='string'||m.amount.length>100)throw new Error('Enter a material name, role and optional amount.');
  for(const field of ['component_id','component_line_id','offer_id'] as const)if(m[field]!==undefined&&(typeof m[field]!=='string'||m[field]!.length>180))throw new Error('Invalid component or offer reference.');
 }
}
export function materialPlanFor(workflow:ProcessWorkflow):MaterialPlan{
 const value=workflow.extensions.material_plan;if(value===undefined)return emptyMaterialPlan(workflow.route_id);
 validateMaterialPlan(value,workflow.route_id,true);return value;
}
export function withMaterialPlan(workflow:ProcessWorkflow,plan:MaterialPlan):ProcessWorkflow{
 validateMaterialPlan(plan,workflow.route_id,true);
 return {...workflow,extensions:{...workflow.extensions,material_plan:structuredClone(plan) as unknown as JsonValue}};
}
export function newStartingMaterial(suggestion:MaterialSuggestion,amount=''):StartingMaterial{return {...suggestion,material_id:'MAT-'+crypto.randomUUID(),amount};}
export function planFromExample(example:MaterialExample):MaterialPlan{return {schema:'process-materials/v1',route_id:example.route_id,inputs:example.inputs.map(i=>newStartingMaterial(i)),expected_output:example.output_label,example_id:example.example_id};}
const normalized=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function matchedMaterialExample(plan:MaterialPlan,examples:MaterialExample[]){
 const example=examples.find(e=>e.example_id===plan.example_id&&e.route_id===plan.route_id);
 if(!example||normalized(example.output_label)!==normalized(plan.expected_output)||example.inputs.length!==plan.inputs.length)return null;
 const key=(m:MaterialSuggestion)=>m.role+':'+normalized(m.name),actual=plan.inputs.map(key).sort();
 return example.inputs.map(key).sort().every((k,i)=>k===actual[i])?example:null;
}
export function materialOutput(plan:MaterialPlan,profiles:MaterialProfile[],examples:MaterialExample[]){
 if(!plan.inputs.some(m=>m.name.trim()))return {label:'Add starting materials',basis:'unspecified' as const,detail:'Select inputs to identify a material-specific output.',example:null};
 const example=matchedMaterialExample(plan,examples);
 if(plan.expected_output.trim())return {label:plan.expected_output.trim(),basis:example?'source_example' as const:'user_target' as const,detail:example?'Reported composition example · process conditions still need review':'User-defined target · composition and yield are not predicted',example};
 const mode=profiles.find(p=>p.route_id===plan.route_id)?.naming_mode||'generic';
 const names=(roles:MaterialRole[])=>plan.inputs.filter(m=>roles.includes(m.role)).map(m=>m.name.trim()).filter(Boolean);
 const primary=names(['feedstock','target','precursor','polymer','nanofiller','sample']);
 const shortened=(items:string[])=>{const text=items.slice(0,3).join(' + ')+(items.length>3?' + '+(items.length-3)+' more':'');return text.length>140?text.slice(0,137)+'…':text;};
 const feed=shortened(primary.length?primary:plan.inputs.filter(m=>m.role!=='substrate'&&m.role!=='gas').map(m=>m.name))||'unspecified feedstock';
 const substrate=shortened(names(['substrate']));
 const forms:Record<string,string>={particles:'Particle product from ',assembled:'Self-assembled product from ',fibers:'Fiber target from ',composite:'Composite target from ',milled:'Milled product from ',thermal:'Thermally processed product from ',growth:'Growth product from ',aerosol:'Aerosol target from ',functionalized:'Surface-modified target from ',exfoliated:'Exfoliated product from ',cycled:'Temperature-cycled '};
 const label=mode==='film'?'Film from '+feed+(substrate?' on '+substrate:''):mode==='deposit'?'Electrodeposit from '+feed+(substrate?' on '+substrate:''):mode==='pattern'?'Patterned '+(primary.length?feed:'material')+(substrate?' on '+substrate:''):mode==='etched'?'Etched '+(substrate||feed):(forms[mode]||'Processed material from ')+feed;
 return {label,basis:'input_based' as const,detail:'Input-based planning label · chemical conversion, dimensions and yield are not inferred',example:null};
}
