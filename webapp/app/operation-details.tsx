'use client';
import {safeUrl} from './catalog-lib';
import {operationEvidenceIds,type OperationDefinition,type OperationValue} from './operation-lib';
import type {PositionLibrary} from './position-lib';

export function OperationDetails({operation,library}:{operation:OperationDefinition;library:PositionLibrary}){
 const o=operation,ids=operationEvidenceIds(o);
 return <div className="operation-details"><h5>Action interface</h5>
  {o.parameters.length>0&&<dl>{o.parameters.map(p=><div key={p.id}><dt>{p.label} {p.required?'· required':'· optional'}</dt><dd>{p.type}{p.unit?' · '+p.unit:''}{p.minimum!==undefined?' · min '+p.minimum:''}{p.maximum!==undefined?' · max '+p.maximum:''}{p.choices?' · options: '+p.choices.join(', '):''}</dd></div>)}</dl>}
  {(['preconditions','completion_signals'] as const).map(field=><div key={field}><strong>{field==='preconditions'?'Required starting conditions':'Completion signals to check'}</strong>{o[field].length?<ul>{o[field].map(s=><li key={s.id}>{s.description}</li>)}</ul>:<p>Not documented.</p>}</div>)}
  {o.transition&&<p><strong>Resulting position:</strong> success → {o.transition.on_success}{o.transition.on_failure?' · failure → '+o.transition.on_failure:''}</p>}
  {o.binding&&<p><strong>Command reference:</strong> {o.binding.kind} · {o.binding.target} · <code>{o.binding.command}</code></p>}
  <div className="operation-evidence">{ids.length?ids.map(id=>{const e=library.evidence.flatMap(g=>g.entries).find(e=>e.id===id),url=safeUrl(e?.source.url||'');return url?<a key={id} href={url} target="_blank" rel="noopener noreferrer">{id} · {e?.verification.status}</a>:<span key={id}>{id} · {e?.verification.status||'review needed'}</span>;}):<span>Evidence not yet linked · needs review</span>}</div>
 </div>;
}
export function OperationParameters({operation,values,onChange,label}:{operation:OperationDefinition;values:Record<string,OperationValue>;onChange:(values:Record<string,OperationValue>)=>void;label:string}){
 function set(key:string,value:OperationValue|undefined){const next={...values};if(value===undefined)delete next[key];else next[key]=value;onChange(next);}
 return <fieldset className="operation-parameters"><legend>Action settings</legend>{operation.parameters.length?operation.parameters.map(p=><label key={p.id}>{p.label}{p.unit?' ('+(p.unit==='Cel'?'°C':p.unit)+')':''}{p.required?' *':''}
  {p.choices?<select aria-label={label+' '+p.label} value={values[p.id]===undefined?'':JSON.stringify(values[p.id])} onChange={e=>set(p.id,e.target.value===''?undefined:JSON.parse(e.target.value))}><option value="">Choose…</option>{p.choices.map(v=><option key={JSON.stringify(v)} value={JSON.stringify(v)}>{String(v)}</option>)}</select>:p.type==='boolean'?<select aria-label={label+' '+p.label} value={values[p.id]===undefined?'':String(values[p.id])} onChange={e=>set(p.id,e.target.value===''?undefined:e.target.value==='true')}><option value="">Choose…</option><option value="true">Yes</option><option value="false">No</option></select>:<input aria-label={label+' '+p.label} type={['number','integer'].includes(p.type)?'number':'text'} step={p.type==='integer'?1:'any'} min={p.minimum} max={p.maximum} maxLength={2000} value={values[p.id]===undefined?'':String(values[p.id])} onChange={e=>{const v=e.target.value;set(p.id,v===''?undefined:p.type==='string'?v:Number.isFinite(Number(v))?Number(v):undefined);}}/>}
  {(p.minimum!==undefined||p.maximum!==undefined)&&<small>Range: {p.minimum??'…'}–{p.maximum??'…'} {p.unit==='Cel'?'°C':p.unit}</small>}
 </label>):<p>No parameters defined for this action.</p>}<small>Values use the declared units; no implicit unit conversion.</small></fieldset>;
}
