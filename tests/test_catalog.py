import csv
from pathlib import Path

from catalog_tools import ROOT, inspect_catalog, load_csv, render_views


def test_catalog_integrity_and_relationships():
    summary = inspect_catalog()
    assert summary["core_examples"] == 590
    assert summary["active_m_categories"] == 59
    assert summary["requested_occurrences"] == 44
    assert summary["highlighted_equipment_records"] == 44


def test_requested_duplicate_and_variants_are_preserved():
    requests = load_csv(ROOT / "catalog/requested_equipment.csv")
    am400 = [r for r in requests if r["requested_label"] == "Renishaw AM400"]
    assert len(am400) == 2
    assert am400[0]["equipment_id"] == am400[1]["equipment_id"]
    records = load_csv(ROOT / "catalog/equipment.csv")
    assert sum(r["purdue_list"] == "true" for r in records) == 44
    assert all(r["institution_basis"] == "user_designated_list" for r in records if r["purdue_list"] == "true")
    extruders = [r for r in records if r["model_name"].startswith("Genizer GJE-")]
    assert {r["capacity_ml"] for r in extruders} == {"10", "100", "800", "3000", "10000"}
    assert len({r["product_family_id"] for r in extruders}) == 1


def test_approved_x_categories_merge_into_m_without_losing_requested_links():
    records = load_csv(ROOT / "catalog/equipment.csv")
    by_id = {r["equipment_id"]: r for r in records}
    assert not {"X-ETCH", "X-FILTER", "X-LASER"}.intersection(r["category_id"] for r in records)
    for equipment_id, category in [("REQ-EQ-021", "M61"), ("REQ-EQ-022", "M15"),
                                   ("REQ-EQ-022-CENTRIFUGES", "M13"), ("REQ-EQ-041", "M56")]:
        assert by_id[equipment_id]["category_id"] == category
        assert by_id[equipment_id]["purdue_list"] == "true"
    request = next(r for r in load_csv(ROOT / "catalog/requested_equipment.csv") if r["requested_id"] == "REQ-022")
    assert request["related_equipment_ids"] == "REQ-EQ-022-CENTRIFUGES"
    wet = by_id["REQ-EQ-021"]
    assert "P13" in wet["related_process_ids"].split(";")
    assert "P14" not in wet["related_process_ids"].split(";")


def test_manual_scope_does_not_promote_generation_mismatches():
    records = load_csv(ROOT / "catalog/equipment.csv")
    for name in ["IKA EUROSTAR 20 digital, 20105154", "Avanti Mini Extruder Pro"]:
        record = next(r for r in records if r["model_name"] == name)
        assert record["manual_match_status"] == "scope_or_generation_unresolved"


def test_generated_views_are_reproducible(tmp_path):
    import shutil
    shutil.copytree(ROOT / "catalog", tmp_path / "catalog")
    render_views(tmp_path)
    for filename in ["catalog/coverage.json", "docs/requested-equipment.md"]:
        assert (ROOT / filename).read_bytes() == (tmp_path / filename).read_bytes()
