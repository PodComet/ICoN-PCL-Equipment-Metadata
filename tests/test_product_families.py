import copy
import json
import pytest
from catalog_tools import ROOT, load_csv, validate_product_families


def test_membership_preserves_model_data_and_matches_review_report():
    equipment = load_csv(ROOT / 'catalog/equipment.csv')
    memberships = load_csv(ROOT / 'catalog/product_families.csv')
    assert validate_product_families(equipment, memberships) == 35
    seed = json.loads((ROOT / 'webapp/app/data/catalog.json').read_text(encoding='utf-8'))
    assert len(seed['records']) == len(equipment)
    assert len([r for r in equipment if r['catalog_scope'] in {'core_example','requested_supplement'}]) == 632
    assert len({r['product_family_id'] for r in seed['records'] if r['catalog_scope'] in {'core_example','requested_supplement'}}) == 535
    by_id = {r['equipment_id']: r for r in seed['records']}
    for original in equipment:
        for field in ['model_name', 'manufacturer', 'manual_url', 'manual_match_status', 'product_page_url', 'image_url', 'msrp_value', 'category_id', 'related_material_ids', 'related_process_ids', 'purdue_list']:
            assert by_id[original['equipment_id']][field] == original[field]
    report = json.loads((ROOT / 'catalog/product_family_review_2026-10-15.json').read_text(encoding='utf-8'))
    assert report['memberships'] == [m for m in memberships if not m['equipment_id'].startswith('EXT-')]
    assert report['previous_cards'] - report['resulting_cards'] == report['cards_consolidated'] == 41


def test_membership_validation_rejects_identity_mismatch_and_false_aliases():
    equipment = load_csv(ROOT / 'catalog/equipment.csv')
    memberships = load_csv(ROOT / 'catalog/product_families.csv')
    for field, value in [('manufacturer', 'Wrong maker'), ('model_name', 'Different model'), ('grouping_source_url', 'javascript:bad'), ('variant_sort_order', '-1')]:
        changed = copy.deepcopy(memberships)
        changed[0][field] = value
        with pytest.raises(AssertionError):
            validate_product_families(equipment, changed)
    changed = copy.deepcopy(memberships)
    changed[1]['model_variant_id'] = changed[0]['model_variant_id']
    with pytest.raises(AssertionError):
        validate_product_families(equipment, changed)
