import type {ProcessStep,ProcessWorkflow} from './process-lib.ts';

/** Older plans retain their linear source sequence until a dependency is explicitly edited. */
export function stepDependencies(workflow:ProcessWorkflow,step:ProcessStep):string[]{
 const value=step.extensions.prerequisite_step_ids;
 if(Array.isArray(value))return value.filter((id):id is string=>typeof id==='string');
 const index=workflow.steps.findIndex(s=>s.step_id===step.step_id);
 return index>0?[workflow.steps[index-1].step_id]:[];
}
export function processDependencyGraph(workflow:ProcessWorkflow){
 const ids=new Set(workflow.steps.map(s=>s.step_id)),errors:string[]=[],dependencies=new Map<string,string[]>();
 for(const step of workflow.steps){
  const raw=step.extensions.prerequisite_step_ids;
  if(raw!==undefined&&(!Array.isArray(raw)||raw.some(id=>typeof id!=='string')))errors.push('Invalid prerequisites for '+step.label+'.');
  const parents=stepDependencies(workflow,step);dependencies.set(step.step_id,parents);
  if(new Set(parents).size!==parents.length||parents.some(id=>!ids.has(id)||id===step.step_id))errors.push('Choose distinct, existing prerequisite steps for '+step.label+'.');
 }
 const levels:ProcessStep[][]=[],placed=new Set<string>();
 while(placed.size<workflow.steps.length){
  const next=workflow.steps.filter(s=>!placed.has(s.step_id)&&dependencies.get(s.step_id)!.every(id=>placed.has(id)));
  if(!next.length){errors.push('Step dependencies form a cycle or refer to a missing step.');levels.push(workflow.steps.filter(s=>!placed.has(s.step_id)));break;}
  levels.push(next);next.forEach(s=>placed.add(s.step_id));
 }
 return {levels,dependencies,errors:[...new Set(errors)]};
}
export function withStepDependencies(workflow:ProcessWorkflow,stepId:string,parents:string[]):ProcessWorkflow{
 if(!workflow.steps.some(s=>s.step_id===stepId))throw new Error('Choose an existing step.');
 const next={...workflow,extensions:{...workflow.extensions,dependency_schema:'process-dependencies/v1'},steps:workflow.steps.map(s=>({...s,extensions:{...s.extensions,prerequisite_step_ids:s.step_id===stepId?[...parents]:stepDependencies(workflow,s)}}))};
 const graph=processDependencyGraph(next);if(graph.errors.length)throw new Error(graph.errors[0]);return next;
}
export function removeWorkflowStep(workflow:ProcessWorkflow,stepId:string):ProcessWorkflow{
 const removed=workflow.steps.find(s=>s.step_id===stepId);if(!removed)return workflow;
 if(workflow.extensions.dependency_schema!=='process-dependencies/v1')return {...workflow,steps:workflow.steps.filter(s=>s.step_id!==stepId)};
 const parents=stepDependencies(workflow,removed);
 return {...workflow,steps:workflow.steps.filter(s=>s.step_id!==stepId).map(s=>({...s,extensions:{...s.extensions,prerequisite_step_ids:[...new Set(stepDependencies(workflow,s).flatMap(id=>id===stepId?parents:[id]))]}}))};
}
