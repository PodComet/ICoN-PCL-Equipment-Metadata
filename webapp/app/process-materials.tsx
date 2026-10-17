'use client';
import {useId,useState} from 'react';
import {FlaskConical,Plus,X} from 'lucide-react';
import {newStartingMaterial,MATERIAL_ROLES,type MaterialRole,type MaterialDataset,type MaterialPlan,type MaterialSuggestion} from './process-materials-lib';
import {amountChoices,materialKey,relevantMaterials,replaceMaterial} from './material-options';
import MaterialPhoto from './material-photo';
import ComponentDetails,{ComponentPhoto} from './component-details';
import {componentData} from './process-budget';
import {componentFor,formulationFor,formulationPlan,unchangedFormulation} from './component-lib';

export function StartingMaterials({plan,onEdit}:{plan:MaterialPlan;onEdit:()=>void}){
 const item=(m:MaterialPlan['inputs'][number])=><li key={m.material_id}><ComponentPhoto material={m} plan={plan} compact/><div><strong>{m.name||'Choose a material'}</strong>{m.amount&&<small>{m.amount}</small>}</div></li>;
 return <div className="process-start-materials"><span>START · {plan.route_id}</span><h3><FlaskConical size={17}/>Input materials</h3>{plan.inputs.length?<><ul>{plan.inputs.slice(0,4).map(item)}</ul>{plan.inputs.length>4&&<details><summary>{plan.inputs.length-4} more materials</summary><ul>{plan.inputs.slice(4).map(item)}</ul></details>}</>:<p>No starting materials selected.</p>}<button type="button" className="secondary-button" onClick={onEdit}>{plan.inputs.length?'Edit materials':'Choose materials'}</button><small>Starting inputs for step 1</small></div>;
}

const CUSTOM_MATERIAL='__custom_material__';
function AmountField({label,value,sourcedAmount,disabled=false,onChange}:{label:string;value:string;sourcedAmount?:string;material?:MaterialSuggestion;disabled?:boolean;onChange:(value:string)=>void}){
 const id=useId();
 return <label>Amount<input aria-label={label} type="text" value={value} maxLength={100} disabled={disabled} list={id} placeholder="Enter quantity + units or source amount" onChange={e=>onChange(e.target.value)}/><datalist id={id}>{sourcedAmount&&<option value={sourcedAmount} label="Reported amount · this formulation only"/>}</datalist></label>;
}
function RoleField({value,label,onChange}:{value:MaterialRole;label:string;onChange:(value:MaterialRole)=>void}){
 return <label className="material-role-field">Role<select aria-label={label} value={value} onChange={e=>onChange(e.target.value as MaterialRole)}>{Object.entries(MATERIAL_ROLES).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>;
}
export function MaterialsEditor({plan,data,onChange,onClose}:{plan:MaterialPlan;data:MaterialDataset;onChange:(p:MaterialPlan)=>void;onClose:()=>void}){
 const [formulationChoice,setFormulationChoice]=useState('');
 const formulations=componentData.formulations.filter(f=>f.route_id===plan.route_id),activeFormulation=formulations.find(f=>f.formulation_id===formulationChoice)||formulationFor(plan,componentData)||formulations[0];
 const [choice,setChoice]=useState(''),[amount,setAmount]=useState(''),[customName,setCustomName]=useState(''),[customRole,setCustomRole]=useState<MaterialRole>('feedstock'),[customModes,setCustomModes]=useState<Record<string,boolean>>({});
 const suggestions=[...new Map([...relevantMaterials(data,plan.route_id),...formulations.flatMap(f=>f.components)].map(m=>[materialKey(m),m])).values()],custom=choice===CUSTOM_MATERIAL,selected:MaterialSuggestion|undefined=custom?{name:customName.trim(),role:customRole}:suggestions.find(m=>materialKey(m)===choice),full=plan.inputs.length>=30;
 const used=(suggestion:MaterialSuggestion,except='')=>plan.inputs.some(m=>m.material_id!==except&&materialKey(m)===materialKey(suggestion));
 function options(current?:MaterialSuggestion,id=''){
  const known=current&&suggestions.some(m=>materialKey(m)===materialKey(current));
  return <><option value="">Choose a material…</option>{current&&!known&&<option value={materialKey(current)}>{current.name} (saved)</option>}{suggestions.map(m=><option key={materialKey(m)} value={materialKey(m)} disabled={used(m,id)}>{m.name}</option>)}<option value={CUSTOM_MATERIAL}>Enter a custom material…</option></>;
 }
 const updateMaterial=(id:string,changes:Partial<MaterialSuggestion>)=>onChange({...plan,example_id:'',expected_output:'',inputs:plan.inputs.map(m=>m.material_id===id?{...m,...changes}:m)});
 function add(){if(!selected||!selected.name.trim()||used(selected)||full)return;const added=newStartingMaterial(selected,amount);onChange({...plan,example_id:'',expected_output:'',inputs:[...plan.inputs,added]});if(custom)setCustomModes(v=>({...v,[added.material_id]:true}));setChoice('');setCustomName('');setCustomRole('feedstock');setAmount('');}
 return <section className="process-materials-editor simple-material-editor" aria-label="Starting materials editor">
  <div className="process-materials-editor-heading"><h3>{plan.route_id} · Input materials</h3><div className="material-editor-actions">{!full&&<button type="button" className="secondary-button" onClick={()=>setChoice(CUSTOM_MATERIAL)}><Plus size={15}/>Add custom material</button>}<button type="button" className="secondary-button" onClick={onClose}>Done <X size={16}/></button></div></div>
  {activeFormulation&&<div className="formulation-picker"><label>Documented formulation for {plan.route_id}<select aria-label="Documented formulation" value={activeFormulation.formulation_id} onChange={e=>setFormulationChoice(e.target.value)}>{formulations.map(f=><option key={f.formulation_id} value={f.formulation_id}>{f.label}</option>)}</select></label><button type="button" className="primary-button" disabled={!activeFormulation.components.length} onClick={()=>onChange(formulationPlan(activeFormulation))}>{plan.inputs.length?'Replace inputs with formulation':'Use formulation & amounts'}</button><div>{plan.formulation_id===activeFormulation.formulation_id&&<p className="formulation-status" role="status"><b>{unchangedFormulation(plan,componentData)?'Source amounts loaded':'Inputs modified from this source example'}</b>{!unchangedFormulation(plan,componentData)&&' · the source batch below describes the original amounts.'}</p>}<b>Batch / scale:</b> {activeFormulation.batch_basis}<br/><a href={activeFormulation.source_url} target="_blank" rel="noopener noreferrer">Source methods · {activeFormulation.source_title}</a><p>{activeFormulation.scope}</p><small>{activeFormulation.completeness==='not_applicable'?'No nanomaterial formulation applies to this control demonstration.':'Reported ingredients include support, washing and stock-preparation materials where specified. Missing quantities and ambiguous source values remain marked for review.'}</small></div></div>}
  <div className="process-material-inputs">{plan.inputs.map((m,index)=>{
   const known=suggestions.some(s=>materialKey(s)===materialKey(m)),manual=customModes[m.material_id]??!known;
   return <div className="material-selection-row" key={m.material_id}>
    <ComponentPhoto material={m} plan={plan}/>
    <div className="material-name-field">{manual?<><label>Material {index+1} · custom<input aria-label={'Material '+(index+1)} value={m.name} maxLength={180} placeholder="Enter material name" aria-invalid={!m.name.trim()} onChange={e=>{setCustomModes(v=>({...v,[m.material_id]:true}));updateMaterial(m.material_id,{name:e.target.value})}}/></label><div className="material-custom-meta"><RoleField label={'Role for material '+(index+1)} value={m.role} onChange={role=>updateMaterial(m.material_id,{role})}/><button type="button" className="material-mode-button" onClick={()=>setCustomModes(v=>({...v,[m.material_id]:false}))}>Use suggestions</button></div></>:<><label>Material {index+1}<select aria-label={'Material '+(index+1)} value={materialKey(m)} onChange={e=>{if(e.target.value===CUSTOM_MATERIAL){setCustomModes(v=>({...v,[m.material_id]:true}));return;}const next=suggestions.find(v=>materialKey(v)===e.target.value);if(next)onChange(replaceMaterial(plan,m.material_id,next));}}>{options(m,m.material_id)}</select></label></>}</div>
    <AmountField label={'Amount for material '+(index+1)} value={m.amount} material={m} sourcedAmount={componentFor(m,plan,componentData)?.amount} onChange={amount=>onChange({...plan,inputs:plan.inputs.map(x=>x.material_id===m.material_id?{...x,amount}:x)})}/>
    <ComponentDetails material={m} plan={plan} onOffer={offer_id=>onChange({...plan,inputs:plan.inputs.map(x=>x.material_id===m.material_id?{...x,offer_id}:x)})}/>
    <button type="button" className="material-remove" aria-label={'Remove material '+(index+1)} onClick={()=>onChange({...plan,example_id:'',expected_output:'',inputs:plan.inputs.filter(x=>x.material_id!==m.material_id)})}><X size={17}/></button>
   </div>;
  })}</div>
  {!full&&<div className="material-selection-row material-add-row">
   <MaterialPhoto name={selected?.name||''}/>
   <div className="material-name-field">{custom?<><label>Custom material name<input aria-label="Custom material name" autoFocus value={customName} maxLength={180} placeholder="e.g. Cellulose blend A" onChange={e=>setCustomName(e.target.value)}/></label><div className="material-custom-meta"><RoleField label="Role for new custom material" value={customRole} onChange={setCustomRole}/><button type="button" className="material-mode-button" onClick={()=>setChoice('')}>Use suggestions</button></div></>:<label>{plan.inputs.length?'Add material':'Material'}<select aria-label="Add material" value={choice} onChange={e=>{setChoice(e.target.value);setAmount('')}}>{options()}</select></label>}</div>
   <AmountField label="Amount for new material" value={amount} material={selected} disabled={!selected} onChange={setAmount}/>
   <button type="button" className="secondary-button material-add-button" disabled={!selected?.name.trim()||!!selected&&used(selected)} onClick={add}><Plus size={15}/>{custom?'Add custom material to list':'Add'}</button>
  </div>}
  <p className="process-material-note">Choose a documented formulation to load its reported ingredients and amounts together, or enter your own materials. A formulation is one literature example for this process class, not a universal protocol. Free-text amounts remain available. Pack quotes and estimated material use are different; missing prices or incompatible amounts stay uncosted. Save the workflow to keep your inputs.</p>
 </section>;
}
