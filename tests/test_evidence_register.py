import json
from pathlib import Path
from evidence_tools import dataset,markdown
ROOT=Path(__file__).resolve().parents[1]

def test_public_register_resolves_scientific_and_manual_claims_with_related_context():
    data=dataset(ROOT);records={r['evidence_id']:r for r in data['records']}
    assert len(records)==331
    r=records['EV-P27-F76AC76B7316008E']
    assert r['sources'][0]['locator']=='Materials and methods: Microfluidic-assisted nanoparticle formulation'
    assert any(x['record_type']=='process' and x['record_id']=='P27' for x in r['related_records'])
    assert r['context']['source_contexts'][0]['value']=='10'
    assert r['context']['source_contexts'][0]['unit']=='mg/mL'
    assert records['TC-M02']['context']['verification']['status']=='verified'
    assert all(r['sources'] and r['scope'] and r['record_kind']=='source_claim' for r in records.values())

def test_generated_readable_register_is_reproducible_and_has_no_private_planning_records():
    data=dataset(ROOT)
    assert json.loads((ROOT/'catalog/evidence_registry.json').read_text(encoding='utf-8'))==data
    assert (ROOT/'docs/evidence-register.md').read_text(encoding='utf-8')==markdown(data)
    assert all(not r['evidence_id'].startswith(('SEQ-EV-','ACT-EV-','COMBO-EV-')) for r in data['records'])
