import type {Equipment} from './catalog-lib.ts';

export const EQUIPMENT_IO_FIELDS = ['inputs_and_states','outputs_and_states','units_of_measure'] as const;
export type EquipmentIORecord = Record<string,string>;
export type EquipmentIOLibrary = {records:EquipmentIORecord[]};
const identity=(value:string|undefined)=>(value||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9+]/g,'');

/** Spreadsheet facts belong to one exact model, independent of family membership. */
export function applyEquipmentIO(record:Equipment,library:EquipmentIOLibrary):Equipment {
 const result={...record};
 for(const field of Object.keys(result))if(EQUIPMENT_IO_FIELDS.includes(field as typeof EQUIPMENT_IO_FIELDS[number])||field.startsWith('equipment_io_'))delete result[field];
 const source=library.records.find(r=>r.equipment_id===record.equipment_id&&identity(r.manufacturer)===identity(record.manufacturer)&&identity(r.model_name)===identity(record.model_name));
 if(!source)return result;
 for(const [field,value] of Object.entries(source))if(EQUIPMENT_IO_FIELDS.includes(field as typeof EQUIPMENT_IO_FIELDS[number])||field.startsWith('equipment_io_'))result[field]=value;
 return result;
}
