"""Regenerate the app seed from canonical catalog CSVs without network access."""
from pathlib import Path
import csv
import json

ROOT = Path(__file__).resolve().parents[1]

def read_csv(name):
    with (ROOT / "catalog" / (name + ".csv")).open(encoding="utf-8-sig", newline="") as source:
        return list(csv.DictReader(source))

def main():
    data = {key: read_csv(name) for key, name in [
        ("records", "equipment"), ("categories", "categories"),
        ("routes", "routes"), ("steps", "route_steps")
    ]}
    data["manufacturers"] = read_csv("manufacturers")
    brands = {r["manufacturer"]: r for r in data["manufacturers"]}
    class_prices = {r["category_id"]: r for r in read_csv("category_price_estimates")}
    overrides = {r["equipment_id"]: r for r in read_csv("equipment_price_overrides")}
    for record in data["records"]:
        brand = brands[record["manufacturer"]]
        for field in ["official_website_url", "brand_identity_status", "research_use_status", "research_evidence_url", "verification_notes", "review_date", "verification_basis"]:
            record["manufacturer_" + field] = brand[field]
        estimate = class_prices.get(record["category_id"], {})
        record.update({k: v for k, v in estimate.items() if k.startswith("estimate")})
        record["estimate_subject"] = record["category_name"]
        record.update({k: v for k, v in overrides.get(record["equipment_id"], {}).items() if k != "equipment_id"})
    data["coverage"] = json.loads((ROOT / "catalog/coverage.json").read_text(encoding="utf-8"))
    output = ROOT / "webapp/app/data/catalog.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Generated {len(data['records'])} equipment records")

if __name__ == "__main__":
    main()
