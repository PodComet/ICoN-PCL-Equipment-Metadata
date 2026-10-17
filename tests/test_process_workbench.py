import json
from catalog_tools import ROOT, load_csv


def test_every_preexisting_process_stage_has_explicit_reviewed_requirements():
    steps=load_csv(ROOT/'catalog/route_steps.csv')
    rows=[s for s in steps if s['route_id'].startswith('P') and s['route_id']!='P43' and not s.get('extension_id')]
    assert len(rows)==172
    known={c['category_id'] for c in load_csv(ROOT/'catalog/categories.csv')}
    for s in rows:
        req=json.loads(s['requirements_json'])
        assert isinstance(req['required_branches'],list) and isinstance(req['optional_category_ids'],list)
        assert all(c in known for b in req['required_branches'] for c in b)
        assert all(c in known for c in req['optional_category_ids'])
        assert type(req['unresolved_required_equipment']) is bool
        assert type(req['readiness_review_required']) is bool
        assert req['notes']
    assert sum(json.loads(s['requirements_json'])['unresolved_required_equipment'] for s in rows)==0
    implementation=json.loads((ROOT/'catalog/class_implementation_2026-10-17.json').read_text(encoding='utf-8'))
    additional_reviews=sum(not m['previous_requirements']['readiness_review_required'] for m in implementation['process_links'] if 'previous_requirements' in m)
    assert sum(json.loads(s['requirements_json'])['readiness_review_required'] for s in rows)==json.loads((ROOT/'catalog/mit_class_expansion_2026-10-17.json').read_text(encoding='utf-8'))['summary']['additional_existing_stage_reviews']+50+additional_reviews+sum(not json.loads(c['before']['requirements_json'])['readiness_review_required'] for c in json.loads((ROOT/'catalog/process_class_refinement_2026-10-17.json').read_text(encoding='utf-8'))['changes'] if c['step_id'].startswith('P'))
    pump=next(s for s in rows if s['route_id']=='P27' and s['step_order']=='2')
    assert json.loads(pump['requirements_json'])['required_branches']==[['M07','M07']]
    assert sum(s['source_pdf']=='Nanomaterial_Manufacturing_Equipment_Sequenced_Manuals.pdf' for s in steps)==109


def test_position_roadmap_is_model_bound_and_never_fabricates_operating_states():
    records={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    index=load_csv(ROOT/'catalog/equipment_position_lists.csv')
    assert len(index)==len(records)
    assert {r['equipment_id'] for r in index}==set(records)
    assert all(r['model_name']==records[r['equipment_id']]['model_name'] for r in index)
    assert sum(r['review_status']=='not_started' and r['position_count']=='0' for r in index)==len(records)-1
    library=json.loads((ROOT/'catalog/position_interfaces.json').read_text(encoding='utf-8'))
    profile=library['profiles'][0];interface=profile['interface']
    assert profile['equipment_id']=='EXT-M70-OPENTRONS-GEN2'
    assert interface['schema']=='poly-fibers/v2' and len(interface['fibers'])==2
    entries=library['evidence'][0]['entries'];known={e['id'] for e in entries}
    assert len(entries)==len(known)==10
    assert sum(e['classification']=='manufacturer_fact' and e['verification']['status']=='verified' for e in entries)==8
    assert sum(e['classification']=='model_assumption' and e['verification']['status']=='draft' for e in entries)==2
    for fiber in interface['fibers']:
        assert set(fiber['evidence_ids'])<=known
        for direction in fiber['directions']:
            assert set(direction['evidence_ids'])<=known
    assert set(interface['evidence_ids'])<=known


def test_control_interface_example_does_not_become_a_nanomaterial_route_claim():
    records={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    tc=records['EXT-M70-OPENTRONS-GEN2'];old=records['EXT-M70-OPENTRONS-GEN1']
    assert tc['manual_match_status']=='verified_operating_manual'
    assert tc['manufacturer_price_value']=='10230' and tc['manufacturer_price_kind']=='starting_price'
    assert not tc['msrp_value'] and not tc['related_material_ids']
    assert not old['manual_url'] and not old['image_url'] and not old['manufacturer_price_value']
    route=next(r for r in load_csv(ROOT/'catalog/routes.csv') if r['route_id']=='P43')
    assert not route['related_material_ids'] and 'control-interface example' in route['route_name']
    assert all(records[eid]['purdue_list']=='false' for eid in records if eid.startswith('EXT-'))
