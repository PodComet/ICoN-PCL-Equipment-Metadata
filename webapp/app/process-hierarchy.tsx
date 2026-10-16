'use client';
import {Children,useEffect,useRef,useState,type ReactNode} from 'react';
import {processDependencyGraph} from './process-dependencies';
import type {ProcessWorkflow} from './process-lib';

type Edge={key:string;path:string};
export default function ProcessHierarchy({workflow,children}:{workflow:ProcessWorkflow;children:ReactNode}){
 const graph=processDependencyGraph(workflow),nodes=Children.toArray(children),board=useRef<HTMLDivElement>(null);
 const [drawing,setDrawing]=useState<{width:number;height:number;edges:Edge[]}>({width:0,height:0,edges:[]});
 useEffect(()=>{
  const element=board.current;if(!element)return;
  const measure=()=>{
   const bounds=element.getBoundingClientRect(),rects=new Map(Array.from(element.querySelectorAll<HTMLElement>('[data-hierarchy-node]')).map(n=>[n.dataset.hierarchyNode!,n.getBoundingClientRect()]));
   const edges:Edge[]=[],depths=new Map(graph.levels.flatMap((level,index)=>level.map(step=>[step.step_id,index] as const)));
   for(const step of workflow.steps){
    const to=rects.get(step.step_id);if(!to)continue;
    for(const parent of graph.dependencies.get(step.step_id)||[]){
     const from=rects.get(parent);if(!from||to.top<=from.top)continue;
     const x1=from.left+from.width/2-bounds.left,y1=from.bottom-bounds.top,x2=to.left+to.width/2-bounds.left,y2=to.top-bounds.top-5;
     const middle=y2-25;
     edges.push({key:parent+'-'+step.step_id,path:(depths.get(step.step_id)!-depths.get(parent)!>1?`M${x1},${y1} v15 H8 V${middle} H${x2} V${y2}`:`M${x1},${y1} V${middle} H${x2} V${y2}`)});
    }
   }
   setDrawing({width:bounds.width,height:bounds.height,edges});
  };
  const observer=new ResizeObserver(measure);observer.observe(element);element.querySelectorAll('[data-hierarchy-node]').forEach(n=>observer.observe(n));measure();
  return()=>observer.disconnect();
 },[workflow]);
 return <div ref={board} className="process-hierarchy" aria-label="Hierarchical process sequence">
  <svg className="process-dependency-arrows" width={drawing.width} height={drawing.height} aria-hidden="true"><defs><marker id="process-child-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#39744e"/></marker></defs>{drawing.edges.map(edge=><path key={edge.key} d={edge.path} fill="none" stroke="#39744e" strokeWidth="2" markerEnd="url(#process-child-arrow)"/>)}</svg>
  {graph.levels.map((level,index)=><section key={index} className="process-hierarchy-level" aria-label={'Dependency level '+(index+1)}><div className="process-level-label"><strong>LEVEL {index+1}</strong><span>{index===0?'No prerequisites':'After prerequisite steps'}{level.length>1?' · independent peers':''}</span></div><div className="process-peer-steps">{level.map(step=><div key={step.step_id} data-hierarchy-node={step.step_id} className="process-hierarchy-node">{nodes[workflow.steps.findIndex(s=>s.step_id===step.step_id)]}</div>)}</div></section>)}
 </div>;
}
