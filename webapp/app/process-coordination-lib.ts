import {unitId,type ProcessWorkflow} from './process-lib.ts';
import {processDependencyGraph} from './process-dependencies.ts';

/** A shared instance is an exclusive physical resource; an M-class or model is not. */
export function processCoordinationAssessment(workflow:ProcessWorkflow){
 const graph=processDependencyGraph(workflow);
 function dependsOn(child:string,parent:string,seen=new Set<string>()):boolean{
  if(seen.has(child))return false;seen.add(child);
  return (graph.dependencies.get(child)||[]).some(id=>id===parent||dependsOn(id,parent,seen));
 }
 const units=new Map<string,{physical_unit_id:string;equipment_id:string;model_name:string;step_ids:string[]}>();
 for(const step of workflow.steps)for(const slot of step.slots){const i=slot.instrument;if(!i)continue;const physical=unitId(i),unit=units.get(physical)||{physical_unit_id:physical,equipment_id:i.equipment_id,model_name:i.equipment_snapshot.model_name,step_ids:[]};if(!unit.step_ids.includes(step.step_id))unit.step_ids.push(step.step_id);units.set(physical,unit);}
 const conflicts:{physical_unit_id:string;model_name:string;first_step_id:string;second_step_id:string}[]=[];
 for(const unit of units.values())for(let a=0;a<unit.step_ids.length;a++)for(let b=a+1;b<unit.step_ids.length;b++){
  const first=unit.step_ids[a],second=unit.step_ids[b];if(!dependsOn(first,second)&&!dependsOn(second,first))conflicts.push({physical_unit_id:unit.physical_unit_id,model_name:unit.model_name,first_step_id:first,second_step_id:second});
 }
 return {schema:'process-coordination-assessment/v1',scope:'planning_only',dependency_errors:graph.errors,shared_units:[...units.values()].filter(u=>u.step_ids.length>1),conflicts};
}
