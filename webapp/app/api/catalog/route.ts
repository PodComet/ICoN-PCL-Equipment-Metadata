import { env } from "cloudflare:workers";
import seed from "../../data/catalog.json";
import inventory from "../../data/purdue-inventory.json";
import {attachInventory} from "../../inventory-lib";
import { getChatGPTUser } from "../../chatgpt-auth";
import { safeUrl, MANUFACTURER_PRICE_FIELDS, validateManufacturerPrice, type Equipment } from "../../catalog-lib";

import {audited,loadSharedCatalog,personalRecord} from "../../catalog-store";
import {isCatalogAdmin} from "../../admin-policy";
const EDITABLE = new Set(["equipment_subtype","model_name", "manufacturer", "product_family", "variant_label", "capacity_ml", "manual_url", "manual_scope", "product_page_url", "technical_spec_url", "brochure_url", "image_url", "image_source_url", "image_scope", "msrp_value", "msrp_currency", "price_source_url", "price_checked_date", "related_material_ids", "related_material_types", "related_process_ids", "related_process_types", "notes", ...MANUFACTURER_PRICE_FIELDS]);
function json(body: unknown, status=200) {return Response.json(body, {status, headers:{"Cache-Control":"no-store"}});}
function db() {if (!env.DB) throw new Error("Catalog storage is unavailable"); return env.DB;}

export async function GET() {
  try {
    const user = await getChatGPTUser();
    const shared=await loadSharedCatalog();
    const byId=new Map(shared.records.map(r=>[r.equipment_id,r]));
    const rows = shared.records.map(record => ({record, revision:0, updated_at:""}));
    if (user) {
      const edits = await db().prepare("SELECT equipment_id,payload,revision,updated_at FROM equipment_edits WHERE user_id=?").bind(user.userId).all<{equipment_id:string;payload:string;revision:number;updated_at:string}>();
      const indexes = new Map(rows.map((r,i) => [r.record.equipment_id,i]));
      for (const edit of edits.results) {
        const row = {record:personalRecord(byId.get(edit.equipment_id),JSON.parse(edit.payload)),revision:edit.revision,updated_at:edit.updated_at};
        const index = indexes.get(edit.equipment_id);
        if (index !== undefined) rows[index] = row; else rows.push(row);
      }
    }
    const assets=user?inventory:[];
    return json({rows:attachInventory(rows,assets),assets,categories:seed.categories,routes:seed.routes,steps:seed.steps,coverage:seed.coverage,manufacturers:seed.manufacturers,canEdit:!!user,canAdmin:isCatalogAdmin(user),sharedRevision:shared.revision});
  } catch (error) {
    console.error("Catalog read failed", error);
    return json({error:"Saved catalog could not be loaded. Please retry."},500);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return json({error:"Sign in to edit your catalog."},401);
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) return json({error:"Same-origin requests required."},403);
    if (Number(request.headers.get("content-length") || 0) > 65536) return json({error:"Record is too large."},413);
    const text = await request.text();
    if (text.length>65536) return json({error:"Record is too large."},413);
    let input: any;
    try {input=JSON.parse(text);} catch {return json({error:"Invalid record data."},400);}
    if (!input || typeof input !== "object" || !input.fields || typeof input.fields !== "object" || Array.isArray(input.fields)) return json({error:"Invalid record fields."},400);
    if (!Number.isSafeInteger(input.expected_revision) || input.expected_revision<0) return json({error:"Invalid revision."},400);
    const creating = input.create_variant === true;
    const target = creating ? input.template_id : input.equipment_id;
    if (typeof target !== "string" || target.length>150) return json({error:"Select a catalog record."},400);
    const shared=await loadSharedCatalog();
    const byId=new Map(shared.records.map(r=>[r.equipment_id,r]));
    const saved = await db().prepare("SELECT payload,revision FROM equipment_edits WHERE user_id=? AND equipment_id=?").bind(user.userId,target).first<{payload:string;revision:number}>();
    const original = saved ? personalRecord(byId.get(target),JSON.parse(saved.payload)) : byId.get(target);
    if (!original) return json({error:"Equipment record was not found."},404);
    if (creating && input.expected_revision!==0) return json({error:"New variants start at revision zero."},400);
    const fields:Record<string,string>={};
    for (const [k,v] of Object.entries(input.fields)) {
      if (!EDITABLE.has(k)) return json({error:`Field ${k} cannot be edited.`},400);
      if (typeof v !== "string" || v.length>6000) return json({error:`Invalid ${k}.`},400);
      fields[k]=v.trim();
    }
    const record:Equipment = audited({...original,...fields});
    if (!record.model_name || !record.variant_label || !record.product_family) return json({error:"Model name, product family and variant label are required."},400);
    for (const field of ["manual_url","product_page_url","technical_spec_url","brochure_url","image_url","image_source_url","price_source_url"]) {
      if (record[field] && !safeUrl(record[field])) return json({error:`${field} must be an http or https URL.`},400);
    }
    if (record.capacity_ml && (!Number.isFinite(Number(record.capacity_ml)) || Number(record.capacity_ml)<=0)) return json({error:"Capacity must be a positive number of mL."},400);
    if (record.msrp_value) {
      if (!Number.isFinite(Number(record.msrp_value)) || Number(record.msrp_value)<0 || !/^[A-Z]{3}$/.test(record.msrp_currency) || !record.price_source_url || !/^\d{4}-\d{2}-\d{2}$/.test(record.price_checked_date)) return json({error:"MSRP requires a nonnegative amount, three-letter currency, source URL and date."},400);
      record.price_status="user_entered_msrp";
    } else {record.price_status="not_researched";record.msrp_currency="";record.price_source_url="";record.price_checked_date="";}
    if(record.product_page_url!==original.product_page_url||creating)record.product_page_scope='';
    if(!record.manufacturer_price_value)for(const k of MANUFACTURER_PRICE_FIELDS)record[k]='';
    const publishedPriceError=validateManufacturerPrice(record);if(publishedPriceError)return json({error:publishedPriceError},400);
    const validMaterials=new Set(seed.routes.filter(r=>r.route_kind==="material_family").map(r=>r.route_id));
    const validProcesses=new Set(seed.routes.filter(r=>r.route_kind==="manufacturing_process").map(r=>r.route_id));
    if (record.related_material_ids.split(";").filter(Boolean).some(id=>!validMaterials.has(id)) || record.related_process_ids.split(";").filter(Boolean).some(id=>!validProcesses.has(id))) return json({error:"Select valid material and process IDs."},400);
    if (creating) {
      for(const k of MANUFACTURER_PRICE_FIELDS)record[k]=fields[k]||'';
      record.equipment_id="USER-"+crypto.randomUUID();
      record.product_page_url=fields.product_page_url||"";record.image_url=fields.image_url||"";record.image_source_url=fields.image_source_url||"";record.image_scope=fields.image_scope||"";record.technical_spec_url=fields.technical_spec_url||"";record.brochure_url=fields.brochure_url||"";
      record.source_record_id="";record.legacy_category_ids="";
      record.catalog_scope="user_variant";record.record_kind="user_variant";
      record.source_pdf="";record.source_page="";record.source_sha256="";
      record.model_status="user_entered";record.model_evidence_status="candidate_needs_review";record.model_evidence_url="";
      record.highlight_requested="false";record.requested_ids="";record.purdue_list="false";
      record.institution_label="";record.institution_basis="";record.institution_logo_url="";
    }
    if (creating || record.manual_url!==original.manual_url || record.manual_scope!==original.manual_scope) {
      record.manual_status=record.manual_url?"user_entered_unverified":"not_found";
      record.manual_match_status="not_verified";
    }
    const sharedBase=byId.get(record.equipment_id);
    if(sharedBase)record._personal_fields=JSON.stringify([...EDITABLE].filter(k=>record[k]!==sharedBase[k]));
    const now=new Date().toISOString();
    const revision=input.expected_revision+1;
    const result=await db().prepare("INSERT INTO equipment_edits (user_id,equipment_id,payload,revision,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id,equipment_id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision,updated_at=excluded.updated_at WHERE equipment_edits.revision=? RETURNING revision").bind(user.userId,record.equipment_id,JSON.stringify(record),revision,now,input.expected_revision).first<{revision:number}>();
    if (!result) return json({error:"This record changed in another window. Reload before saving."},409);
    return json({record,revision:result.revision,updated_at:now});
  } catch (error) {
    console.error("Catalog save failed",error);
    return json({error:"The change could not be saved. Your form is still open."},500);
  }
}
