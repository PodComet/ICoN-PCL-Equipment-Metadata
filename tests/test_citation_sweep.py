import json
from catalog_tools import ROOT, inspect_catalog, load_csv
from reference_tools import read_database, reference_id, validate_database


def test_manufacturing_sweep_has_complete_traceable_additions():
    audit=json.loads((ROOT/'catalog/citation_sweep_2026-10-16.json').read_text(encoding='utf-8'))
    data=read_database();assert validate_database(data)
    records={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    summary=audit['summary']
    assert len(audit['parent_articles'])==summary['parent_articles']==10
    assert all(2024<=int(p['publication_year'])<=2026 for p in audit['parent_articles'])
    assert len(audit['new_equipment_ids'])==summary['new_equipment_records']==12
    assert len(audit['new_reference_ids'])==summary['new_reference_records']==11
    for eid in audit['new_equipment_ids']:
        record=records[eid]
        assert record['catalog_scope']=='literature_reported'
        assert record['purdue_list']=='false' and not record['msrp_value'] and not record['manual_url']
        claims=[l for l in data['reference_links'] if l['target_type']=='equipment' and l['target_id']==eid]
        assert claims and all(l['review_status']=='claim_checked' and l['locator'] and l['scope'] for l in claims)
    assert inspect_catalog()['core_examples']==590


def test_exact_hardware_claims_preserve_preprint_and_inventory_scope():
    data=read_database();pre=reference_id('10.48550/arxiv.2309.00349')
    published=reference_id('10.1002/adfm.202312561')
    refs={r['reference_id']:r for r in data['references']}
    assert refs[pre]['publication_status']=='preprint'
    assert refs[published]['publication_status']=='published'
    for eid in ['LIT-M07-YOO2023','LIT-M62-YOO2023-RG2','M02-05','REQ-EQ-020']:
        claims=[l for l in data['reference_links'] if l['target_type']=='equipment' and l['target_id']==eid]
        assert len(claims)==1 and claims[0]['reference_id']==pre
        assert 'Purdue' in claims[0]['scope']
    # Manufacturer-only apparatus must never be relabeled as a precise existing model.
    records={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    assert 'unreported' in records['LIT-M26-SCAFFARO2024']['model_name']
    assert 'unreported' in records['LIT-M05-ELLIS2018']['model_name']


def test_new_processes_keep_source_sequences_and_required_evidence():
    audit=json.loads((ROOT/'catalog/citation_sweep_2026-10-16.json').read_text(encoding='utf-8'))
    data=read_database();steps=load_csv(ROOT/'catalog/route_steps.csv')
    routes={r['route_id']:r for r in load_csv(ROOT/'catalog/routes.csv')}
    assert len(audit['new_route_ids'])==9
    for rid in audit['new_route_ids']:
        assert routes[rid]['route_kind']=='manufacturing_process'
        seq=[s for s in steps if s['route_id']==rid]
        assert [int(s['step_order']) for s in seq]==list(range(1,len(seq)+1))
        assert all(s['equipment_sequence'] and s['source_page'] for s in seq)
        assert any(l['target_type']=='route' and l['target_id']==rid and l['relation']=='supports_claim' for l in data['reference_links'])
    assert len([s for s in steps if s['route_id'] in audit['new_route_ids']])==36
    assert 'rotary' not in ' '.join(s['equipment_category_ids'].lower() for s in steps if s['route_id']=='P17')
    assert 'M16' not in routes['P17']['equipment_category_ids']
    assert 'M18' not in routes['P15']['equipment_category_ids']
    # Existing process evidence is added without pretending all class models were used.
    assert {'P06','P09','P13','P14'}<={l['target_id'] for l in data['reference_links'] if l['relation']=='supports_claim' and l['target_type']=='route'}
