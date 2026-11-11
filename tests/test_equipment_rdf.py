"""Checks for the portable, equipment-only RDF export."""
import csv
from decimal import Decimal
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
from xml.etree import ElementTree as ET

import pytest
from rdflib import Graph, URIRef
from rdflib.compare import isomorphic
from rdflib.namespace import DCTERMS, OWL, RDF

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('equipment_rdf', ROOT / 'scripts/export_equipment_rdf.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)
ICON, SCHEMA = exporter.ICON, exporter.SCHEMA


@pytest.fixture(scope='module')
def snapshot():
    return exporter.build_graph(ROOT, '2026-11-04')


def test_every_catalog_record_has_a_distinct_stable_resource(snapshot):
    graph, report = snapshot
    records = exporter.read_csv(ROOT, 'equipment.csv')
    expected = {exporter.node('equipment', r['equipment_id']) for r in records}
    assert set(graph.subjects(RDF.type, ICON.EquipmentModel)) == expected
    assert len(expected) == report['equipment_records']
    assert len(expected) > 1100
    assert not list(graph.triples((None, OWL.sameAs, None)))
    assert not list(graph.triples((None, SCHEMA.isVariantOf, None)))
    for subject in expected:
        assert graph.value(subject, DCTERMS.identifier)
        category = graph.value(subject, ICON.inCategory)
        assert (category, RDF.type, ICON.EquipmentCategory) in graph
        for target in graph.objects(subject, ICON.catalogAssociation):
            assert (target, RDF.type, ICON.Route) in graph


def test_latest_model_bound_io_is_preserved_and_absent_models_are_explicit(snapshot):
    graph, report = snapshot
    for row in exporter.read_csv(ROOT, 'equipment_io.csv'):
        subject = exporter.node('equipment', row['equipment_id'])
        profile = graph.value(subject, ICON.inputOutputProfile)
        for key, (predicate, _) in exporter.IO_FIELDS.items():
            assert str(graph.value(profile, ICON[predicate])) == row[key]
    source_ids = {row['equipment_id'] for row in exporter.read_csv(ROOT, 'equipment_io.csv')}
    catalog_ids = {row['equipment_id'] for row in exporter.read_csv(ROOT, 'equipment.csv')}
    assert report['equipment_with_io'] == len(source_ids)
    assert set(report['equipment_without_io']) == catalog_ids - source_ids
    profile = graph.value(exporter.node('equipment', 'M07-08'), ICON.inputOutputProfile)
    assert 'withdraw' in str(graph.value(profile, ICON.inputDescription)).lower()
    for identifier in report['equipment_without_io']:
        subject = exporter.node('equipment', identifier)
        assert graph.value(subject, ICON.inputOutputProfile) is None
        assert str(graph.value(subject, ICON.inputOutputStatus)) == 'no_exact_model_data'


def test_quotes_retain_scope_and_source_currency_and_estimates_are_distinct(snapshot):
    graph, report = snapshot
    records = exporter.read_csv(ROOT, 'equipment.csv')
    assert report['price_quotes'] == len(exporter.read_csv(ROOT, 'seller_offers.csv')) + sum(bool(r['msrp_value']) + bool(r['manufacturer_price_value']) for r in records)
    assert report['price_estimates'] == sum(bool(r['estimated_msrp_low']) and bool(r['estimated_msrp_high']) for r in exporter.read_csv(ROOT, 'equipment_msrp_estimates.csv'))
    offer = next(o for o in exporter.read_csv(ROOT, 'seller_offers.csv') if o['currency'] == 'EUR')
    subject = exporter.node('price-quote', offer['offer_id'])
    assert str(graph.value(subject, SCHEMA.priceCurrency)) == 'USD'
    assert str(graph.value(subject, ICON.originalCurrency)) == 'EUR'
    assert Decimal(str(graph.value(subject, ICON.originalPrice))) == Decimal(offer['price_value'])
    assert str(graph.value(subject, ICON.fxDate)) == '2026-10-16'
    assert str(graph.value(subject, ICON.checkedDate)) == offer['checked_date']
    assert str(graph.value(subject, ICON.condition)) == offer['condition']
    for estimate in graph.subjects(RDF.type, ICON.PriceEstimate):
        assert graph.value(estimate, SCHEMA.price) is None
        assert Decimal(str(graph.value(estimate, SCHEMA.minPrice))) <= Decimal(str(graph.value(estimate, SCHEMA.maxPrice)))
        assert graph.value(estimate, ICON.estimateBasis)


def test_both_portable_formats_round_trip(snapshot):
    graph, _ = snapshot
    for fmt in ['turtle', 'xml']:
        parsed = Graph().parse(data=graph.serialize(format=fmt), format=fmt)
        assert isomorphic(graph, parsed)
    assert all(not isinstance(term, URIRef) or not str(term).startswith(('file:', 'C:', 'urn:uuid:')) for triple in graph for term in triple)
    assert not any(any(part in str(predicate).lower() for part in ['serialnumber', 'purdue', 'password']) for _, predicate, _ in graph)


def test_added_private_columns_are_not_exported_and_changed_models_cannot_inherit_io(tmp_path):
    (tmp_path / 'catalog').mkdir()
    for name in exporter.INPUTS:
        shutil.copyfile(ROOT / 'catalog' / name, tmp_path / 'catalog' / name)
    path = tmp_path / 'catalog/equipment.csv'
    rows = exporter.read_csv(tmp_path, 'equipment.csv')
    rows[0]['serial_number'] = 'PRIVATE-INVENTORY-SENTINEL'
    with path.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=[*rows[0]])
        writer.writeheader()
        writer.writerows(rows)
    graph, _ = exporter.build_graph(tmp_path, '2026-11-04')
    assert 'PRIVATE-INVENTORY-SENTINEL' not in graph.serialize(format='turtle')
    io_path = tmp_path / 'catalog/equipment_io.csv'
    io_rows = exporter.read_csv(tmp_path, 'equipment_io.csv')
    io_rows[0]['model_name'] = 'Different model'
    with io_path.open('w', encoding='utf-8', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(io_rows[0]))
        writer.writeheader()
        writer.writerows(io_rows)
    with pytest.raises(ValueError, match='Exact-model mismatch'):
        exporter.build_graph(tmp_path, '2026-11-04')


def test_nested_rdf_xml_has_one_machine_description_and_preserves_scoped_sources():
    output = ROOT / 'catalog/ontology'
    content = (output / 'equipment.rdf').read_bytes()
    manifest = json.loads((output / 'equipment-xml-export.json').read_text(encoding='utf-8'))
    assert hashlib.sha256(content).hexdigest() == manifest['rdf_xml']['sha256']
    document = ET.fromstring(content)
    rdf = '{' + str(RDF) + '}'
    descriptions = document.findall('.//' + rdf + 'Description')
    identifiers = [element.attrib[rdf + 'about'] for element in descriptions]
    equipment = exporter.read_csv(ROOT, 'equipment.csv')
    assert set(identifiers) == {str(exporter.node('equipment', row['equipment_id'])) for row in equipment}
    assert len(identifiers) == len(equipment)
    assert len(set(element.attrib[rdf + 'about'] for element in document.iter() if rdf + 'about' in element.attrib)) == sum(
        rdf + 'about' in element.attrib for element in document.iter()
    )
    machine = next(e for e in descriptions if e.attrib[rdf + 'about'].endswith('/M07-08'))
    assert len(machine.findall(f'{{{SCHEMA}}}name')) == 1
    assert not machine.findall(f'{{{SCHEMA}}}additionalProperty')
    for prop in ('identity', 'inputOutputProfile', 'associations', 'pricing', 'review'):
        assert len(machine.find(f'{{{ICON}}}{prop}')) == 1
    io = machine.find(f'{{{ICON}}}inputOutputProfile')[0]
    assert io.find(f'{{{exporter.PROV}}}wasDerivedFrom').attrib[rdf + 'resource'].split('#')[0].endswith('/equipment_io.csv')
    source = next(row for row in exporter.read_csv(ROOT, 'equipment_io.csv') if row['equipment_id'] == 'M07-08')
    assert io.findtext(f'{{{ICON}}}inputDescription') == source['inputs_and_states']
    assert io.findtext(f'{{{ICON}}}measuringUnitsDescription') == source['units_of_measure']
    assert 'http://qudt.org/vocab/unit/MilliL' in {
        e.attrib[rdf + 'resource'] for e in io.findall(f'{{{ICON}}}reportedUnit')
    }
    associations = machine.find(f'{{{ICON}}}associations')[0]
    assert len(associations.findall(f'{{{ICON}}}catalogMaterial')) == 7
    assert len(associations.findall(f'{{{ICON}}}catalogProcess')) == 1
    graph = Graph().parse(data=content, format='xml')
    assert len(graph) == manifest['rdf_triples']
    assert len(set(graph.subjects(RDF.type, ICON.PriceQuote))) == manifest['price_quotes']
    assert len(set(graph.subjects(RDF.type, ICON.PriceEstimate))) == manifest['price_estimates']
