import csv
import json
import shutil
from pathlib import Path

import pytest

from process_science_tools import dataset

ROOT = Path(__file__).resolve().parents[1]


def test_source_conditions_and_properties_resolve_to_scoped_evidence():
    data = dataset(ROOT)
    assert len(data['conditions']) == 289
    assert len(data['properties']) == 32
    assert len(data['evidence']) == 321
    evidence = {e['evidence_id']: e for e in data['evidence']}
    conditions = {c['template_id']: c for c in data['conditions']}
    assert len(evidence) == len(data['evidence'])
    assert len(conditions) == len(data['conditions'])
    for item in [*data['conditions'], *data['properties']]:
        source = evidence[item['evidence_id']]
        assert source['source_url'] and source['source_locator']
        assert source['reference_ids']
    for item in data['properties']:
        assert all(conditions[i]['formulation_id'] == item['formulation_id']
                   for i in item['required_condition_ids'])


def test_only_reviewed_fixed_cases_admit_expectations_and_no_interpolation():
    data = dataset(ROOT)
    admitted = [p for p in data['properties'] if p['supports_expectation']]
    assert len(admitted) == 2
    assert {p['route_id'] for p in admitted} == {'P20'}
    assert sorted(p['value'] for p in admitted) == [0.00721, 92]
    assert data['experimental_validation'] == 'future_roadmap'
    assert all(not c['interpolation_enabled'] for c in data['relationship_candidates'])
    assert any(c['operator'] == 'text' and 'overnight' in c['text_value'].lower()
               for c in data['conditions'])
    assert any(c['parameter'] == 'pressure_differential' for c in data['conditions'])
    assert any(c['parameter'] == 'compaction_pressure' for c in data['conditions'])


@pytest.mark.parametrize('change,error', [
    ({'value': 'NaN'}, 'finite'),
    ({'unit': 'kg'}, 'compatible'),
    ({'evidence_id': 'UNKNOWN'}, 'evidence'),
    ({'formulation_id': 'UNKNOWN'}, 'formulation'),
    ({'source_step_order': '999'}, 'source step'),
    ({'operator': 'range', 'value': '5', 'upper_value': '1'}, 'range'),
])
def test_invalid_ingestion_fails_before_app_export(tmp_path, change, error):
    shutil.copytree(ROOT / 'catalog', tmp_path / 'catalog')
    path = tmp_path / 'catalog/process_conditions.csv'
    with path.open(encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        rows = list(reader)
    row = next(r for r in rows if r['operator'] == 'eq' and r['value'])
    row.update(change)
    with path.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)
    with pytest.raises(ValueError, match=error):
        dataset(tmp_path)


def test_committed_app_science_is_reproducible_from_canonical_csvs():
    expected = dataset(ROOT)
    actual = json.loads((ROOT / 'webapp/app/data/process-science.json').read_text(encoding='utf-8'))
    assert actual == expected
