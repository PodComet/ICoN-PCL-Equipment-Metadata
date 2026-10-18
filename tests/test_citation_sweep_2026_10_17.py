import json
from catalog_tools import ROOT, load_csv
from reference_tools import read_database, validate_database
from component_tools import dataset


def test_new_citation_records_have_scoped_claims_and_do_not_expose_inventory():
    audit=json.loads((ROOT/'catalog/citation_sweep_2026-10-17.json').read_text(encoding='utf-8'))
    assert audit['summary']['parent_articles']==31
    assert len(load_csv(ROOT/'catalog/cited_reference_inventory_2026-10-17.csv'))==1994
    data=read_database();assert validate_database(data)
    assert len(audit['new_reference_ids'])==10
    assert all(any(l['reference_id']==rid and l['relation']=='supports_claim' for l in data['reference_links']) for rid in audit['new_reference_ids'])
    rows={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    assert len(audit['new_equipment_ids'])==17
    for eid in audit['new_equipment_ids']:
        row=rows[eid]
        assert row['catalog_scope']=='citation_sweep_2026_10_17'
        assert row['purdue_list']=='false' and not row['requested_ids']
        assert not row['msrp_value'] and not row['manufacturer_price_value']
    legacy=rows['SW17-M51-3688D8C50C4C']
    assert '3085A' not in legacy['model_name'] and not legacy['technical_spec_url']


def test_new_processes_have_dedicated_classes_and_source_scoped_inputs():
    data=dataset(ROOT);steps=load_csv(ROOT/'catalog/route_steps.csv')
    for rid,expected in [('P44',5),('P45',7)]:
        sequence=[s for s in steps if s['route_id']==rid]
        assert len(sequence)==expected
        assert all(s['equipment_category_ids'] and json.loads(s['requirements_json'])['required_branches'] for s in sequence)
        formulation=next(f for f in data['formulations'] if f['route_id']==rid)
        assert formulation['reference_ids'] and formulation['components']
        assert all(c['quantity_value'] is None for c in formulation['components'])
    sonication=next(s for s in steps if s['route_id']=='P45' and s['step_order']=='5')
    assert json.loads(sonication['requirements_json'])['required_branches']==[['M09'],['M10']]


def test_output_quantity_models_keep_retention_assumptions_separate_from_reported_yields():
    models=dataset(ROOT)['output_quantity_models']
    assert len(models)==4
    assert all(m['basis'] in {'theoretical_mass_ceiling','nominal_carrier_volume'} for m in models)
    assert all(m['source_url'] and m['source_locator'] and m['scope'] for m in models)
