"""Source integrity and semantic boundaries for CNC and computational additions."""
from collections import Counter
import json
from pathlib import Path

from catalog_tools import load_csv
from ontology_tools import node, VOCAB
from rdflib import Graph
from rdflib.namespace import RDF

ROOT=Path(__file__).resolve().parents[1]


def test_four_classes_have_ten_sourced_distinct_models_and_complete_interfaces():
    review=json.loads((ROOT/'catalog/cnc_computational_review_2026-11-17.json').read_text(encoding='utf-8'))
    records={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment.csv')}
    io={r['equipment_id']:r for r in load_csv(ROOT/'catalog/equipment_io.csv')}
    added=[records[eid] for eid in review['new_equipment_ids']]
    assert Counter(r['category_id'] for r in added)=={f'M{i}':10 for i in range(150,154)}
    assert len({(r['manufacturer'],r['model_name']) for r in added})==40
    for record in added:
        profile=io[record['equipment_id']]
        assert (profile['manufacturer'],profile['model_name'])==(record['manufacturer'],record['model_name'])
        assert all(profile[k].strip() for k in ['inputs_and_states','outputs_and_states','units_of_measure'])
        assert record['technical_spec_url'].startswith('https://')
        assert record['purdue_list']=='false'
    purdue=[r for r in added if r['ownership_status']=='documented_institution_installation']
    assert len(purdue)==1 and purdue[0]['model_name']=='PowerEdge R7525'
    assert purdue[0]['access_evidence_url']=='https://www.rcac.purdue.edu/news/5719'


def test_computational_routes_are_exported_as_plans_distinct_from_manufacturing():
    graph=Graph().parse(ROOT/'catalog/ontology/ontology.ttl',format='turtle')
    for rid in ['P90','P91','P92']:
        subject=node('route',rid)
        assert (subject,RDF.type,VOCAB.ComputationalWorkflow) in graph
        assert (subject,RDF.type,VOCAB.ManufacturingProcess) not in graph
    for rid in ['P93','P94','P95']:
        assert (node('route',rid),RDF.type,VOCAB.ManufacturingProcess) in graph
