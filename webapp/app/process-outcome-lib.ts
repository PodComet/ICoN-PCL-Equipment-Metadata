import {pendingClassSlots} from './process-classification-lib.ts';
import {materialOutput,type MaterialDataset,type MaterialPlan,type MaterialSuggestion} from './process-materials-lib.ts';
import {materialName,type MaterialImages} from './material-options.ts';
import {stepDependencies} from './process-dependencies.ts';
import type {ProcessWorkflow} from './process-lib.ts';
import {unchangedFormulation,type ComponentData} from './component-lib.ts';
import {productEvidence,outputNamespace} from './output-evidence-lib.ts';
import {stepConditions} from './process-condition-lib.ts';
const names=(items:MaterialSuggestion[])=>items.map(m=>m.name.trim()).filter(Boolean);
export function compositionExample(plan:MaterialPlan,data:MaterialDataset){
 const keys=(items:MaterialSuggestion[])=>items.map(m=>m.role+':'+materialName(m.name)).sort();
 const actual=keys(plan.inputs);
 return data.examples.find(e=>e.route_id===plan.route_id&&e.inputs.length===actual.length&&keys(e.inputs).every((key,i)=>key===actual[i]))||null;
}
export function materialOutcome(plan:MaterialPlan,data:MaterialDataset,workflow:ProcessWorkflow,components?:ComponentData){
 let base=materialOutput(plan,data.profiles,data.examples);
 const example=compositionExample(plan,data);
 if(example&&!plan.expected_output.trim())base={label:example.output_label,basis:'source_example',detail:'Documented input/product composition · quantities, operating conditions and yield still require review',example};
 const mode=data.profiles.find(p=>p.route_id===plan.route_id)?.naming_mode||'generic';
 const primary=plan.inputs.filter(m=>['feedstock','target','precursor','polymer','nanofiller','sample'].includes(m.role)),substrates=plan.inputs.filter(m=>m.role==='substrate'),liquids=plan.inputs.filter(m=>m.role==='solvent');
 if(!plan.expected_output.trim()&&!base.example){
  if(!primary.length&&!substrates.length)base={label:plan.inputs.length?'Choose a product-forming material':'Add starting materials',basis:'unspecified',detail:plan.inputs.length?'Only supporting materials are selected. Add a feedstock, precursor, sample or substrate.':'Select inputs to identify the expected material.',example:null};
  else if(['P01','P03'].includes(plan.route_id)&&primary.length===1&&['Gold (Au)','Silver (Ag)'].includes(primary[0].name)){
   base={...base,label:primary[0].name+' nanoparticle'+(plan.route_id==='P03'&&liquids.length?' dispersion in '+names(liquids).join(' + '):' target'),detail:'Process-specific planning target from the selected metal · phase, dimensions, conversion and yield are not predicted'};
  }else if(mode==='film'&&primary.length===1&&primary[0].name==='Gold (Au)')base={...base,label:'Gold (Au) film'+(substrates.length?' on '+names(substrates).join(' + '):''),detail:'Film planning target from the selected deposition target and substrate · thickness and film quality are not predicted'};
 }
 const twoPhoton=workflow.route_id==='P06'&&workflow.steps.some(s=>s.slots.some(v=>v.instrument?.category_id==='M89'));
 const formulation=!twoPhoton&&components?unchangedFormulation(plan,components):null;
 if(formulation&&formulation.completeness!=='not_applicable')base={label:formulation.output_label,basis:'source_example',detail:'Documented formulation example · '+formulation.batch_basis+' · source conditions and yield still require review',example:null};
 if(twoPhoton)base={label:plan.expected_output.trim()||'Two-photon patterned polymer structure — planning target',basis:'user_target',detail:'Select a model-compatible two-photon photopolymer and development recipe. The existing electron-beam/metal-pattern formulation does not validate this branch; resolution, shrinkage and output chemistry are not predicted.',example:null};
 const product=base.basis==='unspecified'?null:{...productEvidence(workflow,0),name:base.label,form:mode,components:names(primary),substrates:names(substrates),amount:'Output amount not established',supporting_reference_ids:formulation?.reference_ids||example?.reference_ids.split(';').filter(Boolean)||[]};
 const sequence=workflow.steps.map((step,index)=>({step_id:step.step_id,number:index+1,label:step.label,pending_classification:pendingClassSlots(step).map(slot=>({slot_id:slot.slot_id,label:slot.label,previous_class_ids:slot.allowed_category_ids})),requires:stepDependencies(workflow,step).map(id=>workflow.steps.findIndex(s=>s.step_id===id)+1),instruments:step.slots.filter(s=>s.instrument).map(s=>({equipment_id:s.instrument!.equipment_id,instance_id:s.instrument!.instance_id,category_id:s.instrument!.category_id,model_name:s.instrument!.equipment_snapshot.model_name,manufacturer:s.instrument!.equipment_snapshot.manufacturer,configuration:s.instrument!.configuration,operating_parameters:s.instrument!.operating_parameters,operation_sequence:s.instrument!.operation_sequence})),vacant_slots:step.slots.filter(s=>!s.instrument).map(s=>({classes:s.allowed_category_ids,role:String(s.extensions.requirement_role||'required')}))}));
 return {...base,evidence_id:outputNamespace(workflow)+'-ASSESSMENT',evidence_revision:workflow.extensions.output_evidence_revision??null,formulation,products:product?[product]:[],mode,sequence,conditions:workflow.steps.map(s=>({step_id:s.step_id,source_step_order:s.source_step_order,step_label:s.label,conditions:structuredClone(stepConditions(s))})),experimental_validation:'future_roadmap',inputs:plan.inputs.map(m=>({...m})),route_id:plan.route_id,workflow_id:workflow.workflow_id};
}
export function outputReference(outcome:ReturnType<typeof materialOutcome>,media:MaterialImages){
 if(!outcome.products.length)return null;
 const content=[outcome.label,...outcome.products.flatMap(p=>p.components)].join(' ').toLowerCase();
 const wetGold=content.includes('gold')&&(/dispersion|suspension/.test(content)||outcome.inputs.some(m=>m.role==='solvent'));
 const tags=outcome.mode==='particles'||outcome.mode==='assembled'?(wetGold?['gold nanoparticles']:content.includes('magnetite')?['magnetite nanoparticles']:[]):outcome.mode==='fibers'?['polymer nanofibers']:[];
 return media.images.find(image=>image.output_tags.some(tag=>tags.includes(tag)))||null;
}
