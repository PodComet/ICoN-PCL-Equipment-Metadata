"""Verify supplier identity, price scope and preservation in the Labmate expansion."""
import csv,json,hashlib
from decimal import Decimal
from pathlib import Path
from evidence_tools import dataset as evidence_dataset
from purdue_review import matches_purdue
from price_policy import benchmark
from price_history import quotes_at_checkpoint
ROOT=Path(__file__).resolve().parents[1]
def read(name):
    with (ROOT/'catalog'/f'{name}.csv').open(encoding='utf-8-sig',newline='') as f:rows=list(csv.DictReader(f))
    if name=='component_offers':
        rows=quotes_at_checkpoint(ROOT,rows,'2026-10-19')
    # Reconstruct this historical checkpoint by undoing the later, audited LabX additions.
    later=json.loads((ROOT/'catalog/labx_catalog_review_2026-10-19.json').read_text(encoding='utf-8'))
    if name=='equipment':
        ids={r['equipment_id'] for r in later['new_records']}
        before={r['equipment_id']:r['before'] for r in later['equipment_updates']}
        rows=[before.get(r['equipment_id'],r) for r in rows if r['equipment_id'] not in ids]
    if name in {'component_offers','market_components'}:
        key='offer_id' if name=='component_offers' else 'market_component_id'
        ids={r[key] for r in later['component_offers' if name=='component_offers' else 'new_market_components']}
        rows=[r for r in rows if r[key] not in ids]
    return rows
def review():return json.loads((ROOT/'catalog/labmate_catalog_review_2026-10-19.json').read_text(encoding='utf-8'))
def digest(rows):return hashlib.sha256(json.dumps(rows,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def test_additions_preserve_all_existing_model_data_and_references():
    audit=review();new=audit['new_records'];rows=read('equipment');ids={r['equipment_id'] for r in new}
    assert len(new)==len(ids)==8 and len(rows)==audit['after_equipment_count']==1121
    assert digest([r for r in rows if r['equipment_id'] not in ids])==audit['baseline_semantic_sha256']['equipment']
    assert len({r['category_id'] for r in new})==7
    assert {r['category_id'] for r in new}<={c['category_id'] for c in read('categories')}
    assert {r['equipment_id']:r for r in rows if r['equipment_id'] in ids}=={r['equipment_id']:r for r in new}
    for name in ['component_offers','formulation_components','market_components']:
        assert digest(read(name))==audit['baseline_semantic_sha256'][name]
    assert digest([r for r in read('manufacturers') if r['manufacturer']!='Labmate'])==audit['baseline_semantic_sha256']['manufacturers']

def test_new_price_photo_and_purdue_evidence_do_not_acquire_stronger_status():
    audit=review();rows=audit['new_records'];designated=[r for r in read('equipment') if r['purdue_list']=='true']
    policy=json.loads((ROOT/'webapp/app/data/msrp-policy.json').read_text(encoding='utf-8'))
    assert len(designated)==44
    for r in rows:
        assert r['manufacturer']=='Labmate' and r['catalog_scope']=='manufacturer_catalog'
        assert r['manufacturer_price_kind']=='published_price' and r['manufacturer_price_currency']=='USD'
        assert Decimal(r['manufacturer_price_value'])>30 and not r['msrp_value']
        assert benchmark(r,policy) is None
        assert r['manual_match_status']=='manufacturer_specification' and not r['manual_url']
        assert r['technical_spec_url'] and r['image_source_url']==r['product_page_url']
        assert not matches_purdue(r,designated) and r['purdue_list']=='false'
        assert 'not literature' in r['association_basis']
    p={r['equipment_id']:r for r in audit['instrument_prices']}
    assert len(p)==8 and all(o['currency_basis_url']=='https://www.labmate.com/privacy-policy' for o in p.values())
    assert all(o['supplier_sku'] in next(r for r in rows if r['equipment_id']==o['equipment_id'])['product_page_url'].upper() for o in p.values())
    brand=audit['manufacturer_record']
    assert brand['research_use_status']=='research_supplier_claim_only' and brand['verification_basis']!='user_confirmation'

def test_claims_resolve_with_supplier_scope_and_no_private_inventory():
    audit=review();evidence={e['evidence_id']:e for e in evidence_dataset(ROOT)['records']}
    ids={e['evidence_id'] for e in audit['instrument_images']+audit['instrument_prices']}|set(audit['identity_evidence_ids'])
    assert len(ids)==audit['summary']['new_source_claims']==25 and ids<=evidence.keys()
    for p in audit['instrument_images']:
        assert p['verification']['status']==200 and p['verification']['content_type'].startswith('image/')
    assert audit['summary']['new_component_offers']==audit['summary']['manufacturer_green_stars_added']==0
    assert 'C:\\Users\\' not in json.dumps(audit)
    assert json.loads((ROOT/'webapp/app/data/purdue-inventory.json').read_text(encoding='utf-8'))==[]
