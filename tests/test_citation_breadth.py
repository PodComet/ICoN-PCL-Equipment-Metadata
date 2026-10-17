import json
from catalog_tools import ROOT, inspect_catalog, load_csv
from reference_tools import read_database, reference_id, validate_database


def test_breadth_review_records_decisions_without_claiming_complete_bibliographies():
    audit=json.loads((ROOT/'catalog/citation_breadth_2026-10-16.json').read_text(encoding='utf-8'))
    data=read_database();assert validate_database(data)
    ledger=load_csv(ROOT/'catalog/citation_review_2026-10-16-breadth.csv')
    assert len(ledger)==audit['summary']['candidate_review_records']==50
    assert 'does not complete an exhaustive' in audit['scope']
    assert len(audit['studies'])==len(audit['new_reference_ids'])==14
    assert all(s['parent_chain'] and s['locator'] and s['source_url'] and s['version'] for s in audit['studies'])
    assert sum(bool(r['used_reference_id']) for r in ledger)==14
    held=[r for r in ledger if r['decision']=='held_integrity_notice']
    conflicts=[r for r in ledger if r['decision']=='exclude_bibliographic_identity_conflict']
    assert len(held)==1 and len(conflicts)==2
    assert not {r['cited_doi'] for r in held+conflicts}&{r['doi'].lower() for r in data['references']}
    new_ids=set(audit['new_reference_ids'])
    assert sum(l['relation']=='supports_claim' and l['reference_id'] in new_ids for l in data['reference_links'])==72


def test_new_routes_keep_source_stages_and_do_not_force_unrelated_equipment_classes():
    routes={r['route_id']:r for r in load_csv(ROOT/'catalog/routes.csv')}
    steps=load_csv(ROOT/'catalog/route_steps.csv')
    for n in range(24,36):
        rid=f'P{n}';seq=[s for s in steps if s['route_id']==rid]
        assert [int(s['step_order']) for s in seq]==list(range(1,len(seq)+1))
        assert all(s['equipment_sequence'] and s['source_page'] for s in seq)
    assert len([s for s in steps if s['route_id'] in {f'P{n}' for n in range(24,36)}])==52
    assert routes['P30']['equipment_category_ids']=='M66'
    assert 'M15' not in routes['P30']['equipment_category_ids']
    assert set(routes['P35']['equipment_category_ids'].split(';'))=={'M74','M19','M20','M75','M64','M65','M84'}
    assert routes['P35']['related_material_ids']=='N10'
    calcine=next(s for s in steps if s['route_id']=='P32' and s['step_order']=='4')
    assert json.loads(calcine['requirements_json'])['required_branches']==[['M18','M81','M20']]
    assert json.loads(calcine['requirements_json'])['readiness_review_required']
    assert 'do not identify the unreported original' in json.loads(calcine['requirements_json'])['notes']
    assert routes['N10']['route_kind']=='material_family'
    assert not [s for s in steps if s['route_id']=='N10']  # No invented universal composite process.


def test_model_claims_preserve_version_stage_and_controller_identity_limits():
    data=read_database();links=data['reference_links']
    for eid,doi in [('LIT-M07-NATHANAEL2023','10.48550/arxiv.2303.10469'),('LIT-M21-LI2024','10.48550/arxiv.2404.01006')]:
        claim=next(l for l in links if l['target_type']=='equipment' and l['target_id']==eid)
        assert claim['reference_id']==reference_id(doi)
    for eid,doi in [('M11-04','10.1021/am302624t'),('M07-09','10.1039/d4dd00104d')]:
        assert any(l['target_type']=='equipment' and l['target_id']==eid and l['reference_id']==reference_id(doi) for l in links)
    records={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    assert 'unresolved' in records['LIT-M63-REICHEL2017']['notes']
    assert not any('888 Titrando'==r['model_name'] for r in records.values())
    assert not any('5430R' in r['model_name'] for r in records.values())
    for eid in ['LIT-M50-MARTINEZ2020','LIT-M10-MARTINEZ2020']:
        assert records[eid]['related_process_ids']=='P08'
        assert '2.4' in next(l['locator'] for l in links if l['target_type']=='equipment' and l['target_id']==eid)
    assert inspect_catalog()['core_examples']==590


def test_literature_extensions_keep_inventory_prices_and_market_review_separate():
    audit=json.loads((ROOT/'catalog/citation_breadth_2026-10-16.json').read_text(encoding='utf-8'))
    records={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    life={r['equipment_id']:r for r in load_csv(ROOT/'catalog/model_lifecycle.csv')}
    makers={r['manufacturer']:r for r in load_csv(ROOT/'catalog/manufacturers.csv')}
    for eid in audit['new_equipment_ids']:
        r=records[eid]
        assert r['catalog_scope']=='literature_reported' and r['purdue_list']=='false'
        assert not r['msrp_value'] and not r['manufacturer_price_value']
        assert life[eid]['lifecycle_status']=='model_unresolved'
    assert makers['Shenzhen Shuangping Power Technology Co. Ltd.']['brand_identity_status']=='needs_review'
    assert records['LIT-M63-DOSIMAT805']['manual_match_status']=='verified_operating_manual'
    assert '2025' in records['LIT-M63-DOSIMAT805']['manual_scope']
