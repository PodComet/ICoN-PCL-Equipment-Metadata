import json
from catalog_tools import ROOT, load_csv, inspect_catalog

def later_updates():
    report=json.loads((ROOT/"catalog/link_review_2026-10-17-sellers.json").read_text(encoding="utf-8"))
    overrides={u["equipment_id"]:dict(u["after"]) for u in report["equipment_updates"]}
    pricing=json.loads((ROOT/'catalog/price_review_2026-10-17.json').read_text(encoding='utf-8'))
    for update in pricing['equipment_updates']:
        for group in update['groups']:
            overrides.setdefault(update['equipment_id'],{}).update(group['after'])
    media=json.loads((ROOT/'catalog/manufacturer_media_review_2026-10-17.json').read_text(encoding='utf-8'))
    for update in media['equipment_updates']:
        overrides.setdefault(update['equipment_id'],{}).update(update['after'])
    return report,overrides



def test_market_expansion_adds_evidenced_alternatives_to_all_existing_m_classes():
    report=json.loads((ROOT/'catalog/market_expansion_2026-10-16.json').read_text(encoding='utf-8'))
    rows={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    assert len(report['new_records'])==96 and len(report['category_counts'])==68
    assert report['before']['records']==669 and report['after']['records']==sum(r['catalog_scope'] not in {'process_slot_gap_expansion','class_implementation_expansion','mit_nano_expansion','mit_class_expansion','citation_sweep_2026_10_17'} for r in rows.values())==765
    assert all(r['added']>=1 and r['after']>=5 for r in report['category_counts'])
    _, overrides=later_updates()
    for addition in report['new_records']:
        r=rows[addition['equipment_id']]
        assert all(r[k]==overrides.get(r['equipment_id'],{}).get(k,v) for k,v in addition.items() if k!='sources')
        assert r['model_evidence_url'] and r['product_page_url'] and addition['sources']
        assert r['catalog_scope']=='market_expansion' and r['purdue_list']=='false'
        assert not any(r[k] for k in ['source_pdf','source_page','requested_ids','institution_label','source_record_id'])
        assert 'Class-level' in r['association_basis'] and 'No model-specific literature use' in r['association_basis']
    reviews={r['equipment_id']:r for r in load_csv(ROOT/'catalog/model_lifecycle.csv')}
    for addition in report['new_records']:
        r=reviews[addition['equipment_id']]
        assert r['review_method']=='primary_source_identity_only' and r['lifecycle_status']=='model_unresolved'
        assert not r['successor_product_url']
    assert inspect_catalog()['highlighted_equipment_records']==44


def test_prices_media_and_existing_updates_retain_scoped_evidence():
    report=json.loads((ROOT/'catalog/market_expansion_2026-10-16.json').read_text(encoding='utf-8'))
    rows={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    later,overrides=later_updates()
    additions={field:sum(not g['before'].get(field) and bool(g['after'].get(field)) for u in later['updates'] if rows[u['equipment_id']]['catalog_scope'] not in {'process_slot_gap_expansion','class_implementation_expansion','mit_nano_expansion','mit_class_expansion','citation_sweep_2026_10_17'} for g in u['groups'] if field in g['after']) for field in ['image_url','manufacturer_price_value']}
    media=json.loads((ROOT/'catalog/manufacturer_media_review_2026-10-17.json').read_text(encoding='utf-8'))
    for field in additions:
        additions[field]+=sum(not u['before'].get(field) and bool(u['after'].get(field)) for u in media['equipment_updates'])
    assert report['after']['photos']==293
    assert sum(bool(r['image_url']) for r in rows.values() if r['catalog_scope'] not in {'process_slot_gap_expansion','class_implementation_expansion','mit_nano_expansion','mit_class_expansion','citation_sweep_2026_10_17'})==293+additions['image_url']+sum('photo' in e['changes'] for e in json.loads((ROOT/'catalog/mit_nano_review_2026-10-17.json').read_text(encoding='utf-8'))['enriched'])
    prices=json.loads((ROOT/'catalog/price_review_2026-10-17.json').read_text(encoding='utf-8'))
    priced_later=sum(not g['before']['manufacturer_price_value'] and bool(g['after']['manufacturer_price_value']) for u in prices['equipment_updates'] for g in u['groups'])
    assert sum(bool(r['manufacturer_price_value']) for r in rows.values() if r['catalog_scope'] not in {'process_slot_gap_expansion','class_implementation_expansion','mit_nano_expansion','mit_class_expansion','citation_sweep_2026_10_17'})==58+additions['manufacturer_price_value']+priced_later
    assert len(report['updates'])==33
    for update in report['updates']:
        assert update['sources'] and all(rows[update['equipment_id']][k]==overrides.get(update['equipment_id'],{}).get(k,v) for k,v in update['after'].items())
    for r in rows.values():
        if r['category_id']=='M66' and r['catalog_scope']=='market_expansion':
            assert 'PACK OF' in r['manufacturer_price_scope'] or 'sales roll' in r['manufacturer_price_scope']
            assert r['msrp_value']=='' and r['record_kind']=='commercial_dialysis_component'
    assert rows['EXP-20261016-M12-PQ-N4']['manufacturer_price_value']==''
    assert 'P13' not in rows['EXP-20261016-M61-RIE-800IP-ALE']['related_process_ids'].split(';')
    assert 'P14' in rows['EXP-20261016-M61-RIE-800IP-ALE']['related_process_ids'].split(';')


def test_starting_material_examples_are_derived_from_existing_academic_references():
    profiles=load_csv(ROOT/'catalog/process_material_profiles.csv')
    examples=load_csv(ROOT/'catalog/process_material_examples.csv')
    seed=json.loads((ROOT/'webapp/app/data/process-materials.json').read_text(encoding='utf-8'))
    assert len([r for r in profiles if r['route_id'] not in {'P44','P45'}])==42 and len(examples)==4
    refs={r['reference_id'] for r in load_csv(ROOT/'catalog/references.csv')}
    for source,built in zip(examples,seed['examples']):
        assert set(source['reference_ids'].split(';'))<=refs
        assert built['inputs']==json.loads(source['inputs_json']) and 'inputs_json' not in built
        assert source['source_locator'] and source['scope'] and source['checked_date']=='2026-10-16'
    assert all(p['suggestions'] and 'suggestions_json' not in p for p in seed['profiles'])
