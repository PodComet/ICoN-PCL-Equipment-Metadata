"""Validate the CSV catalog and regenerate its human-readable research views."""
import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent


def load_csv(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def inspect_catalog(root=ROOT):
    folder = Path(root) / "catalog"
    equipment = load_csv(folder / "equipment.csv")
    categories = load_csv(folder / "categories.csv")
    requests = load_csv(folder / "requested_equipment.csv")
    routes = load_csv(folder / "routes.csv")
    steps = load_csv(folder / "route_steps.csv")
    source_models = load_csv(folder / "source_models.csv")
    ids = [r["equipment_id"] for r in equipment]
    assert len(ids) == len(set(ids)), "Duplicate equipment identifiers"
    category_ids = {r["category_id"] for r in categories}
    assert len(category_ids) == 59 and {"M52", "M55"}.isdisjoint(category_ids)
    core = [r for r in equipment if r["catalog_scope"] == "core_example"]
    coverage = Counter(r["category_id"] for r in core)
    assert set(coverage) == category_ids
    assert all(coverage[c] == 10 for c in category_ids), "Expected ten core examples per active M category"
    assert len(requests) == 44 and len(source_models) == 64 and len(steps) == 109
    assert len(routes) == 20
    for row in equipment:
        assert row["model_name"] and row["product_family_id"] and row["variant_label"]
        assert row["highlight_requested"] in {"true", "false"}
        if row["manual_match_status"] == "verified_operating_manual":
            assert row["manual_url"] and row["manual_scope"], row["equipment_id"]
        for field, value in row.items():
            assert "file:///" not in value and "C:\\" not in value, "Local source paths must not be published"
            if field.endswith("_url") and value:
                assert urlparse(value).scheme in {"http", "https"}, field
        if row["msrp_value"]:
            assert float(row["msrp_value"]) >= 0
            assert row["msrp_currency"] and row["price_source_url"] and row["price_checked_date"]
    for request in requests:
        assert request["equipment_id"] in ids
        record = next(r for r in equipment if r["equipment_id"] == request["equipment_id"])
        assert record["highlight_requested"] == "true"
        assert request["requested_id"] in record["requested_ids"].split(";")
    for route in routes:
        assert set(route["equipment_category_ids"].split(";")).issubset(category_ids)
    for step in steps:
        assert step["equipment_sequence"]
        assert set(filter(None, step["equipment_category_ids"].split(";"))).issubset(category_ids)
    for cid in category_ids:
        names = [r["model_name"].casefold() for r in core if r["category_id"] == cid]
        assert len(names) == len(set(names)), cid
    return {
        "active_m_categories": len(categories), "core_examples": len(core),
        "equipment_records": len(equipment), "requested_occurrences": len(requests),
        "highlighted_equipment_records": sum(r["highlight_requested"] == "true" for r in equipment),
        "source_pdf_model_records": len(source_models), "material_families": 9,
        "additional_process_routes": 11, "ordered_route_steps": len(steps),
        "manual_coverage": dict(sorted(Counter(r["manual_match_status"] for r in equipment).items())),
        "model_evidence": dict(sorted(Counter(r["model_evidence_status"] for r in equipment).items())),
        "msrp_records": sum(bool(r["msrp_value"]) for r in equipment),
    }


def md(value):
    return value.replace("|", "\\|").replace("\n", " ")


def render_views(root=ROOT):
    root = Path(root)
    summary = inspect_catalog(root)
    equipment = load_csv(root / "catalog/equipment.csv")
    requests = load_csv(root / "catalog/requested_equipment.csv")
    by_id = {r["equipment_id"]: r for r in equipment}
    lines = ["# Requested equipment", "",
             "Bold entries reproduce the equipment requested for inclusion. CSV carries this as `highlight_requested=true`.",
             "Repeated requests and unspecified models remain explicit. None of these records establishes ownership or site availability.", "",
             "| Requested equipment | Catalog record | Related process types | Manual status |",
             "| --- | --- | --- | --- |"]
    for item in requests:
        record = by_id[item["equipment_id"]]
        title = "**" + md(item["requested_label"]) + "**"
        manual = md(record["manual_match_status"].replace("_", " "))
        if record["manual_url"]:
            manual += f" ([document]({record['manual_url']}))"
        lines.append(f"| {title} | {record['equipment_id']} | {md(record['related_process_types'])} | {manual} |")
    lines.extend(["", "Renishaw AM400 occurs twice in the request; both occurrences point to one equipment-model record.",
                  "LabRAM II is classified as resonant acoustic mixing; its requested wording is preserved above.", ""])
    docs = root / "docs"
    docs.mkdir(exist_ok=True)
    (docs / "requested-equipment.md").write_text("\n".join(lines), encoding="utf-8")
    (root / "catalog/coverage.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate without rewriting views")
    args = parser.parse_args()
    print(json.dumps(inspect_catalog() if args.check else render_views(), indent=2))
