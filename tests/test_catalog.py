import csv
import json
from pathlib import Path

from catalog_tools import ROOT, inspect_catalog, load_csv, render_views


def test_catalog_integrity_and_relationships():
    summary = inspect_catalog()
    assert summary["core_examples"] == 590
    assert summary["active_m_categories"] == 68
    assert summary["source_m_categories"] == 59
    assert summary["project_m_categories"] == 9
    assert summary["material_families"] == 10
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
    assert not {"X-ETCH", "X-FILTER", "X-LASER", "X-MIX", "X-ROB"}.intersection(r["category_id"] for r in records)
    for equipment_id, category in [("REQ-EQ-021", "M61"), ("REQ-EQ-022", "M15"),
                                   ("REQ-EQ-022-CENTRIFUGES", "M13"), ("REQ-EQ-041", "M56"),
                                   ("REQ-EQ-023", "M50"), ("REQ-EQ-036", "M50")]:
        assert by_id[equipment_id]["category_id"] == category
        assert by_id[equipment_id]["purdue_list"] == "true"
    request = next(r for r in load_csv(ROOT / "catalog/requested_equipment.csv") if r["requested_id"] == "REQ-022")
    assert request["related_equipment_ids"] == "REQ-EQ-022-CENTRIFUGES"
    wet = by_id["REQ-EQ-021"]
    assert "P13" in wet["related_process_ids"].split(";")
    assert "P14" not in wet["related_process_ids"].split(";")


def test_robotics_extension_retains_all_requested_profiles_and_source_provenance():
    records = load_csv(ROOT / "catalog/equipment.csv")
    robots = [r for r in records if r["category_id"] == "M62" and r["catalog_scope"] == "requested_supplement"]
    assert len(robots) == 13
    assert all(r["purdue_list"] == "true" and r["legacy_category_ids"] == "X-ROB" for r in robots)
    assert all(r["catalog_scope"] == "requested_supplement" for r in robots)
    assert all(not r["related_material_ids"] and not r["related_process_ids"] for r in robots if r["equipment_id"] != "REQ-EQ-020")
    doosan=next(r for r in robots if r["equipment_id"] == "REQ-EQ-020")
    assert doosan["related_material_ids"] == "N01" and doosan["related_process_ids"] == "P18"
    category = next(r for r in load_csv(ROOT / "catalog/categories.csv") if r["category_id"] == "M62")
    assert category["category_origin"] == "project_extension"
    assert not category["source_pdf"] and not category["source_category_name"]


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


def test_manufacturer_link_review_matches_canonical_data_and_keeps_msrp_distinct():
    ledger = json.loads((ROOT / 'catalog/deep_link_review_2026-10-14.json').read_text(encoding='utf-8'))
    records = {r['equipment_id']: r for r in load_csv(ROOT / 'catalog/equipment.csv')}
    review = load_csv(ROOT / 'catalog/deep_link_review_2026-10-14.csv')
    assert len(review) == ledger['summary']['reviewed_records']
    superseding = {}
    for path in sorted((ROOT / 'catalog').glob('link_review_*.json')):
        later = json.loads(path.read_text(encoding='utf-8'))
        for update in later.get('equipment_updates', []):
            superseding.setdefault(update['equipment_id'], {}).update(update['after'])
    for update in ledger['updates']:
        record = records[update['equipment_id']]
        for group in update['groups']:
            assert all(record[key] == superseding.get(update['equipment_id'], {}).get(key, value) for key, value in group['after'].items())
            assert not {'category_id', 'purdue_list', 'source_pdf', 'source_page'}.intersection(group['after'])
    for finding in ledger['findings']:
        if finding.get('price'):
            for equipment_id in finding['ids']:
                record = records[equipment_id]
                assert record['manufacturer_price_scope'] and record['manufacturer_price_checked_date']
                assert not record['msrp_value'], 'Published selling prices must not become asserted MSRP'


def test_active_mazak_links_use_current_us_site_and_keep_review_history():
    ledger = json.loads((ROOT / 'catalog/link_review_2026-10-15.json').read_text(encoding='utf-8'))
    records = {r['equipment_id']: r for r in load_csv(ROOT / 'catalog/equipment.csv')}
    for update in ledger['equipment_updates']:
        assert all(records[update['equipment_id']][key] == value for key, value in update['after'].items())
    for name in ['equipment.csv', 'manufacturers.csv', 'category_price_estimates.csv']:
        for row in load_csv(ROOT / 'catalog' / name):
            for field, value in row.items():
                if field.endswith(('_url', '_urls')):
                    assert 'virtual.mazakusa.com' not in value
    assert all(c['status'] == 200 and c['url'].startswith('https://www.mazak.com/us-en/') for c in ledger['checks'])
    assert any('virtual.mazakusa.com' in str(finding) for finding in json.loads((ROOT / 'catalog/deep_link_review_2026-10-14.json').read_text(encoding='utf-8'))['findings'])
