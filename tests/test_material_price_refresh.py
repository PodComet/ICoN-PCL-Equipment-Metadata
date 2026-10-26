"""Keep scheduled quote refreshes source-bound and historically reproducible."""
import csv
import json
from collections import Counter
from datetime import date
from decimal import Decimal
from pathlib import Path
import pytest

from component_tools import dataset
from evidence_tools import dataset as evidence_dataset

ROOT = Path(__file__).resolve().parents[1]


def audit():
    return json.loads((ROOT / 'catalog/material_price_refresh_2026-10-19.json').read_text(encoding='utf-8'))


@pytest.mark.parametrize('path', sorted((ROOT / 'catalog').glob('material_price_refresh_*.json')), ids=lambda p: p.stem)
def test_each_refresh_preserves_quote_identity_and_resolves_verified_evidence(path):
    data = json.loads(path.read_text(encoding='utf-8'))
    entries = data['offers']
    sources = {s['source_fetch_key']: s for s in data['sources']}
    register = {e['evidence_id']: e for e in evidence_dataset(ROOT)['records']}
    assert len(entries) == len({e['offer_id'] for e in entries}) == data['summary']['offer_records_attempted']
    assert len(sources) == data['summary']['unique_source_urls_attempted']
    counts = Counter(e['status'] for e in entries)
    assert all(counts[status] == data['summary'][status] for status in ('price_reconfirmed', 'price_changed', 'not_verified'))
    assert len(data['changes']) == counts['price_changed']
    for entry in entries:
        before, after = entry['before'], entry['after']
        changed = {key for key in before if before[key] != after[key]}
        assert set(before) == set(after)
        assert changed == set(entry['changed_fields'])
        assert changed <= {'price_value', 'checked_date'}
        source = sources[entry['source_fetch_key']]
        assert entry['source_url'] == before['source_url'] == source['source_url']
        assert entry['offer_id'] == before['offer_id'] == after['offer_id']
        assert entry['offer_id'] in source['offer_ids']
        if entry['status'] == 'not_verified':
            assert before == after and entry['unavailable_reason'] and not entry['evidence_id']
            continue
        assert after['checked_date'] == data['checked_date'] >= before['checked_date']
        assert entry['verification_scope'] and entry['verification_method']
        assert (Decimal(before['price_value']) != Decimal(after['price_value'])) == (entry['status'] == 'price_changed')
        evidence = register[entry['evidence_id']]
        assert evidence['recorded_at'] == data['checked_date']
        assert evidence['context']['offer_id'] == entry['offer_id']
        assert evidence['context']['previous_quote']['price_value'] == before['price_value']
        assert evidence['context']['price_value'] == after['price_value']
        assert evidence['sources'][0]['url'] == entry['source_url']
        if evidence.get('supersedes_id'):
            prior = register[evidence['supersedes_id']]
            assert prior['recorded_at'] <= evidence['recorded_at']
            assert any(r['record_id'] == entry['offer_id'] for r in prior['related_records'])
    if data['currency_policy']['all_source_quotes_already_usd']:
        assert not data['currency_policy']['conversion_required']
        assert all(e['before']['currency'] == e['after']['currency'] == 'USD' for e in entries)


def test_latest_refresh_snapshot_matches_canonical_quotes():
    path = sorted((ROOT / 'catalog').glob('material_price_refresh_*.json'))[-1]
    data = json.loads(path.read_text(encoding='utf-8'))
    canonical = ROOT / 'catalog/component_offers.csv'
    with canonical.open(encoding='utf-8-sig', newline='') as stream:
        current = {r['offer_id']: r for r in csv.DictReader(stream)}
    for entry in data['offers']:
        row = current[entry['offer_id']]
        if row['checked_date'] <= data['checked_date']:
            assert row == entry['after']


def test_all_existing_quote_attempts_have_complete_retained_identity_and_source_context():
    data = audit()
    entries = data['offers']
    assert len(entries) == len({e['offer_id'] for e in entries}) == 198
    sources = {s['source_fetch_key']: s for s in data['sources']}
    assert len(sources) == len({s['source_url'] for s in sources.values()}) == 131
    assert Counter(e['status'] for e in entries) == {'price_reconfirmed': 140, 'price_changed': 1, 'not_verified': 57}
    for entry in entries:
        before, after = entry['before'], entry['after']
        assert set(before) == set(after)
        assert entry['offer_id'] == before['offer_id'] == after['offer_id']
        changed = {k for k in before if before[k] != after[k]}
        assert changed == set(entry['changed_fields'])
        assert changed <= {'price_value', 'checked_date'}
        source = sources[entry['source_fetch_key']]
        assert entry['source_url'] == before['source_url'] == source['source_url']
        assert entry['offer_id'] in source['offer_ids']
        if entry['status'] == 'not_verified':
            assert before == after and entry['unavailable_reason'] and not entry['evidence_id']
        else:
            assert after['checked_date'] == data['checked_date']
            assert date.fromisoformat(after['checked_date']) >= date.fromisoformat(before['checked_date'])
            assert entry['verification_scope'] and entry['evidence_id']
            assert (Decimal(before['price_value']) != Decimal(after['price_value'])) == (entry['status'] == 'price_changed')
    assert data['currency_policy']['all_source_quotes_already_usd']
    assert not data['currency_policy']['conversion_required']
    assert all(e['before']['currency'] == e['after']['currency'] == 'USD' for e in entries)


def test_price_changes_and_unchanged_pack_rechecks_resolve_to_dated_public_evidence():
    data = audit()
    register = {e['evidence_id']: e for e in evidence_dataset(ROOT)['records']}
    for entry in data['offers']:
        if not entry['evidence_id']:
            continue
        evidence = register[entry['evidence_id']]
        assert evidence['classification'] == 'curator_reviewed_price'
        assert evidence['recorded_at'] == data['checked_date']
        assert evidence['sources'][0]['url'] == entry['source_url']
        assert evidence['context']['offer_id'] == entry['offer_id']
        assert evidence['context']['previous_quote']['price_value'] == entry['before']['price_value']
        assert evidence['context']['price_value'] == entry['after']['price_value']
    change, = data['changes']
    assert change['sku'] == 'HPL30-500ML'
    assert Decimal(change['previous_price']) == Decimal('54.86')
    assert Decimal(change['new_price']) == Decimal('55.00')
    assert Decimal(change['difference']) == Decimal('0.14')
    assert data['summary']['media_updates'] == data['summary']['new_offers'] == 0


def test_app_component_export_matches_current_quotes_without_adding_private_inventory():
    current = dataset(ROOT)
    exported = json.loads((ROOT / 'webapp/app/data/components.json').read_text(encoding='utf-8'))
    assert exported == current
    assert current['checked_date'] >= audit()['checked_date']
    rows = {r['offer_id']: r for r in current['offers']}
    for entry in audit()['offers']:
        row = rows[entry['offer_id']]
        # A later dated refresh may legitimately replace this historical quote.
        if row['checked_date'] == entry['after']['checked_date']:
            assert Decimal(str(row['price_value'])) == Decimal(entry['after']['price_value'])
        else:
            assert row['checked_date'] > entry['after']['checked_date']
    assert json.loads((ROOT / 'webapp/app/data/purdue-inventory.json').read_text(encoding='utf-8')) == []
