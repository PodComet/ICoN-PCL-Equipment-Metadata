'use client';
import {Children,useEffect,useRef,useState,type ReactNode} from 'react';
import {processDependencyGraph} from './process-dependencies';
import type {ProcessWorkflow} from './process-lib';

type Edge={key:string;path:string};
export default function ProcessHierarchy({workflow,expanded,finish,children}:{workflow:ProcessWorkflow;expanded:boolean;finish:ReactNode;children:ReactNode}){
 const graph=processDependencyGraph(workflow),nodes=Children.toArray(children),frame=useRef<HTMLDivElement>(null),board=useRef<HTMLDivElement>(null);
 const [drawing,setDrawing]=useState<{width:number;height:number;scale:number;edges:Edge[]}>({width:0,height:0,scale:1,edges:[]});
 useEffect(()=>{
  const element=board.current,container=frame.current;if(!element||!container)return;
  const measure=()=>{
   const width=element.offsetWidth,height=element.offsetHeight,origin=element.getBoundingClientRect(),renderScale=origin.width/width||1;
   const rects=new Map(Array.from(element.querySelectorAll<HTMLElement>('[data-hierarchy-node]')).map(n=>{const r=n.getBoundingClientRect();return [n.dataset.hierarchyNode!,{left:(r.left-origin.left)/renderScale,right:(r.right-origin.left)/renderScale,top:(r.top-origin.top)/renderScale,height:r.height/renderScale}]}));
   const depths=new Map(graph.levels.flatMap((level,index)=>level.map(step=>[step.step_id,index] as const))),edges:Edge[]=[];
   for(const step of workflow.steps){
    const to=rects.get(step.step_id);if(!to)continue;
    for(const parent of graph.dependencies.get(step.step_id)||[]){
     const from=rects.get(parent);if(!from||to.left<=from.left)continue;
     const x1=from.right,y1=from.top+from.height/2,x2=to.left-5,y2=to.top+to.height/2,middle=x2-16;
     const path=depths.get(step.step_id)!-depths.get(parent)!>1?`M${x1},${y1} h12 V7 H${middle} V${y2} H${x2}`:`M${x1},${y1} H${middle} V${y2} H${x2}`;
     edges.push({key:parent+'-'+step.step_id,path});
    }
   }
   const finishNode=element.querySelector('.process-finish');
   if(finishNode){
    const r=finishNode.getBoundingClientRect(),x2=(r.left-origin.left)/renderScale-5,y2=(r.top-origin.top+r.height/2)/renderScale;
    const parents=new Set([...graph.dependencies.values()].flat());
    for(const step of workflow.steps.filter(s=>!parents.has(s.step_id))){const from=rects.get(step.step_id);if(!from)continue;const x1=from.right,y1=from.top+from.height/2,middle=x2-16;
     edges.push({key:step.step_id+'-output',path:depths.get(step.step_id)!<graph.levels.length-1?`M${x1},${y1} h12 V7 H${middle} V${y2} H${x2}`:`M${x1},${y1} H${middle} V${y2} H${x2}`});
    }
   }
   // Reserve the actual first library row in the opening viewport.
   const library=document.querySelector('.process-equipment-library'),heading=library?.querySelector('.process-library-heading'),cards=Array.from(library?.querySelectorAll('.process-library-card')||[]),firstTop=cards[0]?.getBoundingClientRect().top;
   const row=cards.filter(c=>Math.abs(c.getBoundingClientRect().top-(firstTop||0))<2),rowHeight=Math.max(130,...row.map(c=>c.getBoundingClientRect().height));
   const availableHeight=Math.max(80,Math.min(260,window.innerHeight-container.getBoundingClientRect().top-(heading?.getBoundingClientRect().height||65)-rowHeight-28));
   const scale=expanded?1:Math.min(1,container.clientWidth/Math.max(1,width),availableHeight/Math.max(1,height));
   setDrawing({width,height,scale,edges});
  };
  const observer=new ResizeObserver(measure);observer.observe(element);observer.observe(container);element.querySelectorAll('[data-hierarchy-node]').forEach(n=>observer.observe(n));
  const library=document.querySelector('.process-equipment-library');if(library)observer.observe(library);
  window.addEventListener('resize',measure);measure();return()=>{observer.disconnect();window.removeEventListener('resize',measure)};
 },[workflow,expanded]);
 return <div ref={frame} className={'process-hierarchy '+(expanded?'expanded':'fitted')} style={{height:drawing.height?drawing.height*drawing.scale+(expanded?18:0):undefined}} aria-label="Hierarchical process sequence">
  <div ref={board} className="process-hierarchy-layout" style={{transform:`scale(${drawing.scale})`}}>
   <svg className="process-dependency-arrows" width={drawing.width} height={drawing.height} aria-hidden="true"><defs><marker id="process-child-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="#39744e"/></marker></defs>{drawing.edges.map(edge=><path key={edge.key} d={edge.path} fill="none" stroke="#39744e" strokeWidth="2" markerEnd="url(#process-child-arrow)"/>)}</svg>
   {graph.levels.map((level,index)=><section key={index} className="process-hierarchy-level" aria-label={'Dependency level '+(index+1)}><div className="process-level-label"><strong>LEVEL {index+1}</strong><span>{level.length>1?'Independent peers':index===0?'Start':'After prerequisites'}</span></div><div className="process-peer-steps">{level.map(step=><div key={step.step_id} data-hierarchy-node={step.step_id} className="process-hierarchy-node" style={{width:Math.max(expanded?300:194,step.slots.length*(expanded?240:100)+(expanded?32:20))}}>{nodes[workflow.steps.findIndex(s=>s.step_id===step.step_id)]}</div>)}</div></section>)}
   {finish}
  </div>
 </div>;
}
