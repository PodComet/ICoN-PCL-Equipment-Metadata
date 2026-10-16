"""Validate the CSV catalog and regenerate its human-readable research views."""
import argparse
import csv
import json
from datetime import date
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent


def load_csv(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def validate_model_lifecycle(equipment, reviews):
    """Reject identity mismatches and incomplete evidence before applying any badge."""
    by_id = {r["equipment_id"]: r for r in equipment}
    assert len(reviews) == len({r["equipment_id"] for r in reviews}), "Duplicate model lifecycle review"
    for review in reviews:
        eid = review["equipment_id"]
        assert eid in by_id, "Unknown lifecycle equipment ID: " + eid
        assert all(review[key] == by_id[eid][key] for key in ["model_name", "manufacturer"]), "Lifecycle model identity mismatch: " + eid
        assert review["lifecycle_status"] in {"newer_model_confirmed", "current_alternative", "no_successor_confirmed", "model_unresolved"}
        assert date.fromisoformat(review["successor_checked_date"]).isoformat() == review["successor_checked_date"]
        if review["lifecycle_status"] != "model_unresolved":
            assert review["successor_evidence_url"], "Lifecycle source required: " + eid
        assert review["review_method"] in {"manual_primary_source_relationship_check", "targeted_official_domain_search", "supplied_requirement_identity_check", "literature_methods_identity_check"}
        if review["review_method"] == "targeted_official_domain_search":
            assert review["review_query"] and review["review_source_match"]
        for value in filter(None, review["review_source_urls"].split(";")):
            parsed = urlparse(value)
            assert parsed.scheme in {"http", "https"} and parsed.netloc
        for key in ["successor_product_url", "successor_evidence_url"]:
            value = review[key]
            if value:
                parsed = urlparse(value)
                assert parsed.scheme in {"http", "https"} and parsed.netloc, "Invalid lifecycle URL: " + eid
        if review["lifecycle_status"] == "newer_model_confirmed":
            assert review["successor_relationship"] in {"direct_successor", "newer_generation"}
            assert all(review[key].strip() for key in ["successor_model_name", "successor_product_url", "successor_scope"]), "Incomplete successor: " + eid
            assert review["successor_model_name"].strip().casefold() != review["model_name"].strip().casefold(), "Successor points to itself: " + eid
        else:
            assert not any(review[key] for key in ["successor_model_name", "successor_product_url", "successor_relationship", "successor_scope"]), "Unconfirmed review must not supply a badge: " + eid
            assert review["review_notes"].strip()
    return dict(sorted(Counter(r["lifecycle_status"] for r in reviews).items()))


def validate_product_families(equipment, memberships):
    """Validate presentation membership without merging instrument evidence."""
    by_id = {r['equipment_id']: r for r in equipment}
    assert len(memberships) == len({r['equipment_id'] for r in memberships}), 'Duplicate family membership'
    families, variants = {}, {}
    for member in memberships:
        eid = member['equipment_id']
        assert eid in by_id, 'Unknown family equipment ID: ' + eid
        assert all(member[k] == by_id[eid][k] for k in ['manufacturer', 'model_name']), 'Family identity mismatch: ' + eid
        assert all(member[k].strip() for k in ['product_family_id', 'product_family', 'variant_label', 'model_variant_id', 'grouping_basis'])
        assert member['variant_sort_order'].isdigit() and int(member['variant_sort_order']) > 0
        assert date.fromisoformat(member['review_date']).isoformat() == member['review_date']
        if member['grouping_source_url']:
            parsed = urlparse(member['grouping_source_url'])
            assert parsed.scheme in {'http', 'https'} and parsed.netloc
        families.setdefault(member['product_family_id'], set()).add(member['product_family'])
        variants.setdefault(member['model_variant_id'], []).append(member)
    assert all(len(titles) == 1 for titles in families.values()), 'Inconsistent family title'
    for members in variants.values():
        if len(members) < 2:
            continue
        originals = [by_id[m['equipment_id']] for m in members]
        assert len({r['category_id'] for r in originals}) == len(originals), 'Duplicate chip within category'
        assert all(len({r[k] for r in originals}) == 1 for k in ['manufacturer', 'model_name', 'capacity_ml']), 'Alias conflates different models'
        assert len({m['product_family_id'] for m in members}) == 1
        assert len({m['variant_label'] for m in members}) == 1
    return len(families)


def inspect_catalog(root=ROOT):
    folder = Path(root) / "catalog"
    equipment = load_csv(folder / "equipment.csv")
    categories = load_csv(folder / "categories.csv")
    requests = load_csv(folder / "requested_equipment.csv")
    routes = load_csv(folder / "routes.csv")
    steps = load_csv(folder / "route_steps.csv")
    source_models = load_csv(folder / "source_models.csv")
    manufacturers = load_csv(folder / "manufacturers.csv")
    aliases = load_csv(folder / "category_aliases.csv")
    validate_model_lifecycle(equipment, load_csv(folder / "model_lifecycle.csv"))
    validate_product_families(equipment, load_csv(folder / 'product_families.csv'))
    assert {r["manufacturer"] for r in manufacturers} == {r["manufacturer"] for r in equipment}
    assert len(manufacturers) == len({r["manufacturer"] for r in manufacturers})
    for brand in manufacturers:
        assert brand["brand_identity_status"] in {"verified_manufacturer", "verified_brand", "needs_review", "not_a_manufacturer"}
        assert brand["research_use_status"] in {"documented_research_use", "research_supplier_claim_only", "needs_review"}
        for field in ["official_website_url", "research_evidence_url"]:
            if brand[field]:
                assert urlparse(brand[field]).scheme in {"http", "https"}
        if brand["brand_identity_status"] in {"verified_manufacturer", "verified_brand"}:
            assert brand["official_website_url"]
        if brand["research_use_status"] == "documented_research_use":
            assert brand["research_evidence_url"]
        assert brand.get("company_status", "") in {"", "active", "unknown", "defunct"}
        if brand.get("company_status") == "defunct":
            assert brand.get("company_status_note") and brand.get("company_status_source_url")
            assert urlparse(brand["company_status_source_url"]).scheme in {"http", "https"}
        if brand.get("vendor_name"):
            assert brand["brand_identity_status"] == "verified_brand"
            assert brand["official_website_url"] and brand["verification_basis"] == "user_confirmation"
    ids = [r["equipment_id"] for r in equipment]
    assert len(ids) == len(set(ids)), "Duplicate equipment identifiers"
    category_ids = {r["category_id"] for r in categories}
    assert len(category_ids) == len(categories) and {"M52", "M55"}.isdisjoint(category_ids)
    source_categories = {r["category_id"] for r in categories if r["category_origin"] == "source_pdf"}
    project_categories = {r["category_id"] for r in categories if r["category_origin"] == "project_extension"}
    assert len(source_categories) == 59 and source_categories | project_categories == category_ids
    for category in categories:
        if category["category_id"] in project_categories:
            assert not any(category[k] for k in ["source_pdf", "source_page", "source_sha256", "source_category_name"])
        else:
            assert category["source_pdf"] and category["source_category_name"]
    core = [r for r in equipment if r["catalog_scope"] == "core_example"]
    coverage = Counter(r["category_id"] for r in core)
    assert set(coverage) == source_categories
    assert all(coverage[c] == 10 for c in source_categories), "Expected ten core examples per source M category"
    for category in categories:
        if category["category_id"] in project_categories:
            count = sum(r["category_id"] == category["category_id"] for r in equipment)
            assert count >= int(category["target_examples"]), "Project M category has fewer records than its example target"
    assert len(requests) == 44 and len(source_models) == 64
    assert sum(s["source_pdf"] == "Nanomaterial_Manufacturing_Equipment_Sequenced_Manuals.pdf" for s in steps) == 109, "Retain all original source steps"
    assert {"N" + str(i).zfill(2) for i in range(1, 10)} | {"P01"} | {"P" + str(i).zfill(2) for i in range(3, 15)} <= {r["route_id"] for r in routes}, "Retain original routes and curated etching capabilities"
    route_ids = {r["route_id"] for r in routes}
    for alias in aliases:
        assert alias["legacy_category_id"] not in category_ids
        assert set(alias["canonical_category_ids"].split(";")).issubset(category_ids)
    retired = {a["legacy_category_id"] for a in aliases}
    for row in equipment:
        assert row["category_id"] not in retired, row["equipment_id"]
        assert set(filter(None, row["related_process_ids"].split(";"))).issubset(route_ids)
        assert row["model_name"] and row["product_family_id"] and row["variant_label"]
        assert row["highlight_requested"] in {"true", "false"}
        assert row["purdue_list"] == row["highlight_requested"]
        if row["manual_match_status"] == "verified_operating_manual":
            assert row["manual_url"] and row["manual_scope"], row["equipment_id"]
        for field, value in row.items():
            assert "file:///" not in value and "C:\\" not in value, "Local source paths must not be published"
            if field.endswith("_url") and value and field != "institution_logo_url":
                assert urlparse(value).scheme in {"http", "https"}, field
        if row["msrp_value"]:
            assert float(row["msrp_value"]) >= 0
            assert row["msrp_currency"] and row["price_source_url"] and row["price_checked_date"]
        if row.get("manufacturer_price_value"):
            assert float(row["manufacturer_price_value"]) >= 0
            assert row["manufacturer_price_kind"] in {"list_price", "sale_price", "starting_price", "published_price"}
            assert len(row["manufacturer_price_currency"]) == 3 and row["manufacturer_price_currency"].isupper()
            assert row["manufacturer_price_source_url"] and row["manufacturer_price_scope"]
            assert date.fromisoformat(row["manufacturer_price_checked_date"]).isoformat() == row["manufacturer_price_checked_date"]
    for request in requests:
        assert request["equipment_id"] in ids
        record = next(r for r in equipment if r["equipment_id"] == request["equipment_id"])
        assert record["highlight_requested"] == "true"
        assert request["requested_id"] in record["requested_ids"].split(";")
        for related_id in filter(None, request.get("related_equipment_ids", "").split(";")):
            related = next(r for r in equipment if r["equipment_id"] == related_id)
            assert related["highlight_requested"] == "true"
            assert request["requested_id"] in related["requested_ids"].split(";")
            assert related["source_record_id"] == record["equipment_id"]
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
        "source_m_categories": len(source_categories), "project_m_categories": len(project_categories),
        "equipment_records": len(equipment), "requested_occurrences": len(requests),
        "highlighted_equipment_records": sum(r["highlight_requested"] == "true" for r in equipment),
        "source_pdf_model_records": len(source_models), "material_families": sum(r["route_kind"] == "material_family" for r in routes),
        "additional_process_routes": sum(r["route_kind"] == "manufacturing_process" for r in routes),
        "source_routes": 20, "curated_process_capabilities": sum(r["route_kind"] == "manufacturing_process" and not r["source_pdf"] for r in routes),
        "literature_process_routes": sum(r["route_kind"] == "manufacturing_process" and r["source_pdf"] not in {"", "Nanomaterial_Manufacturing_Equipment_Sequenced_Manuals.pdf"} for r in routes),
        "literature_equipment_records": sum(r["catalog_scope"] == "literature_reported" for r in equipment), "retired_x_categories": len(aliases),
        "ordered_route_steps": len(steps),
        "manual_coverage": dict(sorted(Counter(r["manual_match_status"] for r in equipment).items())),
        "model_evidence": dict(sorted(Counter(r["model_evidence_status"] for r in equipment).items())),
        "msrp_records": sum(bool(r["msrp_value"]) for r in equipment),
        "published_manufacturer_price_records": sum(bool(r.get("manufacturer_price_value")) for r in equipment),
        "manufacturer_product_page_records": sum(bool(r.get("product_page_url")) for r in equipment),
        "technical_specification_records": sum(bool(r.get("technical_spec_url")) for r in equipment),
        "brochure_records": sum(bool(r.get("brochure_url")) for r in equipment),
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
        title = '<img src="../assets/purdue-p.png" width="22" alt="Purdue list"> **' + md(item["requested_label"]) + "**"
        manual = md(record["manual_match_status"].replace("_", " "))
        if record["manual_url"]:
            manual += f" ([document]({record['manual_url']}))"
        related = item.get("related_equipment_ids", "")
        record_ids = "; ".join(filter(None, [record['equipment_id'], related]))
        lines.append(f"| {title} | {record_ids} | {md(record['related_process_types'])} | {manual} |")
    lines.extend(["", "Renishaw AM400 occurs twice in the request; both occurrences point to one equipment-model record.",
                  "LabRAM II is classified as resonant acoustic mixing; its requested wording is preserved above.",
                  "The combined filtration-and-centrifuges request links to separate M15 filtration and M13 centrifugation records. Its original inventory entry remains shared source context.", ""])
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
