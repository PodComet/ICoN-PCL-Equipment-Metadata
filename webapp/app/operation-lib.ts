/** Model-bound planning definitions. Command bindings are metadata, never executed. */
export type OperationValue=string|number|boolean;
export type OperationParameter={id:string;label:string;type:'number'|'integer'|'string'|'boolean';required:boolean;unit?:string;minimum?:number;maximum?:number;choices?:OperationValue[];evidence_ids:string[]};
export type OperationStatement={id:string;description:string;evidence_ids:string[]};
export type OperationDefinition={
 schema:'instrument-operation/v1';evidence_ids:string[];parameters:OperationParameter[];
 preconditions:OperationStatement[];completion_signals:OperationStatement[];
 transition?:{on_success:string;on_failure?:string;evidence_ids:string[]};
 binding?:{kind:'python_api'|'serial'|'http'|'manual';target:string;command:string;evidence_ids:string[]};
};
export const emptyOperation=():OperationDefinition=>({schema:'instrument-operation/v1',evidence_ids:[],parameters:[],preconditions:[],completion_signals:[]});
const identifier=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z][a-zA-Z0-9_.-]{0,99}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const text=(v:unknown,max=2000)=>typeof v==='string'&&!!v.trim()&&v.length<=max;
const scalar=(v:unknown):v is OperationValue=>typeof v==='string'&&v.length<=2000||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v);
function keys(value:object,allowed:string[]){if(Object.keys(value).some(k=>!allowed.includes(k)))throw new Error('Unknown operation field. Use the instrument-operation/v1 schema.');}
export function operationEvidenceIds(o?:OperationDefinition):string[]{return o?[...new Set([...o.evidence_ids,...o.parameters.flatMap(p=>p.evidence_ids),...o.preconditions.flatMap(p=>p.evidence_ids),...o.completion_signals.flatMap(p=>p.evidence_ids),...(o.transition?.evidence_ids||[]),...(o.binding?.evidence_ids||[])])]:[];}
export function validateOperationDefinition(value:unknown,known:Set<string>,positions:Set<string>):OperationDefinition{
 const o=value as OperationDefinition;
 const ids=(v:unknown)=>Array.isArray(v)&&v.length<=100&&v.every(id=>typeof id==='string'&&known.has(id));
 if(!o||typeof o!=='object'||o.schema!=='instrument-operation/v1'||!ids(o.evidence_ids))throw new Error('Use instrument-operation/v1 and known evidence IDs.');
 keys(o,['schema','evidence_ids','parameters','preconditions','completion_signals','transition','binding']);
 if(!Array.isArray(o.parameters)||o.parameters.length>30)throw new Error('Use at most 30 operation parameters.');
 const names=new Set<string>();
 for(const p of o.parameters){
  if(!p||!identifier(p.id)||names.has(p.id)||!text(p.label,200)||!['number','integer','string','boolean'].includes(p.type)||typeof p.required!=='boolean'||!ids(p.evidence_ids))throw new Error('Parameters need unique IDs, labels, types, required flags and known evidence IDs.');
  keys(p,['id','label','type','required','unit','minimum','maximum','choices','evidence_ids']);names.add(p.id);
  const numeric=['number','integer'].includes(p.type);
  if(numeric?!text(p.unit,80):p.unit!==undefined)throw new Error('Numeric parameters need a declared unit (1 for dimensionless); text and boolean parameters have no unit.');
  if([p.minimum,p.maximum].some(n=>n!==undefined&&(!numeric||typeof n!=='number'||!Number.isFinite(n)||p.type==='integer'&&!Number.isInteger(n)))||p.minimum!==undefined&&p.maximum!==undefined&&p.minimum>p.maximum)throw new Error('Parameter bounds must be finite, ordered and match its numeric type.');
  if(p.choices!==undefined&&(!Array.isArray(p.choices)||!p.choices.length||p.choices.length>50||p.choices.some(v=>!scalar(v)||parameterValueError(p,v))))throw new Error('Parameter choices must match its type and bounds.');
 }
 for(const field of ['preconditions','completion_signals'] as const){
  if(!Array.isArray(o[field])||o[field].length>30)throw new Error('Use at most 30 '+field+'.');
  const seen=new Set<string>();for(const s of o[field]){if(!s||!identifier(s.id)||seen.has(s.id)||!text(s.description)||!ids(s.evidence_ids))throw new Error('Conditions and signals need unique IDs, descriptions and known evidence IDs.');keys(s,['id','description','evidence_ids']);seen.add(s.id);}
 }
 if(o.transition){const t=o.transition;keys(t,['on_success','on_failure','evidence_ids']);if(!positions.has(t.on_success)||t.on_failure!==undefined&&!positions.has(t.on_failure)||!ids(t.evidence_ids))throw new Error('Resulting positions must exist in this model interface and cite known evidence IDs.');}
 if(o.binding){const b=o.binding;keys(b,['kind','target','command','evidence_ids']);if(!['python_api','serial','http','manual'].includes(b.kind)||!text(b.target,200)||!text(b.command,1000)||!ids(b.evidence_ids))throw new Error('A command binding needs a kind, target, command and known evidence IDs.');}
 if(JSON.stringify(o).length>30000)throw new Error('An operation definition exceeds 30,000 characters.');
 return structuredClone(o);
}
export function validateParameterValues(value:unknown):Record<string,OperationValue>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>30)throw new Error('Use up to 30 named scalar parameter values.');
 const result:Record<string,OperationValue>={};for(const [k,v] of Object.entries(value)){if(!identifier(k)||!scalar(v))throw new Error('Parameter values need safe IDs and finite numbers, text or booleans.');result[k]=v;}return result;
}
export function parameterValueError(p:OperationParameter,value:OperationValue):string{
 if(p.type==='number'||p.type==='integer'){
  if(typeof value!=='number'||!Number.isFinite(value)||p.type==='integer'&&!Number.isInteger(value))return p.label+' needs '+(p.type==='integer'?'an integer':'a number')+'.';
  if(p.minimum!==undefined&&value<p.minimum||p.maximum!==undefined&&value>p.maximum)return p.label+' is outside its documented bounds ('+(p.minimum??'…')+'–'+(p.maximum??'…')+' '+p.unit+').';
 }else if(typeof value!==p.type)return p.label+' needs a '+p.type+' value.';
 return '';
}
export function operationParameterIssues(o:OperationDefinition|undefined,values:Record<string,OperationValue>={}){
 const issues:string[]=[];
 if(!o){if(Object.keys(values).length)issues.push('No current operation definition for these parameter values.');return issues;}
 for(const p of o.parameters){const v=values[p.id];if(v===undefined){if(p.required)issues.push(p.label+' is required.');continue;}const error=parameterValueError(p,v);if(error)issues.push(error);else if(p.choices&&!p.choices.includes(v))issues.push(p.label+' must use a listed option.');}
 for(const id of Object.keys(values))if(!o.parameters.some(p=>p.id===id))issues.push('Unknown parameter: '+id+'.');return issues;
}
