'use client';
import {processCoordinationAssessment} from './process-coordination-lib';
import {stepDependencies,withStepDependencies} from './process-dependencies';
import type {ProcessWorkflow} from './process-lib';
export default function ProcessCoordination({workflow,onChange}:{workflow:ProcessWorkflow;onChange:(workflow:ProcessWorkflow)=>void}){
 const a=processCoordinationAssessment(workflow),step=(id:string)=>workflow.steps.find(s=>s.step_id===id)!;
 return <details className="process-coordination"><summary>Machine coordination · {a.conflicts.length? a.conflicts.length+' shared-unit conflicts':a.dependency_errors.length?'review dependencies':a.shared_units.length+' shared units · no ordering conflicts found'}</summary>
  <p>Process prerequisites determine which steps may run in parallel. Reusing one physical equipment unit requires an order between its steps. Operation settings remain on each instrument occurrence.</p>
  {a.dependency_errors.map(e=><p key={e} className="error-box">{e}</p>)}
  {a.conflicts.map(c=><article key={c.physical_unit_id+c.first_step_id+c.second_step_id}><strong>{c.model_name}</strong><p>“{step(c.first_step_id).label}” and “{step(c.second_step_id).label}” share one unit without a dependency.</p><button type="button" disabled={!!a.dependency_errors.length} onClick={()=>onChange(withStepDependencies(workflow,c.second_step_id,[...new Set([...stepDependencies(workflow,step(c.second_step_id)),c.first_step_id])]))}>Order: {step(c.first_step_id).label} → {step(c.second_step_id).label}</button></article>)}
  {!a.conflicts.length&&!a.dependency_errors.length&&<p>No unordered uses of a shared physical unit found in this plan.</p>}
  <small>Planning check. Resource reservations, timing, live signals and device execution are future capabilities.</small>
 </details>;
}
