import csv
import json
from decimal import Decimal
from pathlib import Path

from component_tools import dataset
from market_tools import seller_offers
from price_policy import benchmark

ROOT=Path(__file__).resolve().parents[1]

def read(name):
    with (ROOT/'catalog'/f'{name}.csv').open(encoding='utf-8',newline='') as f:return list(csv.DictReader(f))

def review():return json.loads((ROOT/'catalog/price_review_2026-10-17.json').read_text(encoding='utf-8'))

def test_review_preserves_exact_prices_cents_model_identity_and_provenance():
    audit=review();records={r['equipment_id']:r for r in read('equipment')}
    offers={r['equipment_id']:r for r in seller_offers(ROOT) if r['offer_id'].startswith('SELL-PRICE26-')}
    assert len(audit['instrument_prices'])==audit['summary']['instrument_prices_added']==59
    policy=json.loads((ROOT/'webapp/app/data/msrp-policy.json').read_text(encoding='utf-8'))
    for p in audit['instrument_prices']:
        record=records[p['equipment_id']]
        assert all(record[k]==p[k] for k in ['manufacturer','model_name'])
        if p['origin']=='manufacturer':
            assert Decimal(record['manufacturer_price_value'])==Decimal(str(p['price_value']))
            assert record['manufacturer_price_source_url']==p['source_url']
            assert record['manufacturer_price_kind']==p['adopted_price_kind']
        else:
            offer=offers[p['equipment_id']]
            assert Decimal(offer['price_value'])==Decimal(str(p['price_value']))
            assert offer['source_url']==p['source_url'] and offer['condition']==p['adopted_condition']
            assert benchmark({'seller_price_value':offer['price_value'],'seller_price_kind':'list_price'},policy) is None
        assert not record['msrp_value']
    assert records['M13-01']['manufacturer_price_value']=='20817.99'
    assert offers['EXP-20261016-M62-UR30']['price_value']=='72222.72'
    assert len(audit['instrument_review_status'])==859
    assert sum(r['status']=='not_individually_reviewed' for r in audit['instrument_review_status'])==754

def test_reference_packs_do_not_gain_consumption_eligibility_by_alias_or_name():
    audit=review();data=dataset(ROOT);offers={o['offer_id']:o for o in data['offers']}
    lines={c['line_id']:c for f in data['formulations'] for c in f['components']}
    for mapping in audit['component_mappings']:
        offer=offers[mapping['adopted_offer_id']]
        assert offer['source_url']==offers[mapping['offer_id']]['source_url']
        for lid in mapping.get('eligible_line_ids',[]):assert offer['offer_id'] in lines[lid]['eligible_offer_ids']
        for lid in mapping.get('reference_line_ids',[]):
            assert offer['component_id']==lines[lid]['component_id']
            assert offer['offer_id'] not in lines[lid]['eligible_offer_ids']
    assert audit['summary']['unique_new_component_pack_quotes']==42
    assert len(audit['component_review_status'])==188

def test_generated_coverage_distinguishes_absent_prices_estimates_and_reference_offers():
    data=json.loads((ROOT/'webapp/app/data/pricing-sources.json').read_text(encoding='utf-8'))
    instruments=read('instrument_price_coverage');components=read('component_price_coverage')
    assert len(instruments)==data['coverage']['instrument_records']==len(read('equipment'))
    assert {r['equipment_id'] for r in instruments}=={r['equipment_id'] for r in read('equipment')}
    assert len(components)==data['coverage']['component_occurrences']==260
    assert sum(data['coverage']['instrument_statuses'].values())==len(instruments)
    assert sum(data['coverage']['component_statuses'].values())==len(components)
    for r in instruments:
        if r['status']=='no_purchase_price':assert not r['msrp_value'] and not r['manufacturer_price_value'] and not int(r['seller_offer_count']) and not r['estimate_low']
        if r['status']=='secondary_market_only':assert int(r['seller_offer_count']) and not int(r['new_seller_offer_count'])
    assert {s['source_year'] for s in data['sources']}=={'2025','2026','Undated web page','Observed 2026'}
    assert all(s['notes'] and s['publisher'] for s in data['sources'])
