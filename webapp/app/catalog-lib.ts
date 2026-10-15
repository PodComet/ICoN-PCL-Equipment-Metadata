export type Equipment = Record<string, string> & {equipment_id: string; model_name: string};
export type CatalogRow = {record: Equipment; revision: number; updated_at?: string};
export type Route = Record<string, string>;
export const VERIFIED = "verified_operating_manual";
export function safeUrl(url: string | undefined) {
  if (!url) return "";
  try { const parsed = new URL(url); return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : ""; }
  catch { return ""; }
}
export function csvText(records: Record<string,string>[]) {
  const fields = [...new Set(records.flatMap(Object.keys))];
  function cell(value: unknown) {
    let text = String(value ?? "");
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }
  return "\ufeff" + [fields, ...records.map(r => fields.map(f => r[f] ?? ""))].map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
export function matches(row: CatalogRow, query: string, category: string|string[], material: string|string[], process: string|string[], manualOnly: boolean, requestedOnly: boolean) {
  const r = row.record;
  const picked=(value:string|string[])=>Array.isArray(value)?value:value?[value]:[];
  return (!picked(category).length || picked(category).includes(r.category_id)) &&
    (!picked(material).length || picked(material).some(id=>r.related_material_ids?.split(";").includes(id))) &&
    (!picked(process).length || picked(process).some(id=>r.related_process_ids?.split(";").includes(id))) &&
    (!manualOnly || r.manual_match_status === VERIFIED) &&
    (!requestedOnly || r.purdue_list === "true") &&
    query.toLowerCase().split(/\s+/).every(word => [r.model_name,r.manufacturer,r.manufacturer_display_name,r.manufacturer_vendor_name,r.manufacturer_vendor_name?.replace(/\s/g,''),r.product_family,r.variant_label,r.category_id,r.category_name,r.legacy_category_ids,r.equipment_subtype,r.source_record_id,r.related_material_types,r.related_process_types,r.capacity_ml,r.notes,r.purdue_instrument_ids,r.purdue_serial_or_other_ids].join(" ").toLowerCase().includes(word));
}
export function groupRows(rows: CatalogRow[]) {
  const groups = new Map<string, CatalogRow[]>();
  for (const row of rows) {
    const id = row.record.product_family_id || row.record.equipment_id;
    groups.set(id, [...(groups.get(id) || []), row]);
  }
  return [...groups.values()];
}
export function photoFirstGroups(rows:CatalogRow[]){
 const groups=groupRows(rows),withPhotos:CatalogRow[][]=[],withoutPhotos:CatalogRow[][]=[];
 for(const group of groups)(group.some(row=>safeUrl(row.record.image_url))?withPhotos:withoutPhotos).push(group);
 return [...withPhotos,...withoutPhotos];
}

export function fallbackDocumentationLink(r:Equipment){
  if (safeUrl(r.technical_spec_url)) return {url: safeUrl(r.technical_spec_url), label: "Technical specifications"};
  if (safeUrl(r.brochure_url)) return {url:safeUrl(r.brochure_url),label:"Brochure"};
  if (safeUrl(r.documentation_url)) return {url: safeUrl(r.documentation_url), label: "Technical document"};
  if (safeUrl(r.product_page_url)) return {url:safeUrl(r.product_page_url),label:"Manufacturer product page"};
  if (safeUrl(r.model_evidence_url)) return {url: safeUrl(r.model_evidence_url), label: "Product details"};
  return null;
}
export function documentationLink(r: Equipment) {
  if(r.manual_match_status===VERIFIED&&safeUrl(r.manual_url))return {url:safeUrl(r.manual_url),label:"Operating manual"};
  const fallback=fallbackDocumentationLink(r);if(fallback)return fallback;
  if(safeUrl(r.manual_url))return {url:safeUrl(r.manual_url),label:"Manual / document"};
  return null;
}
export function allDocumentationLinks(r:Equipment){
 const links=[documentationLink(r),
  {url:safeUrl(r.technical_spec_url),label:'Technical specifications'},
  {url:safeUrl(r.brochure_url),label:'Brochure'},
  safeUrl(r.manual_url)?{url:safeUrl(r.manual_url),label:r.manual_match_status===VERIFIED?'Operating manual':'Linked manual / document (needs review)'}:null];
 const seen=new Set<string>();
 return links.filter((link):link is {url:string;label:string}=>{
  if(!link?.url||seen.has(link.url))return false;
  seen.add(link.url);return true;
 });
}
export function pricePresentation(r: Equipment) {
  const format = (value: string, currency = "USD") => {
    try {return new Intl.NumberFormat("en-US", {style:"currency",currency,maximumFractionDigits:0}).format(Number(value));}
    catch {return currency + " " + value;}
  };
  if (r.msrp_value) return {label:"MSRP",value:format(r.msrp_value,r.msrp_currency),estimated:false};
  const published=manufacturerPrice(r);
  if(published)return {label:published.label,value:published.value,estimated:false};
  return classEstimatePresentation(r);
}
export function classEstimatePresentation(r:Equipment){
  const format=(value:string,currency='USD')=>{try{return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:0}).format(Number(value))}catch{return currency+' '+value}};
  if (r.estimated_msrp_low && r.estimated_msrp_high) return {label:"Estimated MSRP*",value:format(r.estimated_msrp_low,r.estimate_currency)+"–"+format(r.estimated_msrp_high,r.estimate_currency),estimated:true};
  return {label:"MSRP",value:"Not recorded",estimated:false};
}

export const MANUFACTURER_PRICE_FIELDS=['manufacturer_price_value','manufacturer_price_currency','manufacturer_price_kind','manufacturer_price_source_url','manufacturer_price_checked_date','manufacturer_price_scope'];
export function validateManufacturerPrice(r:Equipment){
 if(!r.manufacturer_price_value)return '';
 if(!Number.isFinite(Number(r.manufacturer_price_value))||Number(r.manufacturer_price_value)<0||!/^[A-Z]{3}$/.test(r.manufacturer_price_currency)||!['list_price','sale_price','starting_price','published_price'].includes(r.manufacturer_price_kind)||!safeUrl(r.manufacturer_price_source_url)||!/^\d{4}-\d{2}-\d{2}$/.test(r.manufacturer_price_checked_date)||Number.isNaN(Date.parse(r.manufacturer_price_checked_date))||new Date(r.manufacturer_price_checked_date).toISOString().slice(0,10)!==r.manufacturer_price_checked_date||!r.manufacturer_price_scope)return 'Published manufacturer price needs an amount, currency, price kind, source URL, valid date and configuration scope.';
 return '';
}
export function manufacturerPrice(r:Equipment){
 if(!r.manufacturer_price_value||validateManufacturerPrice(r))return null;
 const labels:Record<string,string>={list_price:'Manufacturer list price',sale_price:'Manufacturer sale price',starting_price:'Manufacturer starting price',published_price:'Published manufacturer price'};
 return {label:labels[r.manufacturer_price_kind],value:new Intl.NumberFormat('en-US',{style:'currency',currency:r.manufacturer_price_currency,maximumFractionDigits:0}).format(Number(r.manufacturer_price_value)),source:safeUrl(r.manufacturer_price_source_url),scope:r.manufacturer_price_scope,date:r.manufacturer_price_checked_date};
}

export function verifiedManufacturer(r: Equipment) {
 return r.manufacturer_company_status !== 'defunct' && ["verified_manufacturer","verified_brand"].includes(r.manufacturer_brand_identity_status) &&
  !!safeUrl(r.manufacturer_official_website_url) &&
  (r.manufacturer_verification_basis==='user_confirmation'||(r.manufacturer_research_use_status === "documented_research_use" && !!safeUrl(r.manufacturer_research_evidence_url)));
}
export const MANUFACTURER_AUDIT_FIELDS=["official_website_url","brand_identity_status","research_use_status","research_evidence_url","verification_notes","review_date","verification_basis","display_name","vendor_name","company_status","company_status_note","company_status_source_url"];
export function manufacturerBadge(r:Equipment){
 if(!verifiedManufacturer(r))return null;
 const vendor=r.manufacturer_vendor_name;
 const name=vendor||r.manufacturer_display_name||r.manufacturer;
 const confirmed=r.manufacturer_verification_basis==='user_confirmation';
 return {
  href:safeUrl(confirmed?r.manufacturer_official_website_url:r.manufacturer_research_evidence_url),
  label:confirmed?`User-confirmed ${vendor?'vendor':'manufacturer'}: ${name}`:`Verified brand and documented research use: ${name}`,
  title:confirmed?`${vendor?'Vendor':'Manufacturer'} verified by project-owner confirmation. Open official website.`:'Official web presence and independent research use checked. Open research evidence.'
 };
}
export function applyManufacturerAudit(r: Equipment, brands: Record<string,string>[]): Equipment {
 const brand=brands.find(b=>b.manufacturer===r.manufacturer);
 const result={...r};
 for(const field of MANUFACTURER_AUDIT_FIELDS)
  result["manufacturer_"+field]=brand?.[field] || (field.endsWith("status")?"needs_review":"");
 return result;
}

export type FilterState={query:string;category:string[];material:string[];process:string[];manufacturer:string[];manualOnly:boolean;requestedOnly:boolean};
export function filterRows(rows:CatalogRow[],f:FilterState,omit?:"category"|"material"|"process"|"manufacturer"){
 return rows.filter(row=>matches(row,f.query,omit==="category"?[]:f.category,omit==="material"?[]:f.material,omit==="process"?[]:f.process,f.manualOnly,f.requestedOnly)&&(omit==="manufacturer"||!f.manufacturer.length||f.manufacturer.includes(row.record.manufacturer)));
}
export function filterCounts(rows:CatalogRow[],f:FilterState,key:"category"|"material"|"process"|"manufacturer"){
 const counts=new Map<string,number>();
 for(const row of filterRows(rows,f,key)){
  const r=row.record,values=key==="category"?[r.category_id]:key==="manufacturer"?[r.manufacturer]:(r[key==="material"?"related_material_ids":"related_process_ids"]||"").split(";").filter(Boolean);
  for(const value of new Set(values))counts.set(value,(counts.get(value)||0)+1);
 }
 return counts;
}

export function rangeSelection(values:string[],options:string[],anchor:string|null,target:string,selected:boolean){
 const start=anchor?options.indexOf(anchor):-1,end=options.indexOf(target);
 const range=start>=0&&end>=0?options.slice(Math.min(start,end),Math.max(start,end)+1):[target];
 const next=new Set(values);for(const value of range)if(selected)next.add(value);else next.delete(value);
 return [...next];
}
