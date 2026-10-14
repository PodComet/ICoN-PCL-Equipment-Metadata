export type Equipment = Record<string, string> & {equipment_id: string; model_name: string};
export type CatalogRow = {record: Equipment; revision: number; updated_at?: string};
export type Route = Record<string, string>;
export const VERIFIED = "verified_operating_manual";
export function safeUrl(url: string | undefined) {
  if (!url) return "";
  try { const parsed = new URL(url); return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : ""; }
  catch { return ""; }
}
export function csvText(records: Equipment[]) {
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
    query.toLowerCase().split(/\s+/).every(word => [r.model_name,r.manufacturer,r.product_family,r.variant_label,r.category_id,r.category_name,r.related_material_types,r.related_process_types,r.capacity_ml,r.notes].join(" ").toLowerCase().includes(word));
}
export function groupRows(rows: CatalogRow[]) {
  const groups = new Map<string, CatalogRow[]>();
  for (const row of rows) {
    const id = row.record.product_family_id || row.record.equipment_id;
    groups.set(id, [...(groups.get(id) || []), row]);
  }
  return [...groups.values()];
}

export function documentationLink(r: Equipment) {
  if (safeUrl(r.manual_url)) return {url: safeUrl(r.manual_url), label: r.manual_match_status === VERIFIED ? "Operating manual" : "Manual / document"};
  if (safeUrl(r.technical_spec_url)) return {url: safeUrl(r.technical_spec_url), label: "Technical specifications"};
  if (safeUrl(r.documentation_url)) return {url: safeUrl(r.documentation_url), label: "Technical document"};
  if (safeUrl(r.model_evidence_url)) return {url: safeUrl(r.model_evidence_url), label: "Product details"};
  return null;
}
export function pricePresentation(r: Equipment) {
  const format = (value: string, currency = "USD") => {
    try {return new Intl.NumberFormat("en-US", {style:"currency",currency,maximumFractionDigits:0}).format(Number(value));}
    catch {return currency + " " + value;}
  };
  if (r.msrp_value) return {label:"MSRP",value:format(r.msrp_value,r.msrp_currency),estimated:false};
  if (r.estimated_msrp_low && r.estimated_msrp_high) return {label:"Estimated MSRP*",value:format(r.estimated_msrp_low,r.estimate_currency)+"–"+format(r.estimated_msrp_high,r.estimate_currency),estimated:true};
  return {label:"MSRP",value:"Not recorded",estimated:false};
}

export function verifiedManufacturer(r: Equipment) {
 return ["verified_manufacturer","verified_brand"].includes(r.manufacturer_brand_identity_status) &&
  r.manufacturer_research_use_status === "documented_research_use" &&
  !!safeUrl(r.manufacturer_official_website_url) && !!safeUrl(r.manufacturer_research_evidence_url);
}
export function applyManufacturerAudit(r: Equipment, brands: Record<string,string>[]): Equipment {
 const brand=brands.find(b=>b.manufacturer===r.manufacturer);
 const result={...r};
 for(const field of ["official_website_url","brand_identity_status","research_use_status","research_evidence_url","verification_notes","review_date"])
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
