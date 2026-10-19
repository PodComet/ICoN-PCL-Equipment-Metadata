import json
from catalog_tools import ROOT, load_csv

def test_functional_review_covers_all_stages_and_preserves_original_source_sequences():
    report=json.loads((ROOT/'catalog/process_class_refinement_2026-10-17.json').read_text(encoding='utf-8'))
    steps={s['route_id']+'.'+s['step_order']:s for s in load_csv(ROOT/'catalog/route_steps.csv') if not s.get('extension_id') and s['route_id'] not in {'P44','P45','P46','P47'}}
    assert set(report['audited_step_ids'])==set(steps) and len(steps)==227
    assert report['summary']['reviewed_capability_stages']==2
    assert len(report['changes'])==8
    for change in report['changes']:
        current=steps[change['step_id']]
        assert all(current[k]==v for k,v in change['after'].items() if k not in {'equipment_category_ids','requirements_json'})
        assert all(change['before'][k]==current[k] for k in ['equipment_sequence','source_pdf','source_page','step_label'])
    rinse=json.loads(steps['P05.4']['requirements_json'])
    assert rinse['required_branches']==[['M85']] and set(rinse['optional_category_ids'])=={'M46','M18'}
    assert json.loads(steps['P06.3']['requirements_json'])['required_branches']==[['M85'],['M61'],['M115']]
    assert json.loads(steps['P06.4']['requirements_json'])['required_branches']==[['M61'],['M23','M85']]
    assert json.loads(steps['N06.5']['requirements_json'])['required_branches']==[[]]
    assert set(json.loads(steps['N06.5']['requirements_json'])['optional_category_ids'])=={'M82','M17'}

def test_model_relationship_updates_have_exact_identity_and_do_not_inherit_inventory_or_model_claims():
    report=json.loads((ROOT/'catalog/process_class_refinement_2026-10-17.json').read_text(encoding='utf-8'))
    records={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    assert len(report['equipment_updates'])==24
    for update in report['equipment_updates']:
        row=records[update['equipment_id']]
        assert row['model_name']==update['model_name'] and row['manufacturer']==update['manufacturer']
        for group in update['groups']:
            assert set(group['after']) <= {'related_process_ids','related_process_types','related_material_ids','related_material_types','equipment_subtype','notes'}
            assert all(row[k]==v for k,v in group['after'].items())
        assert row['purdue_list']=='false'
    solvent=[r for r in records.values() if 'solvent_processing' in r['equipment_subtype'].split(';')]
    assert len(solvent)==2 and all(r['manufacturer']=='Modutek' for r in solvent)
    for link in report['new_reference_links']:
        assert link['target_id']=='M87' and link['review_status']=='claim_checked'
        assert 'No commercial make/model' in link['scope']
