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
