"""Protect exact SKU/grade scope and saved-profile boundaries in the Thermo review."""
import csv,json
from decimal import Decimal
from pathlib import Path
from component_tools import dataset
from evidence_tools import dataset as evidence_dataset
from market_tools import seller_offers
from price_policy import benchmark

ROOT=Path(__file__).resolve().parents[1]
def review():return json.loads((ROOT/'catalog/thermo_catalog_review_2026-10-19.json').read_text(encoding='utf-8'))
def equipment():
    with (ROOT/'catalog/equipment.csv').open(encoding='utf-8-sig',newline='') as f:return {r['equipment_id']:r for r in csv.DictReader(f)}

def test_photos_fill_gaps_and_distinguish_family_views_from_specific_models():
    audit=review();rows=equipment()
    assert len(rows)>=1113 and audit['summary']['new_equipment_records']==0
    assert len(audit['instrument_images'])==12
    assert sum(p['match_scope']=='product_family' for p in audit['instrument_images'])==4
    for p in audit['instrument_images']:
        assert not p['before']['image_url']
        assert set(p['before'])==set(p['after'])=={'image_url','image_source_url','image_scope','media_checked_date'}
        assert all(rows[p['equipment_id']][k]==v for k,v in p['after'].items())
        assert p['verification']['status']==200 and p['verification']['content_type'].startswith('image/')
        assert 'thermofisher.com' in p['after']['image_source_url']
        if p['equipment_id']=='M36-07':assert 'PRO' in p['after']['image_scope'] and p['match_scope']=='product_family'

def test_official_list_benchmarks_and_online_discounts_stay_separate():
    audit=review();rows=equipment();offers={o['offer_id']:o for o in seller_offers(ROOT)}
    policy=json.loads((ROOT/'webapp/app/data/msrp-policy.json').read_text(encoding='utf-8'))
    assert len(audit['manufacturer_prices'])==4 and len(audit['online_offers'])==2
    assert sum(p['previously_unpriced'] for p in audit['manufacturer_prices'])==1
    for p in audit['manufacturer_prices']:
        row=rows[p['equipment_id']]
        assert not p['before']['manufacturer_price_value'] and not row['msrp_value']
        assert row['manufacturer_price_kind']=='list_price' and row['manufacturer_price_currency']=='USD'
        assert p['source_sku'] in row['manufacturer_price_scope'] or p['source_sku'] in row['manufacturer_price_source_url']
        assert benchmark(row,policy)['kind']=='manufacturer list price'
        assert p['verification']['status']==200 and '/us/en/' in p['source_url']
    for p in audit['online_offers']:
        row=rows[p['equipment_id']];offer=offers[p['offer_id']]
        assert Decimal(offer['price_value'])<Decimal(row['manufacturer_price_value'])
        assert offer['price_kind']=='sale_price' and offer['condition']=='new'

def test_material_grades_remain_reference_only_and_kit_photo_does_not_reprice_a_vial():
    audit=review();data=dataset(ROOT);offers={o['offer_id']:o for o in data['offers']}
    lines=[c for f in data['formulations'] for c in f['components']]+data['market_components']
    assert len(audit['component_offers'])==12
    assert len({p['component_id'] for p in audit['component_offers']})==7
    for p in audit['component_offers']:
        offer=offers[p['offer_id']]
        assert p['purchase_available'] and not p['recipe_eligible']
        assert not any(p['offer_id'] in line['eligible_offer_ids'] for line in lines)
        assert (offer['sku'],offer['grade'],offer['form'])==(p['sku'],p['grade'],p['form'])
        assert Decimal(str(offer['price_value']))==Decimal(p['price_value'])
        assert p['verification']['currency_label']=='Price (USD)'
        assert not offer['image_url'],'Chemical structure diagrams are not material photographs'
    titanium=[p for p in audit['component_offers'] if p['sku'].startswith('035794.')]
    assert len(titanium)==3 and all(p['component_id']=='titanium-isopropoxide-999' for p in titanium)
    media,=audit['component_media_updates'];kit=offers[media['offer_id']]
    assert kit['sku']=='V22889' and not media['before']['image_url']
    assert kit['image_url']==media['after']['image_url']
    assert 'whole' in kit['image_scope'].lower() and 'not' in kit['image_scope'].lower()

def test_claims_resolve_and_public_review_has_no_raw_files_or_private_inventory():
    audit=review();register={e['evidence_id']:e for e in evidence_dataset(ROOT)['records']}
    additions=sum((audit[k] for k in ['instrument_images','manufacturer_prices','online_offers','component_offers','component_media_updates']),[])
    ids={e['evidence_id'] for e in additions}
    assert len(ids)==audit['summary']['new_source_evidence_claims']==31
    assert ids<=register.keys() and all(register[e]['sources'] and register[e]['scope'] for e in ids)
    assert 'raw_html_path' not in json.dumps(audit) and 'C:\\Users\\' not in json.dumps(audit)
    assert json.loads((ROOT/'webapp/app/data/purdue-inventory.json').read_text(encoding='utf-8'))==[]
