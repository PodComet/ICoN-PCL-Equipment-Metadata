import {safeUrl,type Equipment} from './catalog-lib.ts';

export const LIFECYCLE_FIELDS=['lifecycle_status','successor_model_name','successor_product_url','successor_evidence_url','successor_scope','successor_checked_date','successor_relationship'];
export type ModelLifecycle=Record<string,string>&{equipment_id:string;model_name:string;manufacturer:string;lifecycle_status:string};
const identity=(value:string|undefined)=>(value||'').trim().toLowerCase();

/** Reviewed version evidence belongs to one model identity, never all its variants. */
export function applyModelLifecycle(record:Equipment,reviews:ModelLifecycle[]):Equipment{
 const result={...record};for(const field of LIFECYCLE_FIELDS)result[field]='';
 const review=reviews.find(item=>item.equipment_id===record.equipment_id&&identity(item.model_name)===identity(record.model_name)&&identity(item.manufacturer)===identity(record.manufacturer));
 if(review)for(const field of LIFECYCLE_FIELDS)result[field]=review[field]||'';
 return result;
}

export function newerModel(record:Equipment){
 if(record.lifecycle_status!=='newer_model_confirmed'||!['direct_successor','newer_generation'].includes(record.successor_relationship))return null;
 const url=safeUrl(record.successor_product_url),evidence=safeUrl(record.successor_evidence_url);
 const date=record.successor_checked_date||'';
 if(!record.successor_model_name||identity(record.successor_model_name)===identity(record.model_name)||!url||!evidence||!record.successor_scope||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return null;
 return {name:record.successor_model_name,url,evidence,scope:record.successor_scope,date:record.successor_checked_date,relationship:record.successor_relationship};
}
