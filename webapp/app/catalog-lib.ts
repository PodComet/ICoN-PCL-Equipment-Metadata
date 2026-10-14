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
export function matches(row: CatalogRow, query: string, category: string, material: string, process: string, manualOnly: boolean, requestedOnly: boolean) {
  const r = row.record;
  return (!category || r.category_id === category) &&
    (!material || r.related_material_ids?.split(";").includes(material)) &&
    (!process || r.related_process_ids?.split(";").includes(process)) &&
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
