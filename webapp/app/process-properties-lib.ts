import {unchangedFormulation,type ComponentData} from './component-lib.ts';
import {stepConditions,sourceConditionMatch,type ConditionLibrary} from './process-condition-lib.ts';
import {productEvidence,propertyEvidenceId} from './output-evidence-lib.ts';
import {stepDependencies} from './process-dependencies.ts';
import type {ProcessWorkflow} from './process-lib.ts';
import type {MaterialPlan} from './process-materials-lib.ts';

/** A declared literature analogue. No fitted response, interpolation or extrapolation. */
export function expectedProperties(w:ProcessWorkflow,plan:MaterialPlan,components:ComponentData,library:ConditionLibrary,equipmentComplete:boolean){
 const formulation=unchangedFormulation(plan,components),templates=new Map(library.conditions.map(c=>[c.template_id,c]));
 const current=w.steps.flatMap(step=>stepConditions(step).map(condition=>({step,condition})));
 function ancestor(parentId:string,childId:string,seen=new Set<string>()):boolean{
  if(parentId===childId)return true;if(seen.has(childId))return false;seen.add(childId);
  const child=w.steps.find(s=>s.step_id===childId);return !!child&&stepDependencies(w,child).some(id=>id===parentId||ancestor(parentId,id,new Set(seen)));
 }
 return library.properties.filter(p=>p.route_id===w.route_id).map(p=>{
  const reasons:string[]=[],checks=p.required_condition_ids.map(id=>{
   const template=templates.get(id),rows=current.filter(r=>r.condition.reference_condition_id===id);
   let status='matched';
   if(!template||!library.evidence.some(e=>e.evidence_id===template.evidence_id))status='source_unavailable';
   else if(!rows.length)status='missing';
   else if(!template.source_step_order||rows.some(r=>r.step.source_step_order!==template.source_step_order))status='step_mapping_review';
   else if(rows.some(r=>r.condition.scope_review_required))status='instrument_scope_review';
   else if(rows.some(r=>r.condition.slot_id&&!r.step.slots.find(s=>s.slot_id===r.condition.slot_id)?.instrument))status='instrument_scope_unfilled';
   else if(template.match_scope!=='example')status=template.match_scope==='parameter_study'?'study_domain':'source_ambiguity';
   else if(rows.some(r=>r.condition.label!==template.label||!sourceConditionMatch(r.condition,template)))status='changed';
   return {template_id:id,label:template?.label||id,expected:template||null,status,condition_ids:rows.map(r=>r.condition.condition_id),source_evidence_id:template?.evidence_id||''};
  });
  if(!formulation||formulation.formulation_id!==p.formulation_id)reasons.push('Selected materials, amounts or product target differ from this source formulation.');
  if(!equipmentComplete)reasons.push('Complete the appropriate equipment sequence.');
  if(checks.some(c=>c.status!=='matched'))reasons.push('Required source conditions are missing, changed or need scope review.');
  const extra=current.filter(r=>{
   const t=templates.get(r.condition.reference_condition_id);
   return r.condition.scope_review_required||!t||t.formulation_id!==p.formulation_id||t.source_step_order!==r.step.source_step_order||r.condition.label!==t.label||!sourceConditionMatch(r.condition,t);
  });
  if(extra.length)reasons.push('Additional or modified conditions need a matching property model.');
  if(w.steps.some(s=>s.slots.some(v=>v.instrument&&(Object.keys(v.instrument.configuration).length>0||Object.keys(v.instrument.operating_parameters).length>0||v.instrument.operation_sequence.some(action=>action.trim())))))reasons.push('Instrument configuration or control actions need a source-specific property model.');
  const usedSteps=[...new Set(p.required_condition_ids.map(id=>templates.get(id)?.source_step_order).filter(Boolean))].sort((a,b)=>Number(a)-Number(b));
  const mapped=usedSteps.map(order=>w.steps.find(s=>s.source_step_order===order));
  if(mapped.some((s,i)=>i>0&&s&&mapped[i-1]&&!ancestor(mapped[i-1]!.step_id,s.step_id)))reasons.push('The prerequisite sequence differs from this source example.');
  if(!p.supports_expectation)reasons.push('Reported measurement retained for reference; no predictive model admitted for this context.');
  const evidence=library.evidence.find(e=>e.evidence_id===p.evidence_id)||null;
  if(!evidence)reasons.push('Source property evidence is unavailable.');
  const qualified=!reasons.length;
  return {evidence_id:propertyEvidenceId(w,0,p.anchor_id),output_evidence_id:productEvidence(w,0).evidence_id,anchor_id:p.anchor_id,property:p.property,label:p.label,method:qualified?'conditional_literature_analogue':'not_estimated',expected_value:qualified?p.value:null,expected_upper_value:qualified?p.upper_value:null,unit:p.unit,operator:p.operator,approximate:p.approximate,reported_value:p.value,reported_upper_value:p.upper_value,reported_uncertainty:p.uncertainty,scope:p.scope,material_scope:p.material_scope,checks,reasons,source_evidence_ids:[p.evidence_id,...checks.map(c=>c.source_evidence_id).filter(Boolean)],source:evidence,validation_status:'experimental_validation_roadmap',uncertainty_status:'No predictive uncertainty model; reported measurement dispersion is not a prediction interval.'};
 });
}
