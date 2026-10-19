import json
from collections import Counter
from catalog_tools import ROOT, load_csv
from price_policy import with_msrp_estimates
from purdue_review import matches_purdue


def test_new_classes_have_scoped_model_evidence_without_inheriting_purdue_ownership():
    report=json.loads((ROOT/'catalog/process_slot_completion_2026-10-16.json').read_text(encoding='utf-8'))
    records={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    classes={c['category_id']:c for c in report['new_categories']}
    assert len(classes)==11 and len(report['new_records'])==93 and sum(r['catalog_scope'] not in {'mit_nano_expansion','mit_class_expansion','citation_sweep_2026_10_17','institution_reported'} for r in records.values())==858+len(json.loads((ROOT/'catalog/class_implementation_2026-10-17.json').read_text(encoding='utf-8'))['new_records'])
    counts=Counter(r['category_id'] for r in report['new_records'])
    assert set(counts)==set(classes) and all(1<=n<=10 for n in counts.values())
    assert counts['M80']==1  # Only one evidenced custom chamber; no invented market equivalents.
    for addition in report['new_records']:
        row=records[addition['equipment_id']]
        assert all(row[k]==v for k,v in addition.items() if k!='sources')
        assert row['product_page_url'] and row['model_evidence_url'] and addition['sources']
        assert row['catalog_scope']=='process_slot_gap_expansion'
        assert row['purdue_list']=='false'
        assert not row['source_pdf'] and not row['source_page'] and not row['source_record_id']
        if row['image_url']:
            assert row['image_source_url'] and row['image_scope']
    steps=load_csv(ROOT/'catalog/route_steps.csv')
    assert len(report['process_steps_review'])==29
    assert not any(json.loads(s['requirements_json'])['unresolved_required_equipment'] for s in steps if s['requirements_json'])


def test_purdue_review_uses_exact_make_model_instead_of_category_or_family():
    designated=[{'manufacturer':'Renishaw','model_name':'Renishaw AM400'},
                {'manufacturer':'Universal Robots','model_name':'UR12e'}]
    assert matches_purdue({'manufacturer':'RENISHAW','model_name':'AM-400'},designated)
    assert not matches_purdue({'manufacturer':'Renishaw','model_name':'AM500'},designated)
    assert not matches_purdue({'manufacturer':'Universal Robots','model_name':'UR30','category_id':'M62'},designated)
    assert not matches_purdue({'manufacturer':'','model_name':'AM400'},designated)
    report=json.loads((ROOT/'catalog/purdue_new_model_review_2026-10-16.json').read_text(encoding='utf-8'))
    assert report['reviewed_new_profiles']==189 and report['exact_matches']==0
    assert len(report['records'])==189
    assert sum(r['purdue_list']=='true' for r in load_csv(ROOT/'catalog/equipment.csv'))==44


def test_msrp_formula_uses_dated_anchors_and_rejects_inverted_ranges():
    policy=json.loads((ROOT/'webapp/app/data/msrp-policy.json').read_text(encoding='utf-8'))
    def row(eid,value=''):
        return dict(equipment_id=eid,manufacturer='Maker',model_name=eid,category_id='M99',category_name='Test',msrp_value=value,msrp_currency='USD',price_source_url='https://maker.test/'+eid,price_checked_date='2026-10-16')
    target=with_msrp_estimates([row('low','1000'),row('high','5000'),row('target')],[],policy)[-1]
    assert (target['estimated_msrp_low'],target['estimated_msrp_high'])==('1200','4000')
    relation=dict(equipment_id='low',manufacturer='Maker',model_name='low',lifecycle_status='newer_model_confirmed',successor_relationship='direct_successor',successor_model_name='target',successor_evidence_url='https://maker.test/news',successor_product_url='https://maker.test/target')
    target=with_msrp_estimates([row('low','1000'),row('high','5000'),row('target')],[relation],policy)[-1]
    assert target['estimate_method']=='older_model_plus_20' and target['estimated_msrp_low']==target['estimated_msrp_high']=='1200'
    invalid=with_msrp_estimates([row('low','1000'),row('target')],[],policy)[-1]
    assert invalid['estimate_status']=='inverted_range' and not invalid['estimated_msrp_low']


def test_exported_model_estimates_reproduce_the_offline_seed():
    seed=json.loads((ROOT/'webapp/app/data/catalog.json').read_text(encoding='utf-8'))
    computed=with_msrp_estimates(seed['records'],seed['model_lifecycle'],seed['msrp_policy'])
    export=load_csv(ROOT/'catalog/equipment_msrp_estimates.csv')
    assert len(export)==len(computed)==len(seed['records'])
    for saved,current in zip(export,computed):
        assert all(value==current[key] for key,value in saved.items())
