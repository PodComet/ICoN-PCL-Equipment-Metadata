'use client';
import {useState} from 'react';
import {FlaskConical,Plus,X} from 'lucide-react';
import {newStartingMaterial,type MaterialDataset,type MaterialPlan,type MaterialSuggestion} from './process-materials-lib';
import {amountChoices,materialKey,relevantMaterials,replaceMaterial} from './material-options';
import MaterialPhoto from './material-photo';

export function StartingMaterials({plan,onEdit}:{plan:MaterialPlan;onEdit:()=>void}){
 const item=(m:MaterialPlan['inputs'][number])=><li key={m.material_id}><MaterialPhoto name={m.name} compact/><div><strong>{m.name||'Choose a material'}</strong>{m.amount&&<small>{m.amount}</small>}</div></li>;
 return <div className="process-start-materials"><span>START · {plan.route_id}</span><h3><FlaskConical size={17}/>Input materials</h3>{plan.inputs.length?<><ul>{plan.inputs.slice(0,4).map(item)}</ul>{plan.inputs.length>4&&<details><summary>{plan.inputs.length-4} more materials</summary><ul>{plan.inputs.slice(4).map(item)}</ul></details>}</>:<p>No starting materials selected.</p>}<button type="button" className="secondary-button" onClick={onEdit}>{plan.inputs.length?'Edit materials':'Choose materials'}</button><small>Starting inputs for step 1</small></div>;
}

export function MaterialsEditor({plan,data,onChange,onClose}:{plan:MaterialPlan;data:MaterialDataset;onChange:(p:MaterialPlan)=>void;onClose:()=>void}){
 const [choice,setChoice]=useState(''),[amount,setAmount]=useState('');
 const suggestions=relevantMaterials(data,plan.route_id),selected=suggestions.find(m=>materialKey(m)===choice),full=plan.inputs.length>=30;
 const used=(suggestion:MaterialSuggestion,except='')=>plan.inputs.some(m=>m.material_id!==except&&materialKey(m)===materialKey(suggestion));
 function options(current?:MaterialSuggestion,id=''){
  const known=current&&suggestions.some(m=>materialKey(m)===materialKey(current));
  return <><option value="">Choose a material…</option>{current&&!known&&<option value={materialKey(current)}>{current.name} (saved)</option>}{suggestions.map(m=><option key={materialKey(m)} value={materialKey(m)} disabled={used(m,id)}>{m.name}</option>)}</>;
 }
 return <section className="process-materials-editor simple-material-editor" aria-label="Starting materials editor">
  <div className="process-materials-editor-heading"><h3>{plan.route_id} · Input materials</h3><button type="button" className="secondary-button" onClick={onClose}>Done <X size={16}/></button></div>
  <div className="process-material-inputs">{plan.inputs.map((m,index)=><div className="material-selection-row" key={m.material_id}>
   <MaterialPhoto name={m.name}/>
   <label>Material {index+1}<select aria-label={'Material '+(index+1)} value={materialKey(m)} onChange={e=>{const next=suggestions.find(v=>materialKey(v)===e.target.value);if(next)onChange(replaceMaterial(plan,m.material_id,next));}}>{options(m,m.material_id)}</select></label>
   <label>Amount<select aria-label={'Amount for material '+(index+1)} value={m.amount} onChange={e=>onChange({...plan,inputs:plan.inputs.map(x=>x.material_id===m.material_id?{...x,amount:e.target.value}:x)})}>{amountChoices(m,m.amount).map(a=><option value={a.value} key={a.value}>{a.label}</option>)}</select></label>
   <button type="button" className="material-remove" aria-label={'Remove material '+(index+1)} onClick={()=>onChange({...plan,example_id:'',expected_output:'',inputs:plan.inputs.filter(x=>x.material_id!==m.material_id)})}><X size={17}/></button>
  </div>)}</div>
  {!full&&<div className="material-selection-row material-add-row">
   <MaterialPhoto name={selected?.name||''}/>
   <label>{plan.inputs.length?'Add material':'Material'}<select aria-label="Add material" value={choice} onChange={e=>{setChoice(e.target.value);setAmount('')}}>{options()}</select></label>
   <label>Amount<select aria-label="Amount for new material" value={amount} disabled={!selected} onChange={e=>setAmount(e.target.value)}>{selected?amountChoices(selected).map(a=><option value={a.value} key={a.value}>{a.label}</option>):<option value="">Choose a material first</option>}</select></label>
   <button type="button" className="secondary-button material-add-button" disabled={!selected} onClick={()=>{if(selected&&!used(selected)){onChange({...plan,example_id:'',expected_output:'',inputs:[...plan.inputs,newStartingMaterial(selected,amount)]});setChoice('');setAmount('')}}}><Plus size={15}/>Add</button>
  </div>}
  <p className="process-material-note">Amount choices are planning quantities, not a process recipe. Save the workflow to keep your selections.</p>
 </section>;
}
