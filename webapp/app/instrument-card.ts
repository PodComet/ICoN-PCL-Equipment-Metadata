import type {CatalogRow,Equipment} from './catalog-lib.ts';

/** Embedded controls keep their actions; the remaining card surface opens details. */
export function cardBackground(target:EventTarget|null){
 return target instanceof Element&&!target.closest('button,a,input,select,textarea,label,summary,details,[data-card-control]');
}

const identity=(s:string)=>(s||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function instrumentDetails(rows:CatalogRow[],id:string,snapshot?:Equipment){
 const current=rows.find(row=>row.record.equipment_id===id);
 const exact=current&&(!snapshot||identity(current.record.model_name)===identity(snapshot.model_name)&&identity(current.record.manufacturer)===identity(snapshot.manufacturer));
 if(exact){
  const family=current.record.product_family_id;
  return {rows:family?rows.filter(row=>row.record.product_family_id===family):[current],id,snapshot:false};
 }
 if(snapshot)return {rows:[{record:structuredClone(snapshot),revision:0}],id:snapshot.equipment_id,snapshot:true};
 return null;
}
