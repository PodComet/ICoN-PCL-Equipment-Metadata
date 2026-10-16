import type {Equipment, CatalogRow} from './catalog-lib.ts';
import {newerModel} from './model-lifecycle.ts';

export type ProductFamilyRule = Record<string,string>;
const identity=(value:string|undefined)=>(value||'').trim().toLowerCase();

/** Curated membership is independent of per-model evidence and editable details. */
export function applyProductFamily(record:Equipment,rules:ProductFamilyRule[],protectedFields:string[]=[]):Equipment {
 const rule=rules.find(item=>item.equipment_id===record.equipment_id);
 const result={...record};
 if(!rule)return result;
 if(identity(record.manufacturer)!==identity(rule.manufacturer)||identity(record.model_name)!==identity(rule.model_name)){
  result.model_variant_id=record.equipment_id;result.variant_sort_order='';
  if(identity(record.manufacturer)!==identity(rule.manufacturer))result.product_family_id='PF-'+record.equipment_id;
  return result;
 }
 result.product_family_id=rule.product_family_id;
 result.model_variant_id=rule.model_variant_id;
 result.variant_sort_order=rule.variant_sort_order;
 for(const field of ['product_family','variant_label']){
  if(!protectedFields.includes(field)&&(!record[field]||record[field]===rule['previous_'+field]))result[field]=rule[field];
 }
 return result;
}

/** New profiles get independent chip identity even when copied from an alias. */
export function independentVariant(record:Equipment,parent:Equipment):Equipment {
 const result:Equipment={...record,model_variant_id:record.equipment_id,variant_sort_order:''};
 if(identity(record.manufacturer)!==identity(parent.manufacturer))result.product_family_id='PF-'+record.equipment_id;
 return result;
}

export type ModelVariant={id:string;rows:CatalogRow[]};
export function modelVariants(rows:CatalogRow[]):ModelVariant[]{
 const groups=new Map<string,ModelVariant>();
 for(const row of rows){
  const r=row.record;
  // Only explicit aliases coalesce. Edited identities/configurations cannot hide.
  const id=JSON.stringify([r.model_variant_id||r.equipment_id,identity(r.manufacturer),identity(r.model_name),r.variant_label||'',r.capacity_ml||'']);
  const group=groups.get(id)||{id,rows:[]};group.rows.push(row);groups.set(id,group);
 }
 const order=(v:ModelVariant)=>{const value=v.rows[0].record.variant_sort_order;return value&&Number.isFinite(Number(value))?Number(value):Number.MAX_SAFE_INTEGER};
 return [...groups.values()].sort((a,b)=>order(a)-order(b));
}
export function variantContext(variant:ModelVariant,categoryId:string):CatalogRow {
 return variant.rows.find(row=>row.record.category_id===categoryId)||variant.rows[0];
}

/** Family notices include unselected models without copying their evidence. */
export function variantsWithNewerModels(rows:CatalogRow[]):ModelVariant[]{
 return modelVariants(rows).filter(variant=>variant.rows.some(row=>newerModel(row.record)));
}
