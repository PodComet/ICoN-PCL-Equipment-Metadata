import json
from catalog_tools import ROOT, load_csv
from market_tools import seller_offers
from price_policy import benchmark

def test_seller_offers_reproduce_the_app_and_keep_exact_model_identity():
    offers=seller_offers(ROOT)
    built=json.loads((ROOT/'webapp/app/data/seller-offers.json').read_text(encoding='utf-8'))
    assert offers==built['offers']
    assert len(offers)==len({o['offer_id'] for o in offers})>0
    assert {'new','used','unspecified'} <= {o['condition'] for o in offers}

def test_seller_prices_do_not_become_msrp_or_official_list_benchmarks():
    policy=json.loads((ROOT/'webapp/app/data/msrp-policy.json').read_text(encoding='utf-8'))
    rows={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    for offer in seller_offers(ROOT):
        record=rows[offer['equipment_id']]
        assert record['msrp_value']=='', 'A seller offer cannot establish MSRP'
        assert benchmark({'seller_price_value':offer['price_value'],'seller_price_kind':'list_price','seller_price_source_url':offer['source_url']},policy) is None

def test_sweep_reconciles_counts_and_preserves_inventory_and_manual_status():
    report=json.loads((ROOT/'catalog/link_review_2026-10-17-sellers.json').read_text(encoding='utf-8'))
    new_ids={r['equipment_id'] for r in json.loads((ROOT/'catalog/class_implementation_2026-10-17.json').read_text(encoding='utf-8'))['new_records']}
    rows={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv') if r['equipment_id'] not in new_ids and r['catalog_scope'] not in {'mit_nano_expansion','mit_class_expansion'}}
    s=report['summary']
    media=json.loads((ROOT/'catalog/manufacturer_media_review_2026-10-17.json').read_text(encoding='utf-8'))
    overrides={u['equipment_id']:u['after'] for u in media['equipment_updates']}
    assert len(rows)==s['models']==858
    assert sum(bool(r['image_url']) for r in rows.values())==s['photos_after']+sum('photo' in e['changes'] for e in json.loads((ROOT/'catalog/mit_nano_review_2026-10-17.json').read_text(encoding='utf-8'))['enriched'])+len(media['new_photo_records'])
    assert s['photos_after']==s['photos_before']+s['new_photos']
    assert len(report['photos'])==s['new_photos']
    assert len({r['equipment_id'] for r in report['reviewed']})==s['reviewed_models']
    for update in report['updates']:
        for group in update['groups']:
            assert not {'purdue_list','category_id','manual_match_status','manual_url','source_pdf','source_page'} & group['after'].keys()
            assert all(rows[update['equipment_id']][k]==overrides.get(update['equipment_id'],{}).get(k,v) for k,v in group['after'].items())
    assert sum(r['purdue_list']=='true' for r in rows.values())==44
