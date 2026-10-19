import json
from catalog_tools import ROOT, inspect_catalog, load_csv
from reference_tools import reference_id, read_database, validate_database


def test_starting_parent_dates_are_separate_from_unrestricted_cited_years():
    audit=json.loads((ROOT/'catalog/citation_all_years_2026-10-16.json').read_text(encoding='utf-8'))
    inventory=load_csv(ROOT/'catalog/cited_reference_inventory_2026-10-16.csv')
    assert len(audit['parent_scope'])==7
    assert all(p['publication_year']>2024 for p in audit['parent_scope'])
    assert len(inventory)==len({r['review_id'] for r in inventory})==630
    assert sum(p['deposited_reference_entries'] for p in audit['parent_scope'])==630
    assert all(int(r['parent_year'])>2024 for r in inventory)
    assert any(r['cited_year_as_printed'] and int(r['cited_year_as_printed'])<2020 for r in inventory)
    assert any(not r['cited_year_as_printed'] for r in inventory)
    assert sum(r['review_depth']=='pending' for r in inventory)==543
    assert all(not r['reviewed_date'] for r in inventory if r['review_depth']=='pending')
    assert len([s for s in audit['studies'] if s['hop']==2])==3
    assert len([s for s in audit['studies'] if not s['context_only']])==9
    assert all(int(s['publication_year'])<2024 for s in audit['studies'] if not s['context_only'])


def test_new_methods_and_exact_model_claims_keep_their_source_scope():
    data=read_database();assert validate_database(data)
    refs={r['reference_id']:r for r in data['references']};links=data['reference_links']
    records={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    audit=json.loads((ROOT/'catalog/citation_all_years_2026-10-16.json').read_text(encoding='utf-8'))
    assert len(audit['new_reference_ids'])==10 and len(audit['new_equipment_ids'])==8
    assert refs[reference_id('10.1021/acsami.2c22162')]['publication_year']=='2023'
    assert any(l['reference_id']==reference_id('10.1016/j.polymdegradstab.2023.110278') and l['target_id']=='LIT-M67-EXAKT80E' for l in links)
    assert not any(l['reference_id']==reference_id('10.1021/acsami.2c22162') and l['target_id']=='LIT-M67-EXAKT80E' for l in links)
    char=next(l for l in links if l['reference_id']==reference_id('10.1021/acsami.2c22162') and l['target_id']=='M57-03')
    assert 'Characterization only' in char['scope']
    assert any(l['reference_id']==reference_id('10.1016/j.wear.2019.202944') and l['target_id']=='M12-04' for l in links)
    assert 'P41' in records['M12-04']['related_process_ids'].split(';')
    for eid in audit['new_equipment_ids']:
        r=records[eid]
        assert r['purdue_list']=='false' and r['catalog_scope']=='literature_reported'
        assert not r['msrp_value'] and not r['manufacturer_price_value']
    assert inspect_catalog()['core_examples']==590


def test_new_processes_keep_classified_and_unclassified_stages_explicit():
    routes={r['route_id']:r for r in load_csv(ROOT/'catalog/routes.csv')}
    steps=load_csv(ROOT/'catalog/route_steps.csv')
    for n in range(36,43):
        seq=[s for s in steps if s['route_id']==f'P{n}' and not s.get('extension_id')]
        assert [int(s['step_order']) for s in seq]==list(range(1,len(seq)+1))
        assert any(s['equipment_category_ids'] for s in seq)
        for stage in seq:
            req=json.loads(stage['requirements_json'])
            assert not req['unresolved_required_equipment']
            if not stage['equipment_category_ids']:
                assert not any(req['required_branches'])
        assert all(s['equipment_sequence'] and s['source_page'] for s in seq)
    assert routes['P42']['equipment_category_ids']=='M24;M59;M68;M85;M115;M114'
    assert routes['P41']['equipment_category_ids']=='M12;M69;M88;M94;M98;M99'
    assert set(routes['P37']['equipment_category_ids'].split(';'))=={'M67','M02','M31','M71','M87'}
    assert routes['P36']['equipment_category_ids']=='M53;M15'
