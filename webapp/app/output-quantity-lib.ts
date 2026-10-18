import {componentFor,componentQuantity,parseComponentAmount,type ComponentData} from './component-lib.ts';
import {formatMetric} from './metric-quantity-lib.ts';
import type {MaterialPlan} from './process-materials-lib.ts';
import type {ProcessWorkflow} from './process-lib.ts';
export type OutputQuantityModel={model_id:string;formulation_id:string;route_id:string;dimension:'mass'|'volume';label:string;basis:string;terms:{line_id:string;factor:number}[];scope:string;source_url:string;source_locator:string};
export function anticipatedQuantity(plan:MaterialPlan,data:ComponentData,workflow:ProcessWorkflow){
 const model=data.output_quantity_models?.find(m=>m.formulation_id===plan.formulation_id&&m.route_id===plan.route_id);
 const unknown=(reason:string)=>({status:'not_established',display:'Output amount not established',reason,value:null as number|null,dimension:model?.dimension||null,model:model||null,recovery_percent:null as number|null});
 if(!model)return unknown('No reviewed quantity model for these inputs. Precursor dose, target size and solvent volume alone do not establish product yield.');
 let total=0;
 for(const term of model.terms){
  const matches=plan.inputs.filter(m=>m.component_line_id===term.line_id);
  if(matches.length!==1)return unknown('The model requires each identified source material once.');
  const material=matches[0],component=componentFor(material,plan,data);if(!component)return unknown('Material identity differs from the source quantity model.');
  const amount=material.amount===component.amount&&component.amount_status==='reported'?componentQuantity(component.quantity_value,component.quantity_unit):parseComponentAmount(material.amount);
  if(!amount||amount.dimension!==model.dimension)return unknown('Enter an absolute '+model.dimension+' for '+material.name+'. Concentration and flow alone cannot determine a batch quantity.');
  total+=amount.value*term.factor;
 }
 const recovery=workflow.extensions.output_recovery_percent;
 if(recovery!==undefined&&(typeof recovery!=='number'||!Number.isFinite(recovery)||recovery<0||recovery>100))return unknown('Recovery must be between 0 and 100%.');
 const assumed=typeof recovery==='number'&&model.dimension==='mass',value=total*(assumed?recovery/100:1);
 return {status:assumed?'user_recovery_assumption':model.basis,display:(assumed?'Anticipated '+formatMetric(value,model.dimension)+' at '+recovery+'% assumed recovery':model.dimension==='volume'?'≈ '+formatMetric(value,'volume')+' carrier liquid':'≤ '+formatMetric(value,'mass')+' (theoretical mass ceiling)'),reason:model.scope,value,dimension:model.dimension,model,recovery_percent:assumed?recovery:null};
}
