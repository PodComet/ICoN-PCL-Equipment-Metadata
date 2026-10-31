import type {Equipment} from './catalog-lib.ts';

export const EQUIPMENT_IO_FIELDS = ['inputs_and_states','outputs_and_states','units_of_measure'] as const;
export type EquipmentIORecord = Record<string,string>;
export type EquipmentIOLibrary = {records:EquipmentIORecord[]};
const identity=(value:string|undefined)=>(value||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9+]/g,'');

/** Display citations as reachable web links; retain full provenance in the dataset. */
export function equipmentIOText(value:string|undefined):string {
 return (value||'').split(/\r?\n/).map(line=>/^\s*sources?\s*:/i.test(line)?(line.match(/https?:\/\/[^\s<>"']+/gi)||[]).join('\n'):line).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

export function equipmentIOFragments(value:string):{text:string;url?:string}[]{
 const parts:{text:string;url?:string}[]=[];
 let end=0;
 for(const match of value.matchAll(/https?:\/\/[^\s<>"']+/gi)){
  if(match.index!>end)parts.push({text:value.slice(end,match.index)});
  let url=match[0].replace(/[.,;:!?]+$/,'');
  // Sentence parentheses/brackets are not part of a URL; balanced path brackets are.
  for(const [open,close] of [['(',')'],['[',']']])while(url.endsWith(close)&&url.split(close).length>url.split(open).length)url=url.slice(0,-1);
  parts.push({text:url,url});
  const punctuation=match[0].slice(url.length);if(punctuation)parts.push({text:punctuation});
  end=match.index!+match[0].length;
 }
 if(end<value.length)parts.push({text:value.slice(end)});
 return parts;
}

/** Spreadsheet facts belong to one exact model, independent of family membership. */
export function applyEquipmentIO(record:Equipment,library:EquipmentIOLibrary):Equipment {
 const result={...record};
 for(const field of Object.keys(result))if(EQUIPMENT_IO_FIELDS.includes(field as typeof EQUIPMENT_IO_FIELDS[number])||field.startsWith('equipment_io_'))delete result[field];
 const source=library.records.find(r=>r.equipment_id===record.equipment_id&&identity(r.manufacturer)===identity(record.manufacturer)&&identity(r.model_name)===identity(record.model_name));
 if(!source)return result;
 for(const [field,value] of Object.entries(source))if(EQUIPMENT_IO_FIELDS.includes(field as typeof EQUIPMENT_IO_FIELDS[number])||field.startsWith('equipment_io_'))result[field]=value;
 return result;
}
