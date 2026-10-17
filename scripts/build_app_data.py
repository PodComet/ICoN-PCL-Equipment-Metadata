"""Regenerate the app seed from canonical catalog CSVs without network access."""
from pathlib import Path
import csv
import json
import sys
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from reference_tools import build as build_references
from catalog_tools import validate_model_lifecycle, validate_product_families
from price_policy import with_msrp_estimates

def read_csv(name):
    with (ROOT / "catalog" / (name + ".csv")).open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))

def main():
    build_references(ROOT)
    data = {key: read_csv(name) for key, name in [
        ("records", "equipment"), ("categories", "categories"),
        ("routes", "routes"), ("steps", "route_steps")
    ]}
    data["manufacturers"] = read_csv("manufacturers")
    data["category_aliases"] = read_csv("category_aliases")
    data["model_lifecycle"] = read_csv("model_lifecycle")
    validate_model_lifecycle(data["records"], data["model_lifecycle"])
    data['product_families'] = read_csv('product_families')
    validate_product_families(data['records'], data['product_families'])
    families_by_id = {r['equipment_id']: r for r in data['product_families']}
    lifecycle_fields = [key for key in data["model_lifecycle"][0] if key.startswith(("lifecycle_", "successor_"))]
    lifecycle_by_id = {r["equipment_id"]: r for r in data["model_lifecycle"]}
    brands = {r["manufacturer"]: r for r in data["manufacturers"]}
    for record in data["records"]:
        membership = families_by_id.get(record['equipment_id'], {})
        for key in ['product_family_id', 'product_family', 'variant_label']:
            if membership:
                record[key] = membership[key]
        record['model_variant_id'] = membership.get('model_variant_id', record['equipment_id'])
        record['variant_sort_order'] = membership.get('variant_sort_order', '')
        review = lifecycle_by_id.get(record["equipment_id"], {})
        record.update({key: review.get(key, "") for key in lifecycle_fields})
        brand = brands[record["manufacturer"]]
        for field, value in brand.items():
            if field != "manufacturer":
                record["manufacturer_" + field] = value
    data["coverage"] = json.loads((ROOT / "catalog/coverage.json").read_text(encoding="utf-8"))
    data['msrp_policy'] = json.loads((ROOT / 'webapp/app/data/msrp-policy.json').read_text(encoding='utf-8'))
    data['records'] = with_msrp_estimates(data['records'], data['model_lifecycle'], data['msrp_policy'])
    estimate_fields = ['equipment_id', 'model_name', 'manufacturer', 'category_id', 'estimated_msrp_low', 'estimated_msrp_high', 'estimate_currency', 'estimate_subject', 'estimate_method', 'estimate_status', 'estimate_basis', 'estimate_confidence', 'estimate_benchmark_ids', 'estimate_source_urls', 'estimate_checked_date']
    with (ROOT / 'catalog/equipment_msrp_estimates.csv').open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=estimate_fields, extrasaction='ignore')
        writer.writeheader(); writer.writerows(data['records'])
    class_fields = ['category_id', 'category_name', 'estimated_msrp_low', 'estimated_msrp_high', 'estimate_currency', 'estimate_basis', 'estimate_confidence', 'estimate_source_urls', 'estimate_checked_date']
    class_rows = []
    for cid in sorted({r['category_id'] for r in data['records']}):
        peers = [r for r in data['records'] if r['category_id'] == cid and r['estimate_method'] != 'older_model_plus_20']
        row = next((r for r in peers if r['estimate_method'] == 'category_120_80' and r['estimate_currency'] == 'USD'), next((r for r in peers if r['estimate_status'] != 'explicit_msrp'), peers[0] if peers else {}))
        class_rows.append({key: row.get(key, '') for key in class_fields})
    with (ROOT / 'catalog/category_price_estimates.csv').open('w', encoding='utf-8', newline='') as handle:
        writer=csv.DictWriter(handle,fieldnames=class_fields);writer.writeheader();writer.writerows(class_rows)
    report={'policy':data['msrp_policy'], 'status_counts':dict(Counter(r['estimate_status'] for r in data['records'])), 'method_counts':dict(Counter(r['estimate_method'] for r in data['records'])), 'records':[{key:r[key] for key in estimate_fields} for r in data['records']]}
    (ROOT / 'catalog/msrp_rule_review_2026-10-16.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    output = ROOT / "webapp/app/data/catalog.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    positions = json.loads((ROOT / "catalog/position_interfaces.json").read_text(encoding="utf-8"))
    (ROOT / "webapp/app/data/positions.json").write_text(json.dumps(positions, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    profiles = read_csv('process_material_profiles')
    examples = read_csv('process_material_examples')
    for row in profiles:
        row['suggestions'] = json.loads(row.pop('suggestions_json'))
    for row in examples:
        row['inputs'] = json.loads(row.pop('inputs_json'))
    (ROOT / 'webapp/app/data/process-materials.json').write_text(json.dumps({'profiles': profiles, 'examples': examples}, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f"Generated {len(data['records'])} equipment records")

if __name__ == "__main__":
    main()
