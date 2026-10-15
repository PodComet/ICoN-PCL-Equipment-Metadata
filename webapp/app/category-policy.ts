import type {Equipment} from './catalog-lib.ts';

export type CategoryAlias={legacy_category_id:string;canonical_category_ids:string;[key:string]:string};
const tokens=(value:string|undefined)=>(value||'').split(';').filter(Boolean);
const joined=(...values:(string|undefined)[])=>[...new Set(values.flatMap(tokens))].join(';');

export function resolveCategoryId(id:string,aliases:CategoryAlias[],existingCategory=''){
 const alias=aliases.find(a=>a.legacy_category_id===id);
 if(!alias)return id;
 const choices=tokens(alias.canonical_category_ids);
 return choices.length===1?choices[0]:choices.includes(existingCategory)?existingCategory:'';
}

/** Apply approved classification changes after stored shared or personal overlays. */
export function canonicalizeEquipment(record:Equipment,canonical:Map<string,Equipment>,categories:Record<string,string>[],aliases:CategoryAlias[]):Equipment{
 const base=canonical.get(record.equipment_id),old=record.category_id;
 const categoryId=resolveCategoryId(old,aliases,base?.category_id)||old;
 const targets=new Set(aliases.flatMap(a=>tokens(a.canonical_category_ids)));
 if(!targets.has(categoryId))return record;
 const result:Equipment={...record,category_id:categoryId,category_name:categories.find(c=>c.category_id===categoryId)?.category_name||record.category_name};
 result.legacy_category_ids=joined(record.legacy_category_ids,base?.legacy_category_ids,old!==categoryId?old:'');
 result.source_record_id=record.source_record_id||base?.source_record_id||'';
 result.equipment_subtype=record.equipment_subtype||base?.equipment_subtype||(old==='X-ETCH'?'Wet chemical etching':old==='X-LASER'?'CO2 laser source':'');
 if(base?.legacy_category_ids)for(const [field,value] of Object.entries(base))if(field.startsWith('estimate'))result[field]=value;
 // Historical stored payloads must retain the newly introduced etching method tags.
 const processIds=tokens(base?.related_process_ids).filter(id=>['P13','P14'].includes(id));
 if(old==='X-ETCH'&&!processIds.includes('P13'))processIds.push('P13');
 for(const id of processIds){
  result.related_process_ids=joined(result.related_process_ids,id);
  result.related_process_types=joined(result.related_process_types,id==='P13'?'Wet chemical etching':'Dry plasma etching');
 }
 // Change the old compound label without overwriting a subsequently customized name.
 if(record.equipment_id==='REQ-EQ-022'&&base){
  for(const field of ['model_name','product_family','variant_label'])
   if(record[field]==='Automatic filtration (custom built) and centrifuges')result[field]=base[field];
  if(old==='X-FILTER'||record.related_process_types==='Filtration;Centrifugation;Washing;Recovery')result.related_process_types=base.related_process_types;
 }
 return result;
}
