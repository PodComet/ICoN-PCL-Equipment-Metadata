import copy
import json
import pytest
from catalog_tools import ROOT, load_csv, validate_model_lifecycle


def test_dated_lifecycle_review_matches_canonical_csv_and_generated_seed():
    records = load_csv(ROOT / 'catalog/equipment.csv')
    reviews = load_csv(ROOT / 'catalog/model_lifecycle.csv')
    report = json.loads((ROOT / 'catalog/model_lifecycle_review_2026-10-15.json').read_text(encoding='utf-8'))
    seed = json.loads((ROOT / 'webapp/app/data/catalog.json').read_text(encoding='utf-8'))
    dated=[r for r in reviews if r['equipment_id'] not in {v['equipment_id'] for v in records if v['catalog_scope']=='mit_class_expansion'} and r['review_method'] not in {'literature_methods_identity_check','official_module_identity_check','primary_source_identity_only'}]
    counts = validate_model_lifecycle(records, dated)
    assert counts == report['status_counts']
    assert counts['newer_model_confirmed'] == 24
    assert report['reviewed_records'] == len(dated) == 632
    assert report['catalog_records'] == 632
    assert report['not_reviewed_records'] == 632-len(dated)
    assert report['not_reviewed_records'] == 0
    assert report['records'] == dated
    assert reviews == seed['model_lifecycle']
    by_id = {r['equipment_id']: r for r in seed['records']}
    for review in reviews:
        assert all(by_id[review['equipment_id']][key] == value for key,value in review.items() if key.startswith(('successor_', 'lifecycle_')))


def test_unresolved_models_and_missing_sources_are_explicit_in_full_sweep():
    reviews = load_csv(ROOT / 'catalog/model_lifecycle.csv')
    unresolved = [r for r in reviews if r['lifecycle_status'] == 'model_unresolved' and r['review_method'] not in {'literature_methods_identity_check','official_module_identity_check','primary_source_identity_only'}]
    assert len(unresolved) == 105
    assert all(r['review_notes'] and r['review_method'] for r in unresolved)
    assert all(not r['successor_product_url'] for r in unresolved)
    unspecified = [r for r in reviews if r['manufacturer'] == 'Unspecified' and r['review_method'] not in {'literature_methods_identity_check','official_module_identity_check','primary_source_identity_only'}]
    assert len(unspecified) == 12
    assert all(r['lifecycle_status'] == 'model_unresolved' for r in unspecified)
    assert next(r for r in reviews if r['equipment_id']=='M38-04')['lifecycle_status']=='model_unresolved'


@pytest.mark.parametrize('patch', [
    {'model_name': 'Another model'}, {'equipment_id': 'MISSING'},
    {'successor_product_url': ''}, {'successor_product_url': 'javascript:alert(1)'},
    {'successor_scope': ''}, {'successor_relationship': 'parallel_capacity'},
    {'successor_checked_date': '2026-02-30'},
])
def test_lifecycle_validation_rejects_incomplete_or_misassigned_confirmations(patch):
    records = load_csv(ROOT / 'catalog/equipment.csv')
    reviews = load_csv(ROOT / 'catalog/model_lifecycle.csv')
    row = copy.deepcopy(next(r for r in reviews if r['lifecycle_status'] == 'newer_model_confirmed'))
    row.update(patch)
    with pytest.raises((AssertionError, ValueError)):
        validate_model_lifecycle(records, [row])
