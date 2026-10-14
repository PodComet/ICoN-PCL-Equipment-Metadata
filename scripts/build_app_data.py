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
    data["coverage"] = json.loads((ROOT / "catalog/coverage.json").read_text(encoding="utf-8"))
    output = ROOT / "webapp/app/data/catalog.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Generated {len(data['records'])} equipment records")

if __name__ == "__main__":
    main()
