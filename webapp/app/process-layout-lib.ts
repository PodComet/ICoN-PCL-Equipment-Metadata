import {processDependencyGraph} from './process-dependencies.ts';
import type {ProcessWorkflow} from './process-lib.ts';

/** Dimensions follow the plan's structure, never loaded media or selected instruments. */
export function processLayout(workflow:ProcessWorkflow,expanded:boolean){
 const graph=processDependencyGraph(workflow);
 const slotWidth=expanded?240:120,stepMinimum=expanded?300:220;
 const nodeWidth=(slotCount:number)=>Math.max(stepMinimum,slotCount*slotWidth+(expanded?32:20));
 const levelWidths=graph.levels.map(level=>Math.max(...level.map(step=>nodeWidth(step.slots.length))));
 const key=JSON.stringify([workflow.route_id,expanded,graph.levels.map(level=>level.map(step=>[step.step_id,step.slots.map(slot=>slot.slot_id)]))]);
 return {key,nodeWidth,levelWidths};
}

export function fittedProcessScale(width:number,availableWidth:number,height=1,availableHeight=height){
 return Math.min(1,Math.max(1,availableWidth)/Math.max(1,width),Math.max(.8,availableHeight/Math.max(1,height)));
}
