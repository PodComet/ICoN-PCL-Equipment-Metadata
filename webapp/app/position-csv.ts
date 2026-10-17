import {parseCSV} from './csv-updates.ts';
import {csvText,safeUrl,type Equipment} from './catalog-lib.ts';
import {validatePositionInterface,type PositionLibrary,type PositionProfile,type PositionEvidence,type Fiber} from './position-lib.ts';
export const POSITION_COLUMNS=['equipment_id','manufacturer','model_name','interface_name','interface_description','interface_evidence_ids','position','position_description','fiber_id','fiber_label','fiber_description','fiber_evidence_ids','direction','direction_description','direction_evidence_id','direction_source_url','direction_source_title','direction_source_section','effect_summary','effect_evidence_id','effect_source_url','effect_source_title','effect_source_section','accessed'];
export type PositionChange={equipment_id:string;before:PositionProfile|null;after:PositionProfile;evidence:PositionEvidence[]};
export type PositionPlan={changes:PositionChange[];errors:{line:number;message:string}[];rowCount:number};
const key=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function positionCSV(rows:Record<string,string>[]=[]){return csvText(rows.length?rows.map(row=>Object.fromEntries(POSITION_COLUMNS.map(k=>[k,row[k]||'']))):[Object.fromEntries(POSITION_COLUMNS.map(k=>[k,'']))]);}
export function positionExport(library:PositionLibrary){
 const evidence=new Map(library.evidence.flatMap(g=>g.entries.map(e=>[e.id,e] as const)));
 return positionCSV(library.profiles.flatMap(p=>p.interface.fibers.flatMap(f=>{
  const common={equipment_id:p.equipment_id,manufacturer:p.manufacturer,model_name:p.model_name,interface_name:p.interface.name,interface_description:p.interface.description,interface_evidence_ids:p.interface.evidence_ids.join(';'),position:f.position,position_description:f.position_description||'',fiber_id:f.fiber_id||f.position,fiber_label:f.fiber_label||'Fiber 1',fiber_description:f.description,fiber_evidence_ids:f.evidence_ids.join(';')};
  return (f.directions.length?f.directions:[{direction:'',description:'',evidence_ids:[]}]).map(d=>{
   const e=evidence.get(d.evidence_ids[0]),effect='effect_evidence_ids' in d?evidence.get(d.effect_evidence_ids?.[0]||''):undefined;
   return {...common,direction:d.direction,direction_description:d.description,direction_evidence_id:d.evidence_ids.join(';'),direction_source_url:e?.source.url||'',direction_source_title:e?.source.title||'',direction_source_section:e?.source.section||'',effect_summary:'effect_summary' in d?d.effect_summary||'':'',effect_evidence_id:'effect_evidence_ids' in d?(d.effect_evidence_ids||[]).join(';'):'',effect_source_url:effect?.source.url||'',effect_source_title:effect?.source.title||'',effect_source_section:effect?.source.section||'',accessed:e?.source.accessed||effect?.source.accessed||''};
  });
 })));
}
export function buildPositionPlan(text:string,records:Equipment[],library:PositionLibrary):PositionPlan{
 const result:PositionPlan={changes:[],errors:[],rowCount:0};let rows:string[][];
 try{rows=parseCSV(text)}catch(e){return {...result,errors:[{line:1,message:(e as Error).message}]};}
 if(!rows.length)return {...result,errors:[{line:1,message:'The position spreadsheet is empty.'}]};
 const headers=rows.shift()!.map(s=>s.trim());
 if(new Set(headers).size!==headers.length||headers.some(h=>!POSITION_COLUMNS.includes(h))||['equipment_id','manufacturer','model_name','position','fiber_id','fiber_description'].some(h=>!headers.includes(h)))return {...result,errors:[{line:1,message:'Use the position template headers, including exact model identity, position and fiber fields.'}]};
 const byId=new Map(records.map(r=>[r.equipment_id,r])),profiles=new Map<string,PositionProfile>();
 const entries=new Map(library.evidence.flatMap(g=>g.entries.map(e=>[e.id,e] as const)));
 rows.forEach((cells,index)=>{const line=index+2;result.rowCount++;
  try{
   if(cells.length!==headers.length)throw new Error('Column count differs from the template. Quote commas and line breaks.');
   const r=Object.fromEntries(headers.map((h,i)=>[h,cells[i].trim()]));if(Object.values(r).some(v=>v.length>6000))throw new Error('A cell exceeds 6,000 characters.');
   const model=byId.get(r.equipment_id);if(!model||key(model.manufacturer)!==key(r.manufacturer)||key(model.model_name)!==key(r.model_name))throw new Error('Equipment ID, manufacturer and model must match one shared catalog record.');
   if(!r.position||r.position.length>200||!r.fiber_id||r.fiber_id.length>200||!r.fiber_description)throw new Error('Each row needs a position, fiber ID and fiber description.');
   let p=profiles.get(r.equipment_id);if(!p){p={equipment_id:model.equipment_id,manufacturer:model.manufacturer,model_name:model.model_name,status:'uploaded_needs_review',interface:{schema:'poly-fibers/v2',name:r.interface_name||'uploaded_'+model.equipment_id,description:r.interface_description||'Administrator-uploaded model interface. Source and output-effect claims need review for the intended process.',evidence_ids:(r.interface_evidence_ids||'').split(';').map(x=>x.trim()).filter(Boolean),fibers:[]}};profiles.set(r.equipment_id,p);}
   if(r.interface_name&&r.interface_name!==p.interface.name||r.interface_description&&r.interface_description!==p.interface.description||r.interface_evidence_ids&&r.interface_evidence_ids.split(';').map(x=>x.trim()).filter(Boolean).join(';')!==p.interface.evidence_ids.join(';'))throw new Error('Repeat interface metadata consistently for this model.');
   let fiber=p.interface.fibers.find(f=>f.position===r.position&&f.fiber_id===r.fiber_id);
   if(p.interface.fibers.some(f=>f.fiber_id===r.fiber_id&&f.position!==r.position))throw new Error('Use a unique fiber ID within this model, including across positions.');
   if(!fiber){fiber={position:r.position,fiber_id:r.fiber_id,fiber_label:r.fiber_label||r.fiber_id,position_description:r.position_description||'',description:r.fiber_description,evidence_ids:(r.fiber_evidence_ids||'').split(';').map(x=>x.trim()).filter(Boolean),directions:[]};p.interface.fibers.push(fiber);}
   else if(fiber.description!==r.fiber_description||fiber.fiber_label!==(r.fiber_label||r.fiber_id))throw new Error('Rows for the same fiber must have consistent labels and descriptions.');
   const addEvidence=(prefix:'direction'|'effect',claim:string)=>{
    const ids=(r[prefix+'_evidence_id']||'').split(';').map(x=>x.trim()).filter(Boolean),url=r[prefix+'_source_url']||'';if(!ids.length){if(url)throw new Error('A source URL requires its evidence ID.');return [] as string[];}
    return ids.map((id,i)=>{if(id.length>200)throw new Error('Evidence IDs must be at most 200 characters.');
    const old=entries.get(id);if(old){if(i===0&&url&&url!==old.source.url)throw new Error('An evidence ID already names a different source. Use a new ID.');return id;}
    if(!safeUrl(url)||!r[prefix+'_source_title']||!r[prefix+'_source_section']||(!/^\d{4}-\d{2}-\d{2}$/.test(r.accessed||'')||Number.isNaN(Date.parse(r.accessed))||new Date(r.accessed).toISOString().slice(0,10)!==r.accessed))throw new Error('New evidence needs an http(s) source URL, title, section and YYYY-MM-DD access date.');
    entries.set(id,{id,classification:'user_supplied_claim',claim,source:{kind:'uploaded_documentation',title:r[prefix+'_source_title'],section:r[prefix+'_source_section'],url,accessed:r.accessed},verification:{status:'unverified',method:'administrator_csv_upload'}});return id;});
   };
   if(!r.effect_summary&&(r.effect_evidence_id||r.effect_source_url||r.effect_source_title||r.effect_source_section))throw new Error('Effect sources require an effect summary.');
   if(r.direction){if(!r.direction_description)throw new Error('A direction needs a description.');if(fiber.directions.some(d=>d.direction===r.direction))throw new Error('Duplicate direction in this fiber.');const direction={direction:r.direction,description:r.direction_description,evidence_ids:addEvidence('direction',r.direction_description),...(r.effect_summary?{effect_summary:r.effect_summary,effect_evidence_ids:addEvidence('effect',r.effect_summary)}:{})};fiber.directions.push(direction);}
   else if(r.effect_summary||r.direction_description||r.direction_evidence_id)throw new Error('An effect or direction description needs a direction ID.');
  }catch(e){result.errors.push({line,message:(e as Error).message});}
 });
 const evidence:PositionEvidence[]=[{schema:'poly-evidence/v1',namespace:'uploaded',subject:{scope:'Administrator uploaded claims'},entries:[...entries.values()]}];
 for(const p of profiles.values())try{
  validatePositionInterface(p.interface,evidence);
  const ids=new Set([...p.interface.evidence_ids,...p.interface.fibers.flatMap(f=>[...f.evidence_ids,...f.directions.flatMap(d=>[...d.evidence_ids,...(d.effect_evidence_ids||[])])])]);
  result.changes.push({equipment_id:p.equipment_id,before:library.profiles.find(old=>old.equipment_id===p.equipment_id)||null,after:p,evidence:[{...evidence[0],entries:[...entries.values()].filter(e=>ids.has(e.id))}]});
 }catch(e){result.errors.push({line:1,message:p.equipment_id+': '+(e as Error).message});}
 if(profiles.size>100)result.errors.push({line:1,message:'Use at most 100 model profiles per import.'});
 if(!result.rowCount)result.errors.push({line:1,message:'Fill the template with at least one position and fiber.'});
 if(JSON.stringify(result.changes).length>1_500_000)result.errors.push({line:1,message:'Changed profile payload exceeds 1.5 MB.'});
 return result;
}
