import type {Equipment} from './catalog-lib.ts';
export type Direction={direction:string;description:string;evidence_ids:string[];effect_summary?:string;effect_evidence_ids?:string[]};
export type Fiber={position:string;position_description?:string;description:string;evidence_ids:string[];directions:Direction[];fiber_id?:string;fiber_label?:string};
export type PositionInterface={schema:'poly-fibers/v2';name:string;description:string;evidence_ids:string[];fibers:Fiber[]};
export type PositionProfile={equipment_id:string;model_name:string;manufacturer:string;status:string;interface:PositionInterface};
export type PositionEvidence={schema:string;namespace:string;subject:Record<string,string>;entries:{id:string;classification:string;claim:string;source:{kind:string;title:string;section:string;url:string|null;accessed:string};verification:{status:string;method:string}}[]};
export type PositionLibrary={profiles:PositionProfile[];evidence:PositionEvidence[]};
const identity=(s:string)=>(s||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function positionProfile(record:Equipment,library:PositionLibrary):PositionProfile{
 const exact=library.profiles.find(p=>p.equipment_id===record.equipment_id&&identity(p.model_name)===identity(record.model_name)&&identity(p.manufacturer)===identity(record.manufacturer));
 return exact||{equipment_id:record.equipment_id,model_name:record.model_name,manufacturer:record.manufacturer,status:'roadmap',interface:{schema:'poly-fibers/v2',name:'p_'+record.equipment_id.replace(/[^a-zA-Z0-9_-]/g,'_'),description:'Position List for '+record.manufacturer+' '+record.model_name+'. Positions and allowed directions await model-specific manual review.',evidence_ids:[],fibers:[]}};
}
export function validatePositionInterface(value:unknown,evidence:PositionEvidence[]):PositionInterface{
 const r=value as PositionInterface,known=new Set(evidence.flatMap(e=>e.entries.map(x=>x.id)));
 const text=(v:unknown,max=2000)=>typeof v==='string'&&v.trim()&&v.length<=max;
 const ids=(v:unknown)=>Array.isArray(v)&&v.length<=100&&v.every(id=>typeof id==='string'&&known.has(id));
 if(!r||r.schema!=='poly-fibers/v2'||!text(r.name,200)||!text(r.description)||!ids(r.evidence_ids)||!Array.isArray(r.fibers)||r.fibers.length>100)throw new Error('Use poly-fibers/v2 with a name, description, fibers array and known evidence IDs.');
 const positions=new Map<string,Fiber[]>(),fiberIds=new Set<string>();
 for(const f of r.fibers){
  if(!text(f.position,200)||!text(f.description)||!ids(f.evidence_ids)||!Array.isArray(f.directions)||f.directions.length>100)throw new Error('Each position needs a unique name or explicit fiber IDs, description, evidence IDs and directions.');
  if(f.fiber_id!==undefined&&(!text(f.fiber_id,200)||fiberIds.has(f.fiber_id)))throw new Error('Each fiber ID must be nonempty and unique within the interface.');
  if(f.fiber_label!==undefined&&!text(f.fiber_label,200))throw new Error('Use a nonempty fiber label.');
  const peers=positions.get(f.position)||[];
  if(peers.length&&(!f.fiber_id||peers.some(peer=>!peer.fiber_id)))throw new Error('Repeated positions need a unique name for each fiber in fiber_id.');
  positions.set(f.position,[...peers,f]);if(f.fiber_id)fiberIds.add(f.fiber_id);const names=new Set<string>();
  for(const d of f.directions){if(!text(d.direction,200)||names.has(d.direction)||!text(d.description)||!ids(d.evidence_ids))throw new Error('Each direction needs a unique name within its position, a description and known evidence IDs.');if(d.effect_summary!==undefined&&!text(d.effect_summary))throw new Error('Use a nonempty effect description.');if(d.effect_evidence_ids!==undefined&&!ids(d.effect_evidence_ids))throw new Error('Effect evidence IDs must exist in the evidence register.');names.add(d.direction);}
 }
 return structuredClone(r);
}
export function positionGroups(profile:PositionInterface){
 const groups=new Map<string,{position:string;fibers:{id:string;label:string;fiber:Fiber}[]}>();
 for(const fiber of profile.fibers){
  const group=groups.get(fiber.position)||{position:fiber.position,fibers:[]};
  group.fibers.push({id:fiber.fiber_id||fiber.position,label:fiber.fiber_label||'Fiber '+(group.fibers.length+1),fiber});groups.set(fiber.position,group);
 }
 return [...groups.values()];
}
export function separateFiber(profile:PositionInterface,position:string,fiberId?:string):PositionInterface{
 const fibers=profile.fibers.filter(f=>f.position===position&&(fiberId===undefined||(f.fiber_id||f.position)===fiberId));if(!fibers.length)throw new Error('Choose a recorded position and fiber.');
 return {...structuredClone(profile),fibers:structuredClone(fibers)};
}
