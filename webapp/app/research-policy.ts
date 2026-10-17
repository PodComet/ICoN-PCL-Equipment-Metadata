import type {Equipment} from './catalog-lib.ts';

export type ResearchUpdate={equipment_id:string;model_name?:string;manufacturer?:string;groups:{before:Partial<Record<string,string>>;after:Partial<Record<string,string>>}[]};

function sharedOverrides(record:Equipment):string[]{
 try{const values=JSON.parse(record._shared_fields||'[]');return Array.isArray(values)?values.filter((value):value is string=>typeof value==='string'):[]}catch{return []}
}
export function withSharedResearchOverrides(record:Equipment,fields:string[]):Equipment{
 return {...record,_shared_fields:JSON.stringify([...new Set([...sharedOverrides(record),...fields])])};
}

/** Refresh old seed snapshots while preserving edited fields and evidence groups. */
export function refreshResearchEvidence(record:Equipment,updates:ResearchUpdate[],protectedFields:string[]=[]):Equipment{
 const identity=(value:string)=>(value||'').trim().toLowerCase();
 const update=updates.find(entry=>entry.equipment_id===record.equipment_id&&(!entry.model_name||identity(entry.model_name)===identity(record.model_name))&&(!entry.manufacturer||identity(entry.manufacturer)===identity(record.manufacturer)));
 if(!update)return record;
 const result={...record},protectedSet=new Set([...sharedOverrides(record),...protectedFields]);
 for(const group of update.groups){
  const fields=Object.keys(group.before);
  if(fields.some(key=>protectedSet.has(key)))continue;
  // A custom URL, scope or price keeps its entire evidence group intact.
  if(fields.every(key=>(result[key]||'')===group.before[key]||(result[key]||'')===group.after[key]))
   for(const [key,value] of Object.entries(group.after))if(typeof value==='string')result[key]=value;
 }
 return result;
}
