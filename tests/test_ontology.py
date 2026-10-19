import copy
import json
from pathlib import Path

import pytest
from pydantic import ValidationError
from rdflib import Graph
from rdflib.namespace import RDF
from rdflib.namespace import RDFS, OWL, XSD
from metadata_profile import QUDT, SCHEMA

from ontology_models import ConditionRecord, EvidenceRecord
from ontology_tools import VOCAB, artifacts, build, dependency_audit, model_review, node, validate_graph
from ontology_units import convert, normalize_condition
from process_science_tools import dataset

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope='module')
def export():
    return artifacts(ROOT)


def test_full_public_graph_round_trips_with_evidence_and_distinct_quantity_kinds(export):
    files, report = export
    turtle = Graph().parse(data=files['ontology.ttl'], format='turtle')
    jsonld = Graph().parse(data=files['ontology.jsonld'], format='json-ld')
    assert set(turtle) == set(jsonld)
    assert len(turtle) == report['counts']['rdf_triples']
    assert report['shacl_conforms'] and report['shacl_violations'] == 0
    assert len(list(turtle.subjects(RDF.type, VOCAB.EquipmentModel))) == 1113
    assert len(list(turtle.subjects(RDF.type, VOCAB.SourceEvidence))) == 321
    for quantity in ['pressure_gauge', 'pressure_absolute', 'centrifuge_speed', 'rotation_speed']:
        assert (node('quantity-kind', quantity), RDF.type, VOCAB.QuantityKind) in turtle
    for subject in turtle.subjects(RDF.type, VOCAB.OperatingCondition):
        assert list(turtle.objects(subject, VOCAB.supportedBy))


def test_shacl_rejects_a_broken_property_evidence_link(export):
    graph = Graph().parse(data=export[0]['ontology.ttl'], format='turtle')
    prop = next(graph.subjects(RDF.type, VOCAB.ReportedProperty))
    graph.remove((prop, VOCAB.supportedBy, None))
    graph.add((prop, VOCAB.supportedBy, node('evidence', 'MISSING')))
    with pytest.raises(ValueError, match='SHACL'):
        validate_graph(graph, ROOT)


def test_standard_quantity_values_preserve_exactness_and_quantity_kind(export):
    graph = Graph().parse(data=export[0]['ontology.ttl'], format='turtle')
    quantities = list(graph.subjects(RDF.type, QUDT.QuantityValue))
    assert len(quantities) == export[1]['metadata_alignment']['exact_normalized_quantities'] > 0
    for source, quantity in graph.subject_objects(VOCAB.normalizedQuantity):
        assert str(graph.value(source, VOCAB.operator)) == 'eq'
        assert graph.value(quantity, QUDT.numericValue).datatype == XSD.decimal
        assert graph.value(quantity, VOCAB.quantityKind) == graph.value(source, VOCAB.quantityKind)
    for source in graph.subjects(RDF.type, VOCAB.OperatingCondition):
        if str(graph.value(source, VOCAB.operator)) != 'eq':
            assert not list(graph.objects(source, VOCAB.normalizedQuantity))
    graph.remove((quantities[0], QUDT.unit, None))
    with pytest.raises(ValueError, match='SHACL'):
        validate_graph(graph, ROOT)


def test_material_term_references_do_not_assert_ontology_equivalence(export):
    graph = Graph().parse(data=export[0]['ontology.ttl'], format='turtle')
    mappings = list(graph.subjects(RDF.type, VOCAB.OntologyTermReference))
    assert len(mappings) == 8
    assert len(list(graph.objects(node('route', 'N06'), RDFS.seeAlso))) == 2
    for mapping in mappings:
        subject = graph.value(mapping, VOCAB.classificationTarget)
        term = graph.value(mapping, VOCAB.ontologyTerm)
        assert (subject, RDFS.seeAlso, term) in graph
        assert (subject, OWL.sameAs, term) not in graph
    assert not list(graph.objects(node('equipment', 'REQ-EQ-001'), SCHEMA.manufacturer))
    assert not list(graph.subjects(RDF.type, __import__('rdflib').URIRef('http://www.nanopub.org/nschema#Nanopublication')))


def test_pint_offsets_rates_and_semantic_guardrails():
    assert convert(77, '°F', '°C') == pytest.approx(25)
    assert convert(298.15, 'K', '°C') == pytest.approx(25)
    assert convert(1.8, '°F/min', 'K/min') == pytest.approx(1)
    assert convert(1, 'slm', 'sccm') == pytest.approx(1000)
    with pytest.raises(Exception, match='convert'):
        convert(1, 'sccm', 'mL/min')
    definitions = json.loads((ROOT / 'catalog/condition_definitions.json').read_text(encoding='utf-8'))
    source = next(c for c in dataset(ROOT)['conditions'] if c['parameter'] == 'temperature' and c['operator'] == 'eq')
    with pytest.raises(ValueError, match='physical bounds'):
        normalize_condition({**source, 'value': -300, 'unit': '°C'}, definitions)
    with pytest.raises(ValueError, match='compatible units'):
        normalize_condition({**source, 'unit': 'rpm'}, definitions)


def test_typed_records_reject_nonfinite_values_and_empty_provenance():
    data = dataset(ROOT)
    condition = next(c for c in data['conditions'] if c['operator'] == 'eq')
    for invalid in [dict(value=float('inf')), dict(upper_value=1), dict(label=''), dict(unknown_field=True)]:
        with pytest.raises(ValidationError):
            ConditionRecord.model_validate({**condition, **invalid})
    for invalid in [dict(source_url='javascript:alert(1)'), dict(reference_ids=[]), dict(source_locator='')]:
        with pytest.raises(ValidationError):
            EvidenceRecord.model_validate({**data['evidence'][0], **invalid})
    manual = EvidenceRecord.model_validate({**data['evidence'][0], 'classification': 'manufacturer_fact', 'reference_ids': []})
    assert manual.reference_ids == []  # Manufacturer documentation does not need an unrelated academic paper.


def test_parallel_process_actions_and_prerequisites_are_not_flattened():
    steps = [{'step_id': 'a'}, {'step_id': 'b', 'extensions': {'prerequisite_step_ids': []}},
             {'step_id': 'c', 'extensions': {'prerequisite_step_ids': ['a', 'b']}}]
    graph, levels = dependency_audit(steps)
    assert levels == [['a', 'b'], ['c']]
    assert set(graph.edges) == {('a', 'c'), ('b', 'c')}
    for parents in [['c'], ['missing'], ['b', 'b'], None]:
        invalid = copy.deepcopy(steps)
        invalid[0]['extensions'] = {'prerequisite_step_ids': parents}
        with pytest.raises(ValueError):
            dependency_audit(invalid)


def test_similarity_reviews_preserve_variants_and_curated_category_contexts():
    records = [{'equipment_id': key, 'manufacturer': 'Example', 'model_name': name, 'category_id': category}
               for key, name, category in [('a', 'Example model 1000', 'M01'), ('b', 'Example model 1000', 'M02'),
                                            ('c', 'Example model 1000 XL', 'M01')]]
    before = copy.deepcopy(records)
    candidates, contexts = model_review(records, [{'equipment_id': 'a', 'model_variant_id': 'model-1000'},
                                                 {'equipment_id': 'b', 'model_variant_id': 'model-1000'}])
    assert contexts == 1
    assert not any({r['equipment_a'], r['equipment_b']} == {'a', 'b'} for r in candidates)
    assert records == before


def test_all_artifacts_are_current_reproducible_and_inventory_free(export):
    files, report = export
    for filename, content in files.items():
        assert (ROOT / 'catalog/ontology' / filename).read_text(encoding='utf-8') == content
        assert (ROOT / 'webapp/public/ontology' / filename).read_text(encoding='utf-8') == content
    assert report['counts']['m_categories'] == 114
    assert report['counts']['x_categories'] == 6
    assert report['counts']['unit_definitions_checked'] == 138
    assert report['counts']['unreviewed_model_name_pairs'] == 0
    assert {s['route_id'] for s in report['source_sequences'] if not s['step_count']} == {'N10', 'P13', 'P14'}
    # Public export code reads a fixed list of canonical tables, not runtime assets.
    graph = Graph().parse(data=files['ontology.ttl'], format='turtle')
    assert not any('serial' in str(predicate).lower() for _, predicate, _ in graph)
    assert json.loads((ROOT / 'webapp/app/data/purdue-inventory.json').read_text(encoding='utf-8')) == []
