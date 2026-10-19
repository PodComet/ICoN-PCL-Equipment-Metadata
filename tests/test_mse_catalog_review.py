"""Verify exact-model media and source-scoped MSE price adoption."""
import csv
import json
from decimal import Decimal
from pathlib import Path

from component_tools import dataset
from evidence_tools import dataset as evidence_dataset
from market_tools import seller_offers

ROOT = Path(__file__).resolve().parents[1]


def review():
    return json.loads((ROOT / 'catalog/mse_catalog_review_2026-10-19.json').read_text(encoding='utf-8'))


def test_only_missing_instrument_images_change_and_source_identity_stays_bound():
    audit = review()
    with (ROOT / 'catalog/equipment.csv').open(encoding='utf-8-sig', newline='') as f:
        records = {r['equipment_id']: r for r in csv.DictReader(f)}
    assert audit['summary']['instrument_photos_added'] == 14
    # This dated review added no models; later catalogue expansions may do so.
    assert len(records) >= 1113 and not audit['summary']['new_equipment_records']
    for photo in audit['instrument_images']:
        before, after = photo['before'], photo['after']
        assert not before['image_url'] and after['image_url'].startswith('https://')
        assert before['manufacturer'] == after['manufacturer']
        assert before['model_name'] == after['model_name']
        record = records[photo['equipment_id']]
        assert all(record[k] == v for k, v in after.items())
        assert 'msesupplies.com/products/' in after['image_source_url']
        assert after['image_scope'] and photo['evidence_id']
    assert not {'M31-03', 'M20-02'} & {p['equipment_id'] for p in audit['instrument_images']}


def test_exact_pump_variants_are_seller_quotes_and_materials_do_not_gain_recipe_eligibility():
    audit = review()
    offers = {o['offer_id']: o for o in seller_offers(ROOT)}
    assert len(audit['seller_offers']) == 2
    for observed in audit['seller_offers']:
        row = offers[observed['offer_id']]
        assert row['condition'] == 'new' and row['currency'] == 'USD'
        assert Decimal(row['price_value']) == Decimal(observed['price_value'])
        assert str(observed['variant_id']) in row['source_url']
        assert observed['seller_sku'] in row['scope']
        assert 'manufacturer MSRP' in row['scope']
    data = dataset(ROOT)
    current = {o['offer_id']: o for o in data['offers']}
    additions = audit['component_offers']
    assert len(additions) == 12 and len({o['component_id'] for o in additions}) == 7
    assert audit['summary']['previously_unquoted_component_identities'] == len(audit['previously_unquoted_component_ids']) == 5
    assert 'silica-50nm' not in audit['previously_unquoted_component_ids'], 'Existing priced aliases count as prior coverage'
    assert len({o['component_id'] for o in additions if o['image_url']}) == 3
    assert all(not c['recipe_eligible'] for c in additions)
    for c in additions:
        row = current[c['offer_id']]
        assert row['manufacturer'] == ''
        assert row['grade'] == c['grade'] and row['form'] == c['form']
        assert Decimal(str(row['pack_quantity'])) == Decimal(c['pack_quantity'])
        assert Decimal(str(row['price_value'])) == Decimal(c['price_value'])
        assert str(c['variant_id']) in row['source_url']
        assert not any(c['offer_id'] in line['eligible_offer_ids'] for f in data['formulations'] for line in f['components'])
        assert not any(c['offer_id'] in line['eligible_offer_ids'] for line in data['market_components'])
    held_skus = {x['seller_sku'] for x in audit['held_material_quotes']}
    assert held_skus == {'TA0810', 'TA0811', 'TA3401', 'TA3402', 'TA4360'}
    assert not held_skus & {x['sku'] for x in additions}


def test_review_claims_resolve_without_exposing_local_paths_or_private_inventory():
    audit = review()
    register = {e['evidence_id']: e for e in evidence_dataset(ROOT)['records']}
    ids = {e['evidence_id'] for e in audit['instrument_images'] + audit['seller_offers'] + audit['component_offers']}
    assert len(ids) == audit['summary']['new_source_evidence_claims'] == 28
    assert ids <= register.keys()
    assert all(register[eid]['sources'] and register[eid]['scope'] for eid in ids)
    assert 'C:\\Users\\' not in json.dumps(audit)
    assert json.loads((ROOT / 'webapp/app/data/purdue-inventory.json').read_text(encoding='utf-8')) == []
