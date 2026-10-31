'use client';
import {Children,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {processDependencyGraph} from './process-dependencies';
import type {ProcessWorkflow} from './process-lib';
import {processLayout,processViewportFit} from './process-layout-lib';
import {connectionLabel,type ProcessIOAlignment} from './process-io-alignment';

type Edge={key:string;path:string};
type IOBadge={key:string;x:number;y:number;path:string;label:string};
export default function ProcessHierarchy({workflow,alignment,expanded,active=true,start,finish,children}:{workflow:ProcessWorkflow;alignment?:ProcessIOAlignment;expanded:boolean;active?:boolean;start:ReactNode;finish:ReactNode;children:ReactNode}){
 const graph=processDependencyGraph(workflow),layout=processLayout(workflow,expanded),nodes=Children.toArray(children),frame=useRef<HTMLDivElement>(null),board=useRef<HTMLDivElement>(null);
 const fitted=useRef<{key:string;scale:number;boardWidth:number;availableWidth:number;availableHeight:number}|null>(null);
 const [drawing,setDrawing]=useState<{width:number;height:number;scale:number;boardWidth:number;key:string;edges:Edge[];badges:IOBadge[]}>({width:0,height:0,scale:1,boardWidth:0,key:"",edges:[],badges:[]});
 useLayoutEffect(()=>{
  const element=board.current,container=frame.current;if(!active||!element||!container)return;
  const measure=()=>{
   const width=element.offsetWidth,height=element.offsetHeight;
   // The Processes workspace mounts while hidden. Do not pin a zero-size initial fit.
   if(!width||!height||!container.clientWidth)return;
   const origin=element.getBoundingClientRect(),renderScale=origin.width/width||1;
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
   const inputNode=element.querySelector('.process-input-node'),first=rects.get(workflow.steps[0]?.step_id);
   if(inputNode&&first){const r=inputNode.getBoundingClientRect(),x1=(r.right-origin.left)/renderScale,y1=(r.top-origin.top+r.height/2)/renderScale,x2=first.left-5,y2=first.top+first.height/2;
    edges.push({key:'inputs-first-step',path:`M${x1},${y1} H${x2-12} V${y2} H${x2}`});
   }
   const finishNode=element.querySelector('.process-finish');
   if(finishNode){
    const r=finishNode.getBoundingClientRect(),x2=(r.left-origin.left)/renderScale-5,y2=(r.top-origin.top+r.height/2)/renderScale;
    const parents=new Set([...graph.dependencies.values()].flat());
    for(const step of workflow.steps.filter(s=>!parents.has(s.step_id))){const from=rects.get(step.step_id);if(!from)continue;const x1=from.right,y1=from.top+from.height/2,middle=x2-16;
     edges.push({key:step.step_id+'-output',path:depths.get(step.step_id)!<graph.levels.length-1?`M${x1},${y1} h12 V7 H${middle} V${y2} H${x2}`:`M${x1},${y1} H${middle} V${y2} H${x2}`});
    }
   }
   // Fit inside a CSS-reserved viewport. Content, page scroll and unrelated window
   // resize events must never feed back into the surrounding panel's height.
   const availableWidth=container.clientWidth,availableHeight=container.clientHeight;
   if(!fitted.current||fitted.current.key!==layout.key||fitted.current.availableWidth!==availableWidth||fitted.current.availableHeight!==availableHeight){
    fitted.current={key:layout.key,availableWidth,availableHeight,...processViewportFit(layout.minimumWidth,availableWidth,height,availableHeight,expanded)};
   }
   const slotRects=new Map(Array.from(element.querySelectorAll<HTMLElement>('[data-process-slot]')).map(n=>{const r=n.getBoundingClientRect();return [n.dataset.processSlot!,{left:(r.left-origin.left)/renderScale,right:(r.right-origin.left)/renderScale,top:(r.top-origin.top)/renderScale,height:r.height/renderScale}]}));
   const badges:IOBadge[]=[];
   for(const match of alignment?.matched||[]){
    const from=slotRects.get(match.fromSlot),to=slotRects.get(match.toSlot),parent=rects.get(match.fromStep),child=rects.get(match.toStep);
    if(!from||!to||!parent||!child||child.left<=parent.left)continue;
    const x=depths.get(match.toStep)!-depths.get(match.fromStep)!>1?child.left-16:(parent.right+child.left)/2;
    const y1=from.top+from.height/2,y2=to.top+to.height/2,y=(y1+y2)/2;
    const path=depths.get(match.toStep)!-depths.get(match.fromStep)!>1?`M${from.right},${y1} H${parent.right+10} V7 H${x} V${y2} H${to.left}`:`M${from.right},${y1} H${x} V${y2} H${to.left}`;
    const badgeY=depths.get(match.toStep)!-depths.get(match.fromStep)!>1?y2:y;
    const existing=badges.find(b=>Math.abs(b.x-x)<1&&Math.abs(b.y-badgeY)<20);
    if(existing){existing.label+='\n'+connectionLabel(match);continue;}
    badges.push({key:match.fromSlot+'-'+match.toSlot,x,y:badgeY,path,label:connectionLabel(match)});
   }
   const next={width,height,scale:fitted.current.scale,boardWidth:fitted.current.boardWidth,key:layout.key,edges,badges};
   setDrawing(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
  };
  const observer=new ResizeObserver(()=>measure());observer.observe(element);observer.observe(container);
  measure();return()=>observer.disconnect();
 },[workflow,alignment,expanded,active,drawing.boardWidth]);
 return <div ref={frame} className={'process-hierarchy '+(expanded?'expanded':'fitted')} aria-label="Hierarchical process sequence">
  <div ref={board} className="process-hierarchy-layout" style={{width:drawing.key===layout.key?drawing.boardWidth:layout.minimumWidth,gap:layout.gap,paddingInline:layout.padding,transform:`scale(${drawing.key===layout.key?drawing.scale:1})`,visibility:drawing.width?'visible':'hidden'}}>
   <svg className="process-dependency-arrows" width={drawing.width} height={drawing.height} aria-hidden="true"><defs><marker id="process-child-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="var(--process-flow-line, #39744e)"/></marker></defs>{drawing.edges.map(edge=><path key={edge.key} d={edge.path} fill="none" stroke="var(--process-flow-line, #39744e)" strokeWidth="2" markerEnd="url(#process-child-arrow)"/>)}</svg>
   <svg className="process-io-connections" width={drawing.width} height={drawing.height} aria-label="Equipment output and input matches">{drawing.badges.map(b=><g key={b.key}><path d={b.path} fill="none" stroke="#38d77d" strokeWidth="2" opacity=".85"/><g className="process-io-check" transform={`translate(${b.x},${b.y})`} tabIndex={0} role="img" aria-label={b.label}><title>{b.label}</title><circle r="12" fill="#168348" stroke="#8af3b3" strokeWidth="2"/><path d="M-5 0 L-1 4 L6-4" fill="none" stroke="white" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"/></g></g>)}</svg>
   <div className="process-input-node" style={{width:layout.inputWidth,flexBasis:layout.inputWidth}}>{start}</div>
   {graph.levels.map((level,index)=><section key={index} className="process-hierarchy-level" style={{flexGrow:layout.levelWidths[index],flexBasis:layout.levelWidths[index]}} aria-label={'Dependency level '+(index+1)}><div className="process-level-label"><strong>LEVEL {index+1}</strong><span>{level.length>1?'Independent peers':index===0?'Start':'After prerequisites'}</span></div><div className="process-peer-steps">{level.map(step=><div key={step.step_id} data-hierarchy-node={step.step_id} className="process-hierarchy-node" style={{width:"100%"}}>{nodes[workflow.steps.findIndex(s=>s.step_id===step.step_id)]}</div>)}</div></section>)}
   {finish}
  </div>
 </div>;
}
