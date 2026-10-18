"""Additive standards mappings. No network, private inputs or nanopub publishing."""
from decimal import Decimal
from pathlib import Path
import csv
import json
from rdflib import Literal, Namespace, URIRef
from rdflib.namespace import DCTERMS, RDF, RDFS, SKOS, XSD

BASE = 'https://github.com/PodComet/ICoN-PCL-Equipment-Metadata/'
ICON = Namespace(BASE + 'ontology#')
SCHEMA = Namespace('https://schema.org/')
QUDT = Namespace('http://qudt.org/schema/qudt/')
UNIT = Namespace('http://qudt.org/vocab/unit/')
PROV = Namespace('http://www.w3.org/ns/prov#')
# Reference gas flow, fractions, pH and RCF need additional semantic qualifiers.
UNIT_CODES = {'°C': 'DEG_C', 's': 'SEC', 'Pa': 'PA', 'K/s': 'K-PER-SEC',
              'rpm': 'REV-PER-MIN', 'mL/min': 'MilliL-PER-MIN', 'nm': 'NanoM',
              'J': 'J', 'W': 'W', 'Hz': 'HZ', 'V': 'V', 'A': 'A',
              'J/cm²': 'J-PER-CentiM2', 'A/cm²': 'A-PER-CentiM2',
              'mol/L': 'MOL-PER-L', 'g/L': 'GM-PER-L', 'mm': 'MilliM',
              'mm/s': 'MilliM-PER-SEC', '°': 'DEG'}


def add_standard_metadata(graph, root, node):
    """Keep local meanings and original reported values alongside exchange terms."""
    for prefix, ns in [('schema', SCHEMA), ('qudt', QUDT), ('unit', UNIT), ('skos', SKOS)]:
        graph.bind(prefix, ns)
    for subject in list(graph.subjects(RDF.type, ICON.EquipmentModel)):
        for brand in graph.objects(subject, ICON.manufacturer):
            if str(graph.value(brand, RDFS.label)).casefold() == 'unspecified':
                continue
            graph.add((subject, RDF.type, SCHEMA.ProductModel))
            graph.add((subject, SCHEMA.manufacturer, brand))
            graph.add((brand, RDF.type, SCHEMA.Organization))
        for local, standard in [('productPage', SCHEMA.url), ('photo', SCHEMA.image)]:
            for target in graph.objects(subject, ICON[local]):
                graph.add((subject, standard, target))
        for local in ['manual', 'technicalSpecification']:
            for target in graph.objects(subject, ICON[local]):
                graph.add((subject, DCTERMS.references, target))
    for kind, scheme in [('EquipmentCategory', 'equipment-categories'), ('Route', 'process-and-material-families')]:
        scheme_id = node('scheme', scheme)
        graph.add((scheme_id, RDF.type, SKOS.ConceptScheme))
        graph.add((scheme_id, RDFS.label, Literal(scheme)))
        for subject in list(graph.subjects(RDF.type, ICON[kind])):
            graph.add((subject, RDF.type, SKOS.Concept))
            graph.add((subject, SKOS.inScheme, scheme_id))
    for subject in list(graph.subjects(RDF.type, ICON.SourceEvidence)):
        graph.add((subject, RDF.type, PROV.Entity))
        for source in graph.objects(subject, PROV.hadPrimarySource):
            graph.add((subject, PROV.wasDerivedFrom, source))
    # Bounds and ranges must not be silently represented as exact point values.
    quantity_count = 0
    for subject in list(graph.subjects(RDF.type, ICON.OperatingCondition)):
        if str(graph.value(subject, ICON.operator)) != 'eq':
            continue
        code = UNIT_CODES.get(str(graph.value(subject, ICON.canonicalUnit)))
        value = graph.value(subject, ICON.canonicalValue)
        if not code or value is None:
            continue
        quantity = URIRef(str(subject) + '/normalized-quantity')
        graph.add((subject, ICON.normalizedQuantity, quantity))
        graph.add((quantity, RDF.type, QUDT.QuantityValue))
        graph.add((quantity, QUDT.numericValue, Literal(Decimal(str(value)), datatype=XSD.decimal)))
        graph.add((quantity, QUDT.unit, UNIT[code]))
        graph.add((quantity, ICON.quantityKind, graph.value(subject, ICON.quantityKind)))
        quantity_count += 1
    with (Path(root) / 'catalog/ontology_term_references.csv').open(encoding='utf-8', newline='') as source:
        terms = list(csv.DictReader(source))
    known = set(graph.subjects(RDF.type, ICON.MaterialFamily))
    for row in terms:
        subject = node('route', row['class_id'])
        if subject not in known or row['relation'] != 'scope_reference' or row['review_status'] != 'reviewed':
            raise ValueError('Unreviewed or unresolved material term reference')
        term = URIRef(row['term_iri'])
        if not row['term_label'] or not row['scope_note'] or not row['source_url'].startswith('https://') or not str(term).startswith(('http://', 'https://')):
            raise ValueError('Incomplete material term reference')
        graph.add((subject, RDFS.seeAlso, term))
        mapping = node('term-reference', row['mapping_id'])
        graph.add((mapping, RDF.type, ICON.OntologyTermReference))
        for predicate, value in [(ICON.classificationTarget, subject), (ICON.ontologyTerm, term), (DCTERMS.source, URIRef(row['source_url']))]:
            graph.add((mapping, predicate, value))
        graph.add((mapping, RDFS.label, Literal(row['term_label'])))
        graph.add((mapping, DCTERMS.description, Literal(row['scope_note'])))
        graph.add((mapping, DCTERMS.date, Literal(row['checked_date'], datatype=XSD.date)))
    profile = json.loads((Path(root) / 'catalog/metadata-profile.json').read_text(encoding='utf-8'))
    if profile['schema'] != 'iconpcl-metadata-profile/v1':
        raise ValueError('Unsupported metadata profile')
    return {'profile': profile['schema'], 'exact_normalized_quantities': quantity_count,
            'reviewed_material_term_references': len(terms),
            'scope': 'Additive catalog mappings; not ISA-JSON, a signed nanopublication, or formal community certification.'}
