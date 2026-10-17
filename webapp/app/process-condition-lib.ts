import type {JsonValue,ProcessStep,ProcessWorkflow} from './process-lib.ts';

type Unit={unit:string;factor:number;offset?:number;dimension?:string;canonical?:string};
type Definition={label:string;canonical:string;dimension:string;units:Unit[];minimum?:number;maximum?:number;text?:boolean};
import registry from './data/condition-definitions.json' with {type:'json'};
export const CONDITION_DEFINITIONS=registry as Record<string,Definition>;
export type ConditionOperator='eq'|'range'|'gte'|'lte'|'gt'|'lt'|'text';
export type ConditionValue={parameter:string;label:string;operator:ConditionOperator;value:number|null;upper_value:number|null;unit:string;text_value:string};
export type ProcessCondition=ConditionValue&{condition_id:string;slot_id:string;reference_condition_id:string;notes:string;citation_url:string;citation_locator:string;scope_review_required?:boolean};
export type ConditionTemplate=ConditionValue&{template_id:string;route_id:string;formulation_id:string;source_step_order:string;evidence_id:string;scope:string;match_scope:'example'|'parameter_study'|'ambiguous'};
export type ProcessEvidence={evidence_id:string;classification:string;claim:string;source_url:string;source_title:string;source_locator:string;reference_ids:string[];scope:string;reviewed_date:string};
export type PropertyAnchor={anchor_id:string;route_id:string;formulation_id:string;property:string;label:string;value:number|null;upper_value:number|null;unit:string;text_value:string;operator:ConditionOperator;evidence_id:string;required_condition_ids:string[];scope:string;material_scope:string;supports_expectation:boolean;uncertainty:{value:number;unit:string;kind:string}|null;approximate:boolean};
export type RelationshipCandidate={series_id:string;route_id:string;source_url:string;source_title:string;source_locator:string;points:Record<string,unknown>[];caveats:string|string[];interpolation_enabled:boolean;status:string};
export type ConditionLibrary={schema:'process-science/v1';checked_date:string;conditions:ConditionTemplate[];evidence:ProcessEvidence[];properties:PropertyAnchor[];route_reviews:{route_id:string;status:string;notes:string}[];relationship_candidates?:RelationshipCandidate[]};
export const CONDITIONS_KEY='operating_conditions';
export function stepConditions(step:ProcessStep):ProcessCondition[]{
 const value=step.extensions[CONDITIONS_KEY];return Array.isArray(value)?value as unknown as ProcessCondition[]:[];
}
export function newCondition(parameter='temperature'):ProcessCondition{
 const def=Object.hasOwn(CONDITION_DEFINITIONS,parameter)?CONDITION_DEFINITIONS[parameter]:undefined;if(!def)throw new Error('Choose a supported condition.');
 return {condition_id:'COND-'+crypto.randomUUID(),parameter,label:'',operator:def.text?'text':'eq',value:null,upper_value:null,unit:def.units[0].unit,text_value:'',slot_id:'',reference_condition_id:'',notes:'',citation_url:'',citation_locator:''};
}
export function conditionCanonical(c:ConditionValue){
 const def=Object.hasOwn(CONDITION_DEFINITIONS,c.parameter)?CONDITION_DEFINITIONS[c.parameter]:undefined,u=def?.units.find(v=>v.unit===c.unit);
 if(!def||!u||c.operator==='text'||c.value===null||!Number.isFinite(c.value))return null;
 return {value:c.value*u.factor+(u.offset||0),upper_value:c.upper_value===null?null:c.upper_value*u.factor+(u.offset||0),unit:u.canonical||def.canonical,dimension:u.dimension||def.dimension,operator:c.operator};
}
export function conditionText(c:ConditionValue){
 if(c.operator==='text')return c.text_value.trim()||'Not specified';
 if(c.value===null)return 'Not specified';
 const op:Record<string,string>={eq:'',gte:'≥ ',lte:'≤ ',gt:'> ',lt:'< ',range:''};
 return (op[c.operator]||'')+c.value+(c.operator==='range'?'–'+(c.upper_value??'?'):'')+(c.unit?' '+c.unit:'');
}
export function conditionError(c:ConditionValue){
 const d=Object.hasOwn(CONDITION_DEFINITIONS,c.parameter)?CONDITION_DEFINITIONS[c.parameter]:undefined;if(!d||!(c.operator==='text'&&c.unit===''||d.units.some(u=>u.unit===c.unit)))return 'Choose a unit appropriate for this condition.';
 if(!['eq','range','gte','lte','gt','lt','text'].includes(c.operator))return 'Invalid condition comparison.';
 if([c.value,c.upper_value].some(v=>v!==null&&(typeof v!=='number'||!Number.isFinite(v))))return 'Enter finite numeric values.';
 if(c.operator==='text')return c.value!==null||c.upper_value!==null?'A qualitative condition cannot also contain numbers.':'';
 if(d.text)return 'This condition uses descriptive text.';
 if(c.text_value)return 'Use a qualitative comparison for descriptive conditions.';
 if(c.operator==='range'&&(c.value===null||c.upper_value===null||c.upper_value<c.value))return 'Enter a complete range from lower to upper value.';
 if(c.operator!=='range'&&c.upper_value!==null)return 'Upper value is only used for a range.';
 const n=conditionCanonical(c);if(n&&[n.value,...(n.upper_value===null?[]:[n.upper_value])].some(v=>d.minimum!==undefined&&v<d.minimum-1e-9||d.maximum!==undefined&&v>d.maximum))return 'Value is outside the physical bounds for this condition.';
 if(c.parameter==='cycles'&&c.value!==null&&(!Number.isSafeInteger(c.value)||c.upper_value!==null&&!Number.isSafeInteger(c.upper_value)))return 'Cycle counts must be whole numbers.';
 return '';
}
const uuid=/^COND-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateConditions(value:unknown,step:ProcessStep):asserts value is ProcessCondition[]{
 if(!Array.isArray(value)||value.length>40)throw new Error('Use up to 40 operating conditions per step.');
 const ids=new Set<string>();
 for(const raw of value){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid operating condition.');
  const c=raw as ProcessCondition;
  if(typeof c.condition_id!=='string'||!uuid.test(c.condition_id)||ids.has(c.condition_id))throw new Error('Operating conditions need unique system IDs.');ids.add(c.condition_id);
  for(const [field,max] of [['label',200],['text_value',1000],['notes',2000],['reference_condition_id',100],['slot_id',100],['citation_url',2000],['citation_locator',500]] as const)if(typeof c[field]!=='string'||c[field].length>max)throw new Error('Invalid operating-condition '+field+'.');
  if(c.citation_url){try{if(!['http:','https:'].includes(new URL(c.citation_url).protocol))throw 0;}catch{throw new Error('Use an HTTP or HTTPS condition citation.');}}
  if(c.slot_id&&!step.slots.some(s=>s.slot_id===c.slot_id))throw new Error('Condition scope must name an instrument slot in its own step.');
  if(c.scope_review_required!==undefined&&typeof c.scope_review_required!=='boolean')throw new Error('Invalid condition scope review.');
  const error=conditionError(c);if(error)throw new Error(error);
 }
}
export function withStepConditions(w:ProcessWorkflow,stepId:string,conditions:ProcessCondition[]):ProcessWorkflow{
 const step=w.steps.find(s=>s.step_id===stepId);if(!step)throw new Error('Choose a process step.');validateConditions(conditions,step);
 return {...w,steps:w.steps.map(s=>s.step_id===stepId?{...s,extensions:{...s.extensions,[CONDITIONS_KEY]:structuredClone(conditions) as unknown as JsonValue}}:s)};
}
export function sourceConditionMatch(c:ConditionValue,source:ConditionValue){
 if(c.parameter!==source.parameter)return false;
 if(c.operator==='text'||source.operator==='text')return c.operator===source.operator&&!!c.text_value.trim()&&c.text_value.normalize('NFKC').trim().toLowerCase()===source.text_value.normalize('NFKC').trim().toLowerCase();
 const a=conditionCanonical(c),b=conditionCanonical(source);if(!a||!b||a.dimension!==b.dimension||a.operator!==b.operator)return false;
 const near=(x:number|null,y:number|null)=>x===null||y===null?x===y:Math.abs(x-y)<=1e-9*Math.max(Number.MIN_VALUE,Math.abs(x),Math.abs(y));
 return near(a.value,b.value)&&near(a.upper_value,b.upper_value);
}
export function loadSourceConditions(w:ProcessWorkflow,formulationId:string,library:ConditionLibrary,onlyStep=''){
 const templates=library.conditions.filter(t=>t.route_id===w.route_id&&t.formulation_id===formulationId),loaded:string[]=[],skipped:string[]=[];
 const next={...w,steps:w.steps.map(step=>{
  if(onlyStep&&step.step_id!==onlyStep)return step;
  const current=stepConditions(step),added:ProcessCondition[]=[];
  for(const t of templates.filter(t=>t.source_step_order===step.source_step_order)){
   // Never overwrite a researcher's edited condition or duplicate an imported row.
   if(current.some(c=>c.reference_condition_id===t.template_id)){skipped.push(t.template_id);continue;}
   const c:ProcessCondition={...newCondition(t.parameter),parameter:t.parameter,label:t.label,operator:t.operator,value:t.value,upper_value:t.upper_value,unit:t.unit,text_value:t.text_value,reference_condition_id:t.template_id,notes:t.scope};
   if(current.length+added.length>=40){skipped.push(t.template_id);continue;}added.push(c);loaded.push(t.template_id);
  }
  return added.length?{...step,extensions:{...step.extensions,[CONDITIONS_KEY]:[...current,...added] as unknown as JsonValue}}:step;
 })};
 return {workflow:next,loaded,skipped};
}
export function conditionSummary(w:ProcessWorkflow){
 const all=w.steps.flatMap(stepConditions);return {count:all.length,specified:all.filter(c=>c.operator==='text'?!!c.text_value.trim():c.value!==null).length,steps:w.steps.filter(s=>stepConditions(s).length).length};
}
/** Keep a removed slot's settings, explicitly detached for scope review. */
export function reconcileConditionScopes(w:ProcessWorkflow):ProcessWorkflow{
 return {...w,steps:w.steps.map(step=>{
  const conditions=stepConditions(step);if(!conditions.some(c=>c.slot_id&&!step.slots.some(s=>s.slot_id===c.slot_id)))return step;
  return {...step,extensions:{...step.extensions,[CONDITIONS_KEY]:conditions.map(c=>c.slot_id&&!step.slots.some(s=>s.slot_id===c.slot_id)?{...c,slot_id:'',scope_review_required:true,notes:c.notes+' Previous instrument slot '+c.slot_id+' was removed; assign the intended condition scope.'}:c) as unknown as JsonValue}};
 })};
}
