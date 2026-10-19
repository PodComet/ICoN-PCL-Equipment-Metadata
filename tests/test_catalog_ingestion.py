import csv,json
from pathlib import Path
from component_tools import dataset
from evidence_tools import dataset as evidence_dataset
from ontology_tools import artifacts
ROOT=Path(__file__).resolve().parents[1]
def read(name):
    with (ROOT/'catalog'/name).open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))

def test_vendor_pack_grades_and_source_substitutions_remain_scoped():
    data=dataset(ROOT);offers=[o for o in data['offers'] if o['offer_id'].startswith('PACK-USNANO261018-')]
    assert len(offers)==38 and len({o['component_id'] for o in offers})==17
    assert len(data['market_components'])==32
    assert all(o['currency']=='USD' and o['sku'] and o['source_url'] and o['price_value']>0 for o in offers)
    assert all('FOB Houston' in o['notes'] and 'MSRP' in o['notes'] for o in offers)
    source_lines=[c for f in data['formulations'] for c in f['components']]
    accepted=[c for c in source_lines if any(i.startswith('PACK-USNANO') for i in c['eligible_offer_ids'])]
    assert {c['line_id'] for c in accepted}=={'P08-LITERATURE-EXAMPLE-C01','P34-SOURCE-01-C01'}
    assert all('source' in c['scope'].lower() or c['source_title'] for c in data['market_components'])

def test_ucla_records_keep_inventory_prices_configuration_and_manual_scope_honest():
    rows=[r for r in read('equipment.csv') if r['equipment_id'].startswith('UCLA-')]
    assert len(rows)==14 and all(r['purdue_list']=='false' for r in rows)
    assert all(not r['msrp_value'] and not r['manufacturer_price_value'] for r in rows)
    assert sum(bool(r['image_url']) for r in rows)==10
    gen=[r for r in rows if r['manufacturer']=='Veeco']
    assert len(gen)==2 and len({r['product_family_id'] for r in gen})==1
    assert {r['equipment_subtype'] for r in gen}=={'pa_nitride_mbe','arsenide_antimonide_mbe'}
    assert all(r['manual_match_status']!='verified_operating_manual' for r in rows)
    report=json.loads((ROOT/'catalog/ucla_inml_review_2026-10-18.json').read_text())
    assert report['integration']['summary']['current_equipment_prices_added']==0

def test_all_adopted_claims_have_readable_public_evidence_without_local_paths():
    records=evidence_dataset(ROOT)['records']
    assert len([r for r in records if r['classification']=='curator_reviewed_catalog' and any(s['url'].startswith('https://inml.cnsi.ucla.edu/') for s in r['sources'])])==33
    prices=[r for r in records if any(q['record_id'].startswith('PACK-USNANO') for q in r['related_records'])]
    # Later scheduled rechecks append observations without replacing the original review.
    archived_prices=[r for r in prices if r['recorded_at']=='2026-10-18']
    assert len(archived_prices)==38 and all(r['context']['currency_basis'] for r in prices)
    assert not any('C:\\Users\\' in json.dumps(r) for r in prices)
    assert all(r['sources'] and r['scope'] for r in records)

def test_parallel_capability_branches_survive_public_ontology_export():
    outputs,report=artifacts(ROOT)
    p46=next(s for s in report['source_sequences'] if s['route_id']=='P46')
    assert p46['levels'][-1]==['P46:4','P46:5','P46:6']
    assert report['counts']['unreviewed_model_name_pairs']==0
