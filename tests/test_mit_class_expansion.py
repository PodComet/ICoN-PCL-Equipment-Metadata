import json
from collections import Counter
from catalog_tools import ROOT,load_csv,inspect_catalog
from market_tools import seller_offers
from purdue_review import matches_purdue

def review():return json.loads((ROOT/'catalog/mit_class_expansion_2026-10-17.json').read_text(encoding='utf-8'))

def test_eleven_new_classes_have_distinct_models_and_evidence_without_fabricated_prices():
    report=review();records={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')};new=report['models']
    counts=Counter(r['category_id'] for r in new)
    assert set(counts)=={f'M{n}' for n in range(89,100)} and all(1<=n<=10 for n in counts.values())
    assert sum(counts.values())==109 and counts['M90']==9
    assert len({(r['manufacturer'].lower(),r['model_name'].lower()) for r in new})==109
    # The expansion report is a release snapshot; later dated price research is
    # reconciled independently by test_price_coverage.py.
    offers={r['equipment_id']:r for r in seller_offers(ROOT) if not r['offer_id'].startswith('SELL-PRICE26-')}
    assert sum(bool(r['image_url']) for r in new)==report['summary']['photos']==95
    assert sum(bool(r['manufacturer_price_value']) or r['equipment_id'] in offers for r in new)==report['summary']['published_prices']==9
    for r in new:
        # Preserve this release snapshot while allowing later scoped photo fills.
        later=json.loads((ROOT/'catalog/thermo_catalog_review_2026-10-19.json').read_text(encoding='utf-8'))
        photo=next((p for p in later['instrument_images'] if p['equipment_id']==r['equipment_id']),None)
        if photo:
            assert all(r[k]==v for k,v in photo['before'].items())
        assert {**r,**(photo['after'] if photo else {})}==records[r['equipment_id']]
        assert r['product_page_url'] and r['technical_spec_url'] and r['model_evidence_url']
        assert not r['msrp_value'] and not r['source_pdf'] and not r['source_record_id']
        if r['image_url']:assert r['image_source_url'] and r['image_scope']
    assert all(not r['manufacturer_price_value'] for r in new if r['model_name']=='Photonic Professional GT2')
    assert inspect_catalog()['active_m_categories']==114

def test_purdue_exact_identity_and_brand_evidence_are_reviewed():
    report=review();designated=[r for r in load_csv(ROOT/'catalog/equipment.csv') if r['purdue_list']=='true']
    assert len(report['purdue_review'])==109
    assert all(r['purdue_list']=='false' and not matches_purdue(r,designated) for r in report['models'])
    for b in report['new_manufacturers']:
        assert b['official_website_url'] and b['research_evidence_url'] and b['verification_notes']
        assert b['verification_basis']!='user_confirmation'

def test_new_stages_are_optional_curator_extensions_and_existing_source_actions_are_retained():
    report=review();steps={s['route_id']+'.'+s['step_order']:s for s in load_csv(ROOT/'catalog/route_steps.csv')}
    assert len(report['new_stages'])==10
    for s in report['new_stages']:
        assert s==steps[s['route_id']+'.'+s['step_order']]
        assert s['extension_id'] and s['anchor_step_order']
        assert json.loads(s['requirements_json'])['required_branches']==[[]]
        assert 'Curator' in s['source_pdf'] and 'https://' in s['source_page']
    for link in report['process_links']:
        req=json.loads(steps[link['step_id']]['requirements_json'])
        if link['category_id']=='M89':assert ['M89'] in req['required_branches']
        else:assert link['category_id'] in req['optional_category_ids']
    assert json.loads(steps['P06.3']['requirements_json'])['when_selected'][0]['required_branches']==[[]]
    assert len([s for s in steps.values() if not s['extension_id'] and s['route_id'] not in {'P44','P45','P46','P47'}])==227

def test_successor_badges_have_complete_exact_model_relationships():
    report=review();ids={r['equipment_id'] for r in report['models']};reviews=[r for r in load_csv(ROOT/'catalog/model_lifecycle.csv') if r['equipment_id'] in ids]
    badges=[r for r in reviews if r['lifecycle_status']=='newer_model_confirmed']
    assert len(badges)==report['summary']['newer_model_links']==15
    assert all(r['successor_evidence_url'] and r['successor_scope'] and r['successor_product_url'] and r['successor_model_name']!=r['model_name'] for r in badges)
