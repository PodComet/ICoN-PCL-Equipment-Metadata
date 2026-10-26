"""Verify condition-scoped LabX offers and lossless source reconciliation."""
import csv, hashlib, json
from pathlib import Path
from decimal import Decimal
from evidence_tools import dataset
from price_policy import benchmark
from purdue_review import matches_purdue
from price_history import quotes_at_checkpoint

ROOT=Path(__file__).resolve().parents[1]
def read(name):
    with (ROOT/'catalog'/f'{name}.csv').open(encoding='utf-8-sig',newline='') as f:
        rows=list(csv.DictReader(f))
    return quotes_at_checkpoint(ROOT,rows,'2026-10-19') if name=='component_offers' else rows
def review(): return json.loads((ROOT/'catalog/labx_catalog_review_2026-10-19.json').read_text(encoding='utf-8'))
def digest(v): return hashlib.sha256(json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def test_review_preserves_prior_equipment_quotes_recipes_and_inventory():
    audit=review();rows=read('equipment');new={r['equipment_id'] for r in audit['new_records']}
    before={r['equipment_id']:r['before'] for r in audit['equipment_updates']}
    original=[before.get(r['equipment_id'],r) for r in rows if r['equipment_id'] not in new]
    assert len(rows)==audit['after_equipment_count']==1125
    assert digest(original)==audit['baseline_semantic_sha256']['equipment']
    assert len(before)==10 and len(new)==4
    assert {r['equipment_id']:r for r in rows if r['equipment_id'] in new}=={r['equipment_id']:r for r in audit['new_records']}
    for update in audit['equipment_updates']:
        changed={k for k in update['after'] if update['before'][k]!=update['after'][k]}
        assert changed=={'image_url','image_source_url','image_scope','media_checked_date'}
        assert not update['before']['image_url'] and update['after']['image_url']
    for name,addition in [('seller_offers',audit['seller_offers']),('component_offers',audit['component_offers']),('market_components',audit['new_market_components'])]:
        key={'seller_offers':'offer_id','component_offers':'offer_id','market_components':'market_component_id'}[name]
        ids={r[key] for r in addition}
        assert digest([r for r in read(name) if r[key] not in ids])==audit['baseline_semantic_sha256'][name]
    for name in ['manufacturers','formulation_components','product_families']:
        assert digest(read(name))==audit['baseline_semantic_sha256'][name]
    assert digest([r for r in read('model_lifecycle') if r['equipment_id'] not in new])==audit['baseline_semantic_sha256']['model_lifecycle']
    designated=[r for r in rows if r['purdue_list']=='true']
    assert len(designated)==44 and all(not matches_purdue(r,designated) for r in audit['new_records'])
    assert all(not r['requested_ids'] and not r['institution_label'] and not r['source_pdf'] for r in audit['new_records'])
    assert json.loads((ROOT/'webapp/app/data/purdue-inventory.json').read_text(encoding='utf-8'))==[]

def test_seller_condition_and_configuration_cannot_become_msrp_benchmarks():
    audit=review();rows={r['equipment_id']:r for r in read('equipment')}
    policy=json.loads((ROOT/'webapp/app/data/msrp-policy.json').read_text(encoding='utf-8'))
    offers=audit['seller_offers']
    assert len(offers)==5 and {o['condition'] for o in offers}=={'used','refurbished'}
    assert sum(o['condition']=='used' for o in offers)==2
    for o in offers:
        assert o['currency']=='USD' and o['price_kind']=='asking_price' and Decimal(o['price_value'])>0
        assert o['listing_sku'] in o['source_url'] and o['benchmark_eligible'] is False
        assert not rows[o['equipment_id']]['msrp_value'] and not rows[o['equipment_id']]['manufacturer_price_value']
        assert benchmark(rows[o['equipment_id']],policy) is None
        assert o['availability_checked']=='active_no_unavailable_banner' and o['checked_date']=='2026-10-19'
    d8=next(o for o in offers if o['equipment_id']=='M37-08')
    assert d8['price_value']=='57000' and 'Series 1' in d8['scope']
    # Retained numeric prices on sold pages, shipping prices and partial assemblies are excluded.
    assert not {'M16-06','M53-05','M46-01','M46-07'} & {o['equipment_id'] for o in offers}
    packs=audit['component_offers']
    assert len(packs)==2 and all(p['pack_quantity']=='100' and p['pack_unit']=='g' and p['price_value']=='495' and p['currency']=='USD' for p in packs)
    assert all(p['seller']=='Spectra Services' and not p['image_url'] and not p['recipe_eligible'] for p in packs)
    assert all(m['route_ids']=='P29' and 'compatibility' in m['scope'] for m in audit['new_market_components'])

def test_claims_resolve_with_photos_documentation_and_source_boundaries():
    audit=review();evidence={r['evidence_id']:r for r in dataset(ROOT)['records']}
    assert len(set(audit['evidence_ids']))==audit['summary']['new_source_claims']==25
    assert set(audit['evidence_ids'])<=evidence.keys()
    assert len(audit['discovery_listing_urls'])==len(set(audit['discovery_listing_urls']))==304
    assert len(audit['instrument_images'])==14
    for p in audit['instrument_images']:
        assert p['verification']['status']==200 and p['verification']['content_type'].startswith('image/')
        assert p['match_scope'] in {'exact_model','product_family'}
        assert evidence[p['evidence_id']]['context']['image_scope']==p['after']['image_scope']
        if p['listing_availability']=='no_longer_available': assert 'histor' in p['image_scope'].lower()
    models=audit['new_records']
    assert {r['category_id'] for r in models}=={'M16','M41','M98'}
    assert sum(bool(r['manual_url']) for r in models)==2 and all(r['technical_spec_url'] for r in models)
    lifecycle={r['equipment_id']:r for r in read('model_lifecycle')}
    successor=lifecycle['CAT-LABX-BUCHI-R215']
    assert successor['lifecycle_status']=='newer_model_confirmed' and successor['successor_relationship']=='direct_successor'
    assert successor['successor_evidence_url'].startswith('https://www.buchi.com/')
    assert 'C:\\Users\\' not in json.dumps(audit)
