import {env} from "cloudflare:workers";
import seed from "./data/catalog.json";
import {applyManufacturerAudit,type Equipment} from "./catalog-lib";
import {UPDATE_FIELDS} from "./csv-updates";
import {canonicalizeEquipment} from "./category-policy";

export const seedById=new Map((seed.records as Equipment[]).map(r=>[r.equipment_id,r]));
export const audited=(r:Equipment)=>applyManufacturerAudit(canonicalizeEquipment(r,seedById,seed.categories,seed.category_aliases),seed.manufacturers);
export async function loadSharedCatalog(){
 const results=await env.DB!.batch([
  env.DB!.prepare("SELECT revision FROM catalog_meta WHERE id='shared'"),
  env.DB!.prepare("SELECT equipment_id,payload,revision,updated_at FROM catalog_shared")
 ]);
 const records=new Map((seed.records as Equipment[]).map(r=>[r.equipment_id,audited(r)]));
 for(const row of results[1].results as {equipment_id:string;payload:string}[])records.set(row.equipment_id,audited(JSON.parse(row.payload)));
 return {revision:Number((results[0].results[0] as {revision?:number}|undefined)?.revision||0),records:[...records.values()]};
}
export function personalRecord(base:Equipment|undefined,saved:Equipment):Equipment {
 if(!base)return audited(saved);
 const original=seedById.get(base.equipment_id)||base;
 const fields=saved._personal_fields?JSON.parse(saved._personal_fields) as string[]:UPDATE_FIELDS.filter(k=>saved[k]!==undefined&&saved[k]!==original[k]);
 const record={...base};for(const key of fields)if(UPDATE_FIELDS.includes(key))record[key]=saved[key];
 if(fields.some(k=>["msrp_value","msrp_currency","price_source_url","price_checked_date"].includes(k)))record.price_status=record.msrp_value?"user_entered_msrp":"not_researched";
 // Manual verification never survives a personal change to its URL/scope.
 if(fields.some(k=>k.startsWith('manufacturer_price_'))&&!record.manufacturer_price_value)for(const k of UPDATE_FIELDS.filter(k=>k.startsWith('manufacturer_price_')))record[k]='';
 if(fields.includes('product_page_url'))record.product_page_scope='';
 if(fields.includes('manual_url')||fields.includes('manual_scope')){record.manual_match_status='not_verified';record.manual_status=record.manual_url?'user_entered_unverified':'not_found'}
 return audited(record);
}
