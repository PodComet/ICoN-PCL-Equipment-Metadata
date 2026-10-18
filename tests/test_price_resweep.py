import csv
import json
from decimal import Decimal
from pathlib import Path
from component_tools import dataset
from evidence_tools import dataset as evidence_dataset
from market_tools import seller_offers
from price_policy import benchmark

ROOT=Path(__file__).resolve().parents[1]
def read(name):
    with (ROOT/'catalog'/f'{name}.csv').open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def review():return json.loads((ROOT/'catalog/price_review_2026-10-18.json').read_text(encoding='utf-8'))

def test_new_purchase_prices_preserve_identity_currency_condition_and_exact_configuration():
    audit=review();equipment={r['equipment_id']:r for r in read('equipment')}
    offers={o['offer_id']:o for o in seller_offers(ROOT)}
    claims={e['evidence_id']:e for e in evidence_dataset(ROOT)['records']}
    policy=json.loads((ROOT/'webapp/app/data/msrp-policy.json').read_text(encoding='utf-8'))
    assert len(audit['instrument_prices'])==42
    assert len({p['equipment_id'] for p in audit['instrument_prices']})==41
    for p in audit['instrument_prices']:
        r=equipment[p['equipment_id']]
        assert (r['manufacturer'],r['model_name'])==(p['manufacturer'],p['model_name'])
        assert not r['msrp_value']
        if p['origin']=='manufacturer':
            assert Decimal(r['manufacturer_price_value'])==Decimal(str(p['price_value']))
            assert r['manufacturer_price_currency']==p['currency']
            assert r['manufacturer_price_source_url']==p['source_url']
            assert benchmark(r,policy) is None,'Published/starting amounts do not establish official list-price anchors'
        else:
            o=offers[p['offer_id']]
            assert Decimal(o['price_value'])==Decimal(str(p['price_value']))
            assert o['currency']==p['currency'] and o['condition']==p['adopted_condition']
            assert o['source_url']==p['source_url'] and o['scope']==p['scope']
        e=claims[p['evidence_id']]
        assert e['context']['equipment_id']==r['equipment_id']
        assert e['sources'][0]['url']==p['source_url']
        assert e['context']['source_currency']==p['currency']
        assert Decimal(e['context']['usd_equivalent'])>0
    assert any(p['currency']=='GBP' for p in audit['instrument_prices'])
    assert any(p['currency']=='EUR' for p in audit['instrument_prices'])
    assert equipment['M19-10']['manufacturer_price_value']==''
    assert len([p for p in audit['instrument_prices'] if p['equipment_id']=='M19-10'])==2
    assert not any(p['equipment_id']=='M03-02' for p in audit['instrument_prices']),'Out-of-stock recertified listing was withheld'

def test_material_quote_eligibility_does_not_convert_reference_packs_to_recipe_costs():
    audit=review();data=dataset(ROOT)
    offers={o['offer_id']:o for o in data['offers']}
    lines={c['line_id']:c for f in data['formulations'] for c in f['components']}
    assert len(audit['component_prices'])==33
    for p in audit['component_prices']:
        offer=offers[p['adopted_offer_id']]
        assert offer['sku']==p['sku'] and offer['component_id']==p['component_id']
        assert Decimal(str(offer['pack_quantity']))==Decimal(str(p['pack_quantity']))
        assert Decimal(str(offer['price_value']))==Decimal(str(p['price_value']))
        eligible=p.get('eligible_formulation_line_ids',p['target_formulation_line_ids'] if p['eligible'] else [])
        for lid in p['target_formulation_line_ids']:
            assert (offer['offer_id'] in lines[lid]['eligible_offer_ids'])==(lid in eligible)
        for oid in p.get('reference_alias_offer_ids',[]):
            assert not any(oid in line['eligible_offer_ids'] for line in lines.values())
    graphite=next(p for p in audit['component_prices'] if p['component_id']=='graphite-foil')
    assert graphite['pack_quantity']==1 and graphite['pack_unit']=='piece'
    dry=next(p for p in audit['component_prices'] if p['component_id']=='pva-5wt-aqueous')
    assert not dry['eligible'],'Dry polymer cannot directly price a prepared solution'

def test_latest_review_and_public_evidence_are_reproducible_and_exclude_private_inventory():
    audit=review();source=json.loads((ROOT/'webapp/app/data/pricing-sources.json').read_text(encoding='utf-8'))
    # The archived broad sweep remains unchanged as later focused reviews add offers.
    from collections import Counter
    assert source['coverage']['instrument_statuses']==dict(Counter(r['status'] for r in read('instrument_price_coverage')))
    assert source['review_summary']==audit['summary']
    assert source['latest_review_path']=='catalog/price_review_2026-10-18.json'
    assert audit['before_coverage']['instrument_statuses']['no_purchase_price']==779
    assert audit['after_coverage']['instrument_statuses']['no_purchase_price']==746
    assert audit['after_coverage']['component_statuses']['no_market_offer']==88
    claims=json.loads((ROOT/'catalog/purchase_price_evidence.json').read_text(encoding='utf-8'))['records']
    archived_ids={p['evidence_id'] for p in audit['instrument_prices']+audit['component_prices']}
    assert len(archived_ids)==75 and archived_ids<={e['evidence_id'] for e in claims}
    assert len({e['evidence_id'] for e in claims})==len(claims)
    register={e['evidence_id']:e for e in evidence_dataset(ROOT)['records']}
    assert all(e==register[e['evidence_id']] for e in claims)
    assert json.loads((ROOT/'webapp/app/data/purdue-inventory.json').read_text(encoding='utf-8'))==[]
    assert all(r['record_kind']=='source_claim' and r['classification']=='curator_reviewed_price' for r in claims)
