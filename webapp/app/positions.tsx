'use client';
import {useId,useState} from 'react';
import {Download,GitBranch} from 'lucide-react';
import libraryData from './data/positions.json';
import {positionProfile,positionGroups,separateFiber,type PositionLibrary} from './position-lib';
import {safeUrl,type Equipment} from './catalog-lib';
const library=libraryData as PositionLibrary;
export default function PositionList({record,expanded=false,id}:{record:Equipment;expanded?:boolean;id?:string}){
 const p=positionProfile(record,library),groups=positionGroups(p.interface),[selected,setSelected]=useState('');
 const current=groups.find(group=>group.position===selected)||groups[0];
 const evidenceIds=new Set([...p.interface.evidence_ids,...p.interface.fibers.flatMap(f=>[...f.evidence_ids,...f.directions.flatMap(d=>d.evidence_ids)])]);
 const evidence=library.evidence.flatMap(e=>e.entries).filter(e=>evidenceIds.has(e.id));
 const instanceId=useId(),idPrefix=(id||'position-'+record.equipment_id+'-'+instanceId).replace(/[^a-zA-Z0-9_-]/g,'_');
 function download(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name.replace(/[^a-zA-Z0-9_-]/g,'_')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const cited=(ids:string[])=>ids.length?ids.map(evidenceId=><a key={evidenceId} href={'#'+idPrefix+'-'+evidenceId} onClick={e=>{const register=e.currentTarget.closest('.position-list')?.querySelector<HTMLDetailsElement>('.position-evidence-register');if(register)register.open=true;}}>{evidenceId}</a>):<span>Evidence not yet linked</span>;
 return <details id={id} className="position-list" open={expanded||undefined}>
  <summary><GitBranch size={16}/><span>POSITION · Fibers &amp; Directions</span><small>{groups.length} positions · {p.interface.fibers.length} fibers</small></summary>
  <p>{p.interface.description}</p>
  <p className="fine-print">A POSITION is a documented mechanical position or operating mode. Each fiber lists its available DIRECTIONS. Manual-derived facts and draft planning assumptions retain their evidence; these interfaces do not control hardware.</p>
  {current?<>
   <div className="position-chips" role="group" aria-label="Machine positions">{groups.map(group=><button type="button" aria-pressed={current.position===group.position} key={group.position} onClick={()=>setSelected(group.position)}>{group.position}<small>{group.fibers.length} {group.fibers.length===1?'fiber':'fibers'}</small></button>)}</div>
   <section className="position-state" aria-label={'POSITION '+current.position}>
    <header><span>POSITION</span><h4>{current.position}</h4><small>{current.fibers.length} {current.fibers.length===1?'fiber':'fibers'}</small></header>
    <div className="position-fibers">{current.fibers.map(({id:fiberId,label,fiber})=><article className="position-fiber" key={fiberId} aria-label={label+' in '+current.position}>
     <header><span>FIBER</span><h5>{label}</h5>{fiber.fiber_id&&<code>{fiber.fiber_id}</code>}</header>
     <p>{fiber.description}</p><div className="position-evidence-links"><strong>Fiber evidence:</strong> {cited(fiber.evidence_ids)}</div>
     <h6>DIRECTIONS <span>{fiber.directions.length}</span></h6>
     {fiber.directions.length?<ul className="position-directions">{fiber.directions.map(d=><li key={d.direction}><strong>{d.direction}</strong><p>{d.description}</p><div className="position-evidence-links"><strong>Direction evidence:</strong> {cited(d.evidence_ids)}</div></li>)}</ul>:<p className="position-pending">No directions curated for this fiber yet.</p>}
     <button type="button" onClick={()=>download(separateFiber(p.interface,current.position,fiberId),p.interface.name+'-'+current.position+'-'+fiberId)}><Download size={13}/>Export this fiber</button>
    </article>)}</div>
    {current.fibers.length>1&&<button type="button" onClick={()=>download(separateFiber(p.interface,current.position),p.interface.name+'-'+current.position)}><Download size={13}/>Export all fibers in this position</button>}
   </section>
  </>:<div className="position-empty" aria-label="Position structure awaiting manual review">
   <div><span>POSITION</span><strong>No positions curated yet</strong><p>Mechanical positions or operating modes from this model’s manual.</p></div><b aria-hidden="true">→</b>
   <div><span>FIBERS</span><strong>Awaiting position data</strong><p>One or more fibers associated with each position.</p></div><b aria-hidden="true">→</b>
   <div><span>DIRECTIONS</span><strong>Awaiting fiber data</strong><p>Allowed actions and evidence for each fiber.</p></div>
  </div>}
  <div className="position-downloads"><button type="button" onClick={()=>download(p.interface,p.interface.name)}><Download size={13}/>{current?'Export Position List':'Download blank Position List'}</button>{evidence.length>0&&<button type="button" onClick={()=>download({interface:p.interface,evidence:library.evidence.filter(e=>e.entries.some(x=>evidenceIds.has(x.id)))},p.interface.name+'-with-evidence')}><Download size={13}/>Export with evidence</button>}</div>
  {evidence.length>0&&<details className="position-evidence-register"><summary>Evidence register ({evidence.length})</summary>{evidence.map(e=><article id={idPrefix+'-'+e.id} key={e.id}><strong>{e.id} · {e.classification.replaceAll('_',' ')}</strong><p>{e.claim}</p>{safeUrl(e.source.url||'')?<a href={safeUrl(e.source.url||'')} target="_blank" rel="noopener noreferrer">{e.source.title} · {e.source.section}</a>:<span>{e.source.title} · {e.source.section} · draft assumption</span>}<small> · Checked {e.source.accessed}</small></article>)}</details>}
 </details>;
}
