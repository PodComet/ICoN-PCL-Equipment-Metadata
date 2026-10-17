import json
from collections import Counter
from catalog_tools import ROOT, inspect_catalog, load_csv
from market_tools import seller_offers
from purdue_review import matches_purdue

def report():
    return json.loads((ROOT/'catalog/class_implementation_2026-10-17.json').read_text(encoding='utf-8'))

def test_new_classes_have_exact_model_photos_pricing_provenance_and_inventory_review():
    review=report();records={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    additions=review['new_records'];counts=Counter(r['category_id'] for r in additions)
    assert set(counts)=={f'M{n}' for n in range(82,89)} and all(1<=n<=10 for n in counts.values())
    assert review['summary']['new_records']==len(additions)
    assert review['summary']['photos']==sum(bool(r['image_url']) for r in additions)
    offers={r['equipment_id']:r for r in seller_offers(ROOT)}
    priced=0
    designated=[r for r in records.values() if r['purdue_list']=='true']
    for addition in additions:
        row=records[addition['equipment_id']]
        assert row==addition
        assert row['image_url'] and row['image_source_url'] and row['image_scope']
        assert row['product_page_url'] and row['technical_spec_url']
        assert row['association_basis'] and row['equipment_subtype']
        assert not row['source_pdf'] and not row['source_record_id'] and not row['msrp_value']
        assert row['purdue_list']=='false' and not matches_purdue(row,designated)
        if row['manufacturer_price_value']:
            assert row['manufacturer_price_source_url'] and row['manufacturer_price_scope']
            assert row['manufacturer_price_checked_date']==review['checked_date']
            priced+=1
        elif row['equipment_id'] in offers:
            offer=offers[row['equipment_id']]
            assert offer['manufacturer']==row['manufacturer'] and offer['model_name']==row['model_name']
            assert offer['scope'] and offer['condition']
            priced+=1
    assert priced==review['summary']['published_prices']
    assert len(review['purdue_review']['records'])==len(additions)
    assert inspect_catalog()['active_m_categories']==86

def test_green_stars_have_official_and_independent_research_evidence():
    brands=report()['new_manufacturers']
    for brand in brands:
        assert brand['official_website_url'] and brand['verification_notes']
        assert brand['verification_basis']!='user_confirmation'
        if brand['research_use_status']=='documented_research_use':
            assert brand['research_evidence_url'] and brand['brand_identity_status'] in {'verified_brand','verified_manufacturer'}

def test_step_extensions_preserve_source_sequences_optional_branches_and_wet_process_scope():
    review=report();steps={s['route_id']+'.'+s['step_order']:s for s in load_csv(ROOT/'catalog/route_steps.csv')}
    for link in review['process_links']:
        step=steps[link['step_id']];req=json.loads(step['requirements_json'])
        if link['status']=='subtype_gap':
            assert link['category_id']=='M85' and not step['equipment_category_ids']
            continue
        assert step['equipment_sequence']==link['source_equipment_sequence']
        if link['status']=='optional':
            assert req['required_branches']==link['previous_requirements']['required_branches']
            assert link['category_id'] in req['optional_category_ids']
        else:
            assert [link['category_id']] in req['required_branches']
        assert req['readiness_review_required']
    wet=[r for r in review['new_records'] if r['category_id']=='M85']
    assert all(r['related_process_ids']=='P42' for r in wet)
    assert all('wafer_wet_processing' in r['equipment_subtype'] for r in wet)
