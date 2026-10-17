"""Regenerate the app seed from canonical catalog CSVs without network access."""
from pathlib import Path
import csv
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from reference_tools import build as build_references
from catalog_tools import validate_model_lifecycle, validate_product_families

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
    class_prices = {r["category_id"]: r for r in read_csv("category_price_estimates")}
    overrides = {r["equipment_id"]: r for r in read_csv("equipment_price_overrides")}
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
        estimate = class_prices.get(record["category_id"], {})
        record.update({k: v for k, v in estimate.items() if k.startswith("estimate")})
        record["estimate_subject"] = record.get("equipment_subtype") or record["category_name"]
        record.update({k: v for k, v in overrides.get(record["equipment_id"], {}).items() if k != "equipment_id"})
    data["coverage"] = json.loads((ROOT / "catalog/coverage.json").read_text(encoding="utf-8"))
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
