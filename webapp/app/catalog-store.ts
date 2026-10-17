import {env} from "cloudflare:workers";
import seed from "./data/catalog.json";
import {applyManufacturerAudit,type Equipment} from "./catalog-lib";
import {UPDATE_FIELDS} from "./csv-updates";
import {canonicalizeEquipment} from "./category-policy";
import researchUpdates from "./data/research-updates.json";
import {refreshResearchEvidence} from "./research-policy";
import linkReplacements from "./data/link-replacements.json";
import {repairRetiredLinks} from "./link-policy";
import {applyModelLifecycle} from './model-lifecycle';
import {applyProductFamily} from './product-family-policy';
import {withMsrpEstimates} from './msrp-policy';
import msrpPolicy from './data/msrp-policy.json';

export const seedById=new Map((seed.records as Equipment[]).map(r=>[r.equipment_id,r]));
export const audited=(r:Equipment,protectedFields:string[]=[])=>applyProductFamily(applyModelLifecycle(applyManufacturerAudit(repairRetiredLinks(canonicalizeEquipment(refreshResearchEvidence(r,researchUpdates,protectedFields),seedById,seed.categories,seed.category_aliases),linkReplacements),seed.manufacturers),seed.model_lifecycle),seed.product_families,protectedFields);
export async function loadSharedCatalog(){
 const results=await env.DB!.batch([
  env.DB!.prepare("SELECT revision FROM catalog_meta WHERE id='shared'"),
  env.DB!.prepare("SELECT equipment_id,payload,revision,updated_at FROM catalog_shared")
 ]);
 const records=new Map((seed.records as Equipment[]).map(r=>[r.equipment_id,audited(r)]));
 for(const row of results[1].results as {equipment_id:string;payload:string}[])records.set(row.equipment_id,audited(JSON.parse(row.payload)));
 return {revision:Number((results[0].results[0] as {revision?:number}|undefined)?.revision||0),records:withMsrpEstimates([...records.values()],seed.model_lifecycle,msrpPolicy)};
}
export function personalRecord(base:Equipment|undefined,saved:Equipment):Equipment {
 if(!base)return audited(saved);
 const original=seedById.get(base.equipment_id)||base;
 const explicit=saved._personal_fields?JSON.parse(saved._personal_fields) as string[]:null;
 const refreshed=applyProductFamily(refreshResearchEvidence(saved,researchUpdates,explicit||[]),seed.product_families,explicit||[]);
 const fields=explicit||UPDATE_FIELDS.filter(k=>refreshed[k]!==undefined&&refreshed[k]!==original[k]);
 const record={...base};for(const key of fields)if(UPDATE_FIELDS.includes(key))record[key]=refreshed[key];
 if(fields.some(k=>["msrp_value","msrp_currency","price_source_url","price_checked_date"].includes(k)))record.price_status=record.msrp_value?"user_entered_msrp":"not_researched";
 // Manual verification never survives a personal change to its URL/scope.
 if(fields.some(k=>k.startsWith('manufacturer_price_'))&&!record.manufacturer_price_value)for(const k of UPDATE_FIELDS.filter(k=>k.startsWith('manufacturer_price_')))record[k]='';
 if(fields.includes('product_page_url'))record.product_page_scope='';
 if(fields.includes('manual_url')||fields.includes('manual_scope')){record.manual_match_status='not_verified';record.manual_status=record.manual_url?'user_entered_unverified':'not_found'}
 return audited(record,fields);
}
