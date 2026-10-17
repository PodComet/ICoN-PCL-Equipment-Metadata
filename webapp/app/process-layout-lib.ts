import {processDependencyGraph} from './process-dependencies.ts';
import type {ProcessWorkflow} from './process-lib.ts';

/** Dimensions follow the plan's structure, never loaded media or selected instruments. */
export function processLayout(workflow:ProcessWorkflow,expanded:boolean){
 const graph=processDependencyGraph(workflow);
 const slotWidth=expanded?240:120,stepMinimum=expanded?300:220;
 const nodeWidth=(slotCount:number)=>Math.max(stepMinimum,slotCount*slotWidth+(expanded?32:20));
 const levelWidths=graph.levels.map(level=>Math.max(...level.map(step=>nodeWidth(step.slots.length))));
 const key=JSON.stringify([workflow.route_id,expanded,graph.levels.map(level=>level.map(step=>[step.step_id,step.slots.map(slot=>slot.slot_id)]))]);
 const gap=32,padding=10,inputWidth=190,outputWidth=200;
 const minimumWidth=inputWidth+outputWidth+padding*2+gap*(levelWidths.length+1)+levelWidths.reduce((sum,width)=>sum+width,0);
 return {key,nodeWidth,levelWidths,minimumWidth,gap,padding,inputWidth,outputWidth};
}

export function fittedProcessScale(width:number,availableWidth:number,height=1,availableHeight=height){
 return Math.min(1,Math.max(1,availableWidth)/Math.max(1,width),Math.max(1,availableHeight)/Math.max(1,height));
}

/** Widen the logical board after fitting its height, rather than stretching text. */
export function processViewportFit(minimumWidth:number,availableWidth:number,height:number,availableHeight:number,expanded=false){
 const scale=expanded?1:fittedProcessScale(minimumWidth,availableWidth,height,availableHeight);
 return {scale,boardWidth:Math.max(minimumWidth,Math.max(1,availableWidth)/scale)};
}
