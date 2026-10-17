'use client';
import {useEffect,useRef} from 'react';
import {Check,Download,X} from 'lucide-react';
import MaterialPhoto,{materialImages} from './material-photo';
import {outputReference,type materialOutcome} from './process-outcome-lib';
import type {Route} from './catalog-lib';

export default function ProcessOutputCard({route,outcome,complete,pendingReason,reviewPending,onClose}:{route:Route;outcome:ReturnType<typeof materialOutcome>;complete:boolean;pendingReason:string;reviewPending:number;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),photo=outputReference(outcome,materialImages);
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close()},[]);
 function exportPlan(){const value={schema:'process-output-plan/v1',equipment_complete:complete,review_pending:reviewPending,...outcome};const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=(outcome.workflow_id||'draft-'+route.route_id)+'-expected-materials.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <dialog ref={dialog} className="modal process-output-dialog" aria-label="Expected output materials" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal-inner">
  <button type="button" className="modal-close icon-button" aria-label="Close output card" onClick={onClose}><X size={20}/></button>
  <p className="output-card-eyebrow">{route.route_id} · EXPECTED OUTPUT MATERIALS</p><h2>{outcome.label}</h2><p className="output-route-name">{route.route_name}</p>
  <p className={'output-card-status '+(complete?'complete':'pending')}>{complete&&<Check size={18}/>}<strong>{complete?'Equipment sequence complete':pendingReason}</strong></p>
  <p className="output-basis">{outcome.detail}. {complete?'This is a planned output; the process has not been run.':'This output is a preview until the equipment sequence is complete.'}</p>
  <div className="output-product-grid">{outcome.products.map((product,index)=><article className="output-product" key={index}>
   {photo?<MaterialPhoto name={product.name} image={photo} reference/>:<div className="output-image-pending">No suitable output photo sourced yet</div>}
   <div><span>EXPECTED MATERIAL</span><h3>{product.name}</h3><p>{product.amount}</p>{product.components.length>0&&<p><strong>Product-forming inputs:</strong> {product.components.join(' + ')}</p>}{product.substrates.length>0&&<p><strong>Substrate:</strong> {product.substrates.join(' + ')}</p>}</div>
  </article>)}</div>
  {outcome.example&&<section className="output-composition-source"><h3>Documented composition example</h3><a href={outcome.example.source_url} target="_blank" rel="noopener noreferrer">{outcome.example.label} · Source article</a><p>{outcome.example.scope}</p><small>{outcome.example.source_locator}</small></section>}
  <section className="output-input-list"><h3>Selected input materials</h3>{outcome.inputs.length?<div>{outcome.inputs.map(m=><article key={m.material_id}><MaterialPhoto name={m.name} compact/><div><strong>{m.name}</strong><span>{m.amount||'Amount not specified'}</span></div></article>)}</div>:<p>No input materials selected yet.</p>}</section>
  <section className="output-sequence"><h3>Selected machine sequence</h3><p>Steps follow the saved process order; prerequisites show which earlier steps must finish first.</p><ol>{outcome.sequence.map(step=><li key={step.step_id}><div className="output-sequence-heading"><span>{step.number}</span><h4>{step.label}</h4></div><small>{step.requires.length?'Requires step '+step.requires.join(' + '):'Start / independent step'}</small><div className="output-sequence-machines">{step.instruments.map(instrument=><span key={instrument.instance_id}><b>{instrument.category_id}</b>{instrument.model_name}</span>)}{!step.instruments.length&&<span>{step.vacant_slots.length?'No equipment selected':'Manual / handling step'}</span>}</div>{step.vacant_slots.length>0&&<small>Vacant slots: {step.vacant_slots.map(slot=>(slot.classes.join(' / ')||'Unclassified')+' ('+slot.role+')').join(' · ')}</small>}</li>)}</ol></section>
  {reviewPending>0&&<p className="output-review-pending">{reviewPending} configuration {reviewPending===1?'review remains':'reviews remain'} pending.</p>}
  <p className="output-card-note">Composition, size, concentration, purity and yield require process-specific evidence. Amounts selected for inputs are not carried over as predicted output quantities. Photos show reference samples.</p>
  <div className="output-card-actions"><button type="button" className="secondary-button" onClick={exportPlan}><Download size={16}/>Export expected materials</button><button type="button" className="primary-button" onClick={onClose}>Back to process</button></div>
 </div></dialog>;
}
