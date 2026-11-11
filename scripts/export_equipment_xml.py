"""Publish the nested RDF/XML profile from the public equipment catalog."""
from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import date
import hashlib
import json
from pathlib import Path
import re
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape, quoteattr

from rdflib import Graph, Literal, Namespace, URIRef
from rdflib.compare import isomorphic
from rdflib.namespace import DCTERMS as DCT, RDF, RDFS, SKOS, XSD

if __package__:
    from . import export_equipment_rdf as catalog
else:
    import export_equipment_rdf as catalog

ICON, SCHEMA, PROV, DCAT = catalog.ICON, catalog.SCHEMA, catalog.PROV, catalog.DCAT
QUDT = Namespace('http://qudt.org/schema/qudt/')
UNIT = Namespace('http://qudt.org/vocab/unit/')
PROFILE = URIRef(catalog.BASE + 'blob/main/docs/equipment-rdf.md#nested-rdfxml-profile')
UNIT_FILE = 'equipment-xml-units.json'
TERM_FILE = 'ontology/ontology-term-references.csv'
NAMESPACES = {
    'rdf': RDF, 'rdfs': RDFS, 'dct': DCT, 'schema': SCHEMA, 'prov': PROV,
    'skos': SKOS, 'dcat': DCAT, 'qudt': QUDT, 'icon': ICON,
}
DOCUMENT_ROLES = {
    'manual_url': 'OperatingManual', 'documentation_url': 'Documentation',
    'technical_spec_url': 'TechnicalSpecification', 'brochure_url': 'Brochure',
    'model_evidence_url': 'ModelEvidence', 'product_page_url': 'ProductPage',
}
REVIEW_FIELDS = (
    'model_status', 'model_evidence_status', 'manual_status', 'manual_match_status',
    'price_status', 'catalog_scope', 'review_date', 'notes',
)
# Explicit symbols in the model-bound Legato 210 narrative, checked against the
# source row. Ordinary records use only standalone entries in their units list.
LEGATO_UNITS = ('pL', 'nL', 'µL', 'mL', 'mm', 's', 'fL', 'ms', 'V', 'Hz', 'W', 'µA', 'mA')


def typed_value(value, field):
    if field in {'review_date', 'media_checked_date', 'imported_date', 'successor_checked_date'}:
        return Literal(date.fromisoformat(value), datatype=XSD.date)
    return Literal(value)


def catalog_rows(root, filename, key):
    """Index CSV data and RFC 7111 row fragments, counting the header."""
    rows = catalog.read_csv(root, filename)
    positions = {
        row[key]: URIRef(catalog.RAW + 'catalog/' + filename + '#row=' + str(number))
        for number, row in enumerate(rows, 2)
    }
    return catalog.index(rows, key), positions


def declared_units(profile, registry):
    text = profile['units_of_measure'].partition('\nSource')[0]
    if not text or text.casefold().lstrip().startswith('not established'):
        return set()
    symbols = [re.sub(r'\s*\([^()]+\)$', '', part.strip()) for part in text.split(';')]
    if profile['equipment_id'] == 'M07-08' and catalog.normalized(profile['model_name']) == 'kdscientificlegato210':
        symbols.extend(s for s in LEGATO_UNITS if re.search(r'(?<!\w)' + re.escape(s) + r'(?!\w)', text))
    return {UNIT[registry[s]['unit']] for s in symbols if s in registry}


def build_xml_graph(root, snapshot_date):
    """Return the RDF graph and the relationships to render as inline nodes."""
    root = Path(root)
    legacy, baseline = catalog.build_graph(root, snapshot_date)
    graph = Graph()
    owned = {}
    types = {}
    records, equipment_sources = catalog_rows(root, 'equipment.csv', 'equipment_id')
    io, io_sources = catalog_rows(root, 'equipment_io.csv', 'equipment_id')
    families, family_sources = catalog_rows(root, 'product_families.csv', 'equipment_id')
    lifecycle, lifecycle_sources = catalog_rows(root, 'model_lifecycle.csv', 'equipment_id')
    makers, maker_sources = catalog_rows(root, 'manufacturers.csv', 'manufacturer')
    _, offer_sources = catalog_rows(root, 'seller_offers.csv', 'offer_id')
    _, estimate_sources = catalog_rows(root, 'equipment_msrp_estimates.csv', 'equipment_id')
    _, evidence_sources = catalog_rows(root, 'evidence_registry.csv', 'evidence_id')
    registry = json.loads((root / 'catalog' / UNIT_FILE).read_text(encoding='utf-8'))
    unit_definitions = {UNIT[v['unit']]: v for v in registry['symbols'].values()}

    def entity(subject, cls, source=None):
        graph.add((subject, RDF.type, cls))
        types[subject] = cls
        if source:
            graph.add((subject, PROV.wasDerivedFrom, source))
        return subject

    def inline(parent, relation, subject, cls, source=None):
        graph.add((parent, relation, subject))
        owned[subject] = (parent, relation)
        return entity(subject, cls, source)

    def section(parent, relation, cls, source=None):
        return inline(parent, ICON[relation], URIRef(str(parent) + '/' + relation), ICON[cls], source)

    def value(subject, predicate, content):
        if content is not None and content != '':
            graph.add((subject, predicate, content if isinstance(content, (URIRef, Literal)) else Literal(content)))

    def link(subject, predicate, url):
        value(subject, predicate, catalog.web_uri(url))

    def copy(subject, old, predicates):
        for predicate in predicates:
            for obj in legacy.objects(old, predicate):
                graph.add((subject, predicate, obj))

    def fields(subject, row, names):
        for field in names:
            if row.get(field):
                value(subject, ICON[catalog.camel(field)], typed_value(row[field], field))

    dataset = entity(catalog.node('dataset', 'equipment'), DCAT.Dataset)
    value(dataset, DCT.title, 'ICoN-PCL equipment catalog, nested RDF/XML')
    value(dataset, DCT.issued, Literal(date.fromisoformat(snapshot_date), datatype=XSD.date))
    value(dataset, DCT.conformsTo, PROFILE)
    value(dataset, DCT.description, catalog.IDENTITY_NOTE)
    distribution = catalog.node('distribution', 'equipment.rdf')
    inline(dataset, DCAT.distribution, distribution, DCAT.Distribution)
    value(distribution, DCAT.downloadURL, URIRef('https://iconpcl.podcomet.ai/ontology/equipment.rdf'))
    value(distribution, DCAT.mediaType, 'application/rdf+xml')
    for filename in [*catalog.INPUTS, TERM_FILE, UNIT_FILE]:
        value(dataset, PROV.wasDerivedFrom, URIRef(catalog.RAW + 'catalog/' + filename))

    for filename, kind, key in [
        ('categories.csv', 'category', 'category_id'),
        ('supplemental_categories.csv', 'category', 'category_id'),
        ('routes.csv', 'route', 'route_id'),
    ]:
        rows, sources = catalog_rows(root, filename, key)
        for identifier, row in rows.items():
            subject = entity(catalog.node(kind, identifier), SKOS.Concept, sources[identifier])
            value(subject, SKOS.notation, identifier)
            value(subject, SKOS.prefLabel, row.get('category_name') or row['route_name'])
            local_type = ICON.EquipmentCategory if kind == 'category' else (
                ICON.MaterialFamily if row['route_kind'] == 'material_family' else ICON.ManufacturingProcess
            )
            value(subject, RDF.type, local_type)
            fields(subject, row, ('association_basis', 'source_page', 'source_sha256'))

    term_rows, term_sources = catalog_rows(root, TERM_FILE, 'mapping_id')
    for mapping_id, row in term_rows.items():
        if row['review_status'] != 'reviewed' or row['relation'] != 'scope_reference':
            continue
        subject = catalog.node('route', row['class_id'])
        reference = inline(subject, ICON.terminologyReference, catalog.node('terminology', mapping_id),
                           ICON.TerminologyReference, term_sources[mapping_id])
        value(reference, RDFS.seeAlso, URIRef(row['term_iri']))
        value(reference, DCT.description, row['scope_note'])
        link(reference, DCT.source, row['source_url'])
        value(reference, DCT.date, Literal(date.fromisoformat(row['checked_date']), datatype=XSD.date))

    for manufacturer, row in makers.items():
        subject = catalog.node('manufacturer', catalog.brand_id(manufacturer))
        entity(subject, ICON.Manufacturer if manufacturer.casefold() == 'unspecified' else SCHEMA.Organization,
               maker_sources[manufacturer])
        value(subject, SCHEMA.name, manufacturer)
        link(subject, SCHEMA.url, row['official_website_url'])
        fields(subject, row, ('brand_identity_status', 'research_use_status', 'verification_basis',
                              'verification_notes', 'review_date', 'company_status', 'company_status_note'))
        for field in ('research_evidence_url', 'company_status_source_url'):
            link(subject, DCT.source, row[field])

    # Retain the canonical shared evidence records and qualified source locators.
    for evidence in legacy.subjects(RDF.type, ICON.SourceEvidence):
        identifier = str(legacy.value(evidence, DCT.identifier))
        entity(evidence, ICON.SourceEvidence, evidence_sources[identifier])
        copy(evidence, evidence, (DCT.identifier, ICON.claim, ICON.classification, ICON.scope))
        for citation in legacy.objects(evidence, DCT.source):
            inline(evidence, DCT.source, citation, PROV.Entity)
            copy(citation, citation, (DCT.title, ICON.sourceLocator, ICON.checkedDate, PROV.hadPrimarySource))

    with_units = 0
    for identifier, row in records.items():
        machine = catalog.node('equipment', identifier)
        source = equipment_sources[identifier]
        entity(machine, ICON.EquipmentModel)
        value(machine, DCT.isPartOf, dataset)
        # Keep standard Product metadata on the model, then qualify other facts below.
        if row['record_kind'] not in {'generic_requirement', 'proposed_configuration', 'model_identity_unresolved'}:
            value(machine, RDF.type, SCHEMA.ProductModel)
        value(machine, DCT.identifier, identifier)
        value(machine, SCHEMA.name, row['model_name'])
        maker_property = ICON.manufacturer if row['manufacturer'].casefold() == 'unspecified' else SCHEMA.manufacturer
        value(machine, maker_property, catalog.node('manufacturer', catalog.brand_id(row['manufacturer'])))
        value(machine, PROV.wasDerivedFrom, source)
        identity = section(machine, 'identity', 'IdentityProfile', source)
        value(identity, ICON.inCategory, catalog.node('category', row['category_id']))
        fields(identity, row, ('record_kind', 'equipment_subtype', 'source_record_id'))
        for old_id in catalog.terms(row['legacy_category_ids']):
            value(identity, ICON.legacyCategoryID, old_id)
        if row['capacity_ml']:
            capacity = inline(identity, ICON.capacity, URIRef(str(identity) + '/capacity'), QUDT.QuantityValue)
            value(capacity, QUDT.numericValue, Literal(catalog.numeric(row['capacity_ml']), datatype=XSD.decimal))
            value(capacity, QUDT.unit, UNIT.MilliL)
        if identifier in families:
            family = families[identifier]
            family_node = catalog.node('product-family', family['product_family_id'])
            entity(family_node, ICON.ProductFamily)
            value(family_node, SCHEMA.name, family['product_family'])
            variant = section(identity, 'variant', 'ModelVariant', family_sources[identifier])
            value(variant, ICON.inProductFamily, family_node)
            label = family['variant_label']
            if catalog.normalized(label) != catalog.normalized(row['model_name']):
                value(variant, ICON.variantLabel, label)
            if family['model_variant_id'] != identifier:
                value(variant, DCT.identifier, family['model_variant_id'])
            fields(variant, family, ('grouping_basis', 'review_date'))
            link(variant, DCT.source, family['grouping_source_url'])

        io_block = inline(machine, ICON.inputOutputProfile, catalog.node('equipment-io', identifier),
                          ICON.InputOutputProfile, io_sources.get(identifier))
        profile = io.get(identifier)
        value(io_block, ICON.inputOutputStatus, 'catalog_io_row' if profile else 'no_catalog_io_row')
        if profile:
            for field, (predicate, _) in catalog.IO_FIELDS.items():
                value(io_block, ICON[predicate], profile[field])
            for field in ('manual_url', 'spec_url'):
                link(io_block, DCT.source, profile['equipment_io_' + field])
            for field in ('source_sheet', 'source_row', 'source_sha256', 'imported_date'):
                recorded = profile['equipment_io_' + field]
                if recorded:
                    value(io_block, ICON[catalog.camel(field)], typed_value(recorded, field))
            units = declared_units(profile, registry['symbols'])
            with_units += bool(units)
            for unit in units:
                value(io_block, ICON.reportedUnit, unit)

        if any(row[k] for k in ('related_process_ids', 'related_material_ids', 'association_basis')):
            associations = section(machine, 'associations', 'CatalogAssociations', source)
            for field, predicate in [('related_process_ids', ICON.catalogProcess), ('related_material_ids', ICON.catalogMaterial)]:
                for route in catalog.terms(row[field]):
                    value(associations, predicate, catalog.node('route', route))
            fields(associations, row, ('association_basis',))

        documents = defaultdict(list)
        for field, role in DOCUMENT_ROLES.items():
            url = catalog.web_uri(row[field])
            if url:
                documents[url].append((field, role))
        if documents:
            documentation = section(machine, 'documentationProfile', 'DocumentationProfile', source)
            for number, (url, roles) in enumerate(sorted(documents.items()), 1):
                document = inline(documentation, DCT.references, URIRef(str(documentation) + '/' + str(number)),
                                  SCHEMA.DigitalDocument)
                value(document, SCHEMA.url, url)
                for field, role in roles:
                    value(document, DCT.type, ICON[role])
                    if field == 'manual_url':
                        fields(document, row, ('manual_scope',))
                    if field == 'product_page_url':
                        fields(document, row, ('product_page_scope',))
        if row['image_url']:
            media = inline(machine, SCHEMA.image, URIRef(str(machine) + '/photo'), SCHEMA.ImageObject, source)
            link(media, SCHEMA.contentUrl, row['image_url'])
            link(media, DCT.source, row['image_source_url'])
            fields(media, row, ('image_scope', 'media_checked_date'))

        quotes = list(legacy.objects(machine, ICON.priceQuote))
        estimates = list(legacy.objects(machine, ICON.priceEstimate))
        if quotes or estimates:
            pricing = section(machine, 'pricing', 'PricingProfile')
            for price in sorted(quotes + estimates):
                price_id = str(legacy.value(price, DCT.identifier))
                estimate = price in estimates
                price_source = estimate_sources[identifier] if estimate else offer_sources.get(price_id, source)
                relation = ICON.priceEstimate if estimate else ICON.priceQuote
                inline(pricing, relation, price, SCHEMA.PriceSpecification, price_source)
                value(price, RDF.type, ICON.PriceEstimate if estimate else ICON.PriceQuote)
                copy(price, price, (DCT.identifier, SCHEMA.price, SCHEMA.priceCurrency, SCHEMA.minPrice,
                                    SCHEMA.maxPrice, ICON.priceKind, ICON.checkedDate, DCT.description,
                                    ICON.sellerName, ICON.condition, PROV.wasDerivedFrom,
                                    ICON.estimateMethod, ICON.estimateStatus, ICON.estimateSubject,
                                    ICON.estimateConfidence, ICON.estimateBenchmarkIds))
                if str(legacy.value(price, ICON.originalCurrency)) != 'USD':
                    copy(price, price, (ICON.originalCurrency, ICON.originalPrice, ICON.originalMaxPrice,
                                        ICON.fxRate, ICON.fxDate, ICON.fxSource))

        review = section(machine, 'review', 'ReviewProfile', source)
        fields(review, row, REVIEW_FIELDS)
        if identifier in lifecycle:
            life = section(review, 'lifecycle', 'ModelLifecycle', lifecycle_sources[identifier])
            fields(life, lifecycle[identifier], ('lifecycle_status', 'successor_model_name', 'successor_scope',
                                                'successor_checked_date', 'successor_relationship', 'review_notes'))
            for field in ('successor_product_url', 'successor_evidence_url'):
                link(life, ICON[catalog.camel(field)], lifecycle[identifier][field])
        copy(review, machine, (ICON.supportedBy,))

    units_used = set(graph.objects(None, ICON.reportedUnit)) | set(graph.objects(None, QUDT.unit))
    for unit in units_used:
        entry = unit_definitions[unit]
        entity(unit, QUDT.Unit)
        value(unit, QUDT.symbol, entry['symbol'])
        value(unit, RDFS.isDefinedBy, URIRef(registry['vocabulary_iri']))

    report = {
        'schema': 'iconpcl-equipment-rdf-xml/v2', 'snapshot_date': snapshot_date,
        'equipment_records': len(records), 'equipment_with_io': len(io),
        'equipment_with_qudt_units': with_units, 'qudt_units_used': len(units_used),
        'price_quotes': baseline['price_quotes'], 'price_estimates': baseline['price_estimates'],
        'rdf_triples': len(graph),
        'input_sha256': {
            name: catalog.source_hash(root / 'catalog' / name) for name in [*catalog.INPUTS, TERM_FILE, UNIT_FILE]
        },
    }
    return graph, types, owned, list(records), report


def serialize_xml(graph, types, owned, equipment_ids, *, sample=None):
    """Write a defined subject once and inline its owned resources in RDF/XML."""
    prefixes = {str(uri): prefix for prefix, uri in NAMESPACES.items()}

    def qname(uri):
        for namespace, prefix in prefixes.items():
            if str(uri).startswith(namespace):
                return prefix + ':' + str(uri)[len(namespace):]
        raise ValueError(f'Unregistered RDF/XML namespace for {uri}')

    def ordered(subject):
        groups = (
            RDF.type, DCT.identifier, SCHEMA.name, SCHEMA.manufacturer, ICON.manufacturer, PROV.wasDerivedFrom,
            DCT.isPartOf, ICON.identity, ICON.inputOutputProfile, ICON.associations, ICON.documentationProfile,
            SCHEMA.image, ICON.pricing, ICON.review,
        )
        rank = {predicate: index for index, predicate in enumerate(groups)}
        return sorted(graph.predicate_objects(subject), key=lambda pair: (rank.get(pair[0], len(rank)), pair))

    def render(subject, depth, machine=False):
        tag = 'rdf:Description' if machine else qname(types[subject])
        indent = '  ' * depth
        yield indent + f'<{tag} rdf:about={quoteattr(str(subject))}>'
        for predicate, obj in ordered(subject):
            if not machine and (predicate, obj) == (RDF.type, types[subject]):
                continue
            prop = qname(predicate)
            if owned.get(obj) == (subject, predicate):
                yield indent + f'  <{prop}>'
                yield from render(obj, depth + 2)
                yield indent + f'  </{prop}>'
            elif isinstance(obj, URIRef):
                yield indent + f'  <{prop} rdf:resource={quoteattr(str(obj))}/>'
            else:
                attrs = f' rdf:datatype={quoteattr(str(obj.datatype))}' if obj.datatype else ''
                if obj.language:
                    attrs = f' xml:lang={quoteattr(obj.language)}'
                lexical = escape(str(obj), {'\n': '&#10;', '\r': '&#13;', '\t': '&#9;'})
                yield indent + f'  <{prop}{attrs}>{lexical}</{prop}>'
        yield indent + f'</{tag}>'

    declarations = ' '.join(f'xmlns:{prefix}={quoteattr(str(uri))}' for prefix, uri in NAMESPACES.items())
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<rdf:RDF ' + declarations + '>']
    machines = {catalog.node('equipment', identifier) for identifier in equipment_ids}
    for identifier in ([sample] if sample else equipment_ids):
        lines.extend(render(catalog.node('equipment', identifier), 1, machine=True))
    if not sample:
        for subject in sorted(set(types) - machines - set(owned)):
            lines.extend(render(subject, 1))
    return '\n'.join(lines + ['</rdf:RDF>', ''])


def export(root=catalog.ROOT, *, snapshot_date, output_dir=None, sample_path=None):
    graph, types, owned, equipment_ids, report = build_xml_graph(root, snapshot_date)
    content = serialize_xml(graph, types, owned, equipment_ids).encode('utf-8')
    document = ET.fromstring(content)
    rdf_xml_name = '{' + str(RDF) + '}'
    descriptions = document.findall(rdf_xml_name + 'Description')
    expected = {str(catalog.node('equipment', identifier)) for identifier in equipment_ids}
    observed = {d.attrib[rdf_xml_name + 'about'] for d in descriptions}
    if len(descriptions) != len(expected) or observed != expected:
        raise ValueError('Expected exactly one top-level description for every equipment ID')
    if not isomorphic(graph, Graph().parse(data=content, format='xml')):
        raise ValueError('Nested RDF/XML did not round-trip to the export graph')
    output = Path(output_dir) if output_dir else Path(root) / 'catalog/ontology'
    output.mkdir(parents=True, exist_ok=True)
    (output / 'equipment.rdf').write_bytes(content)
    report['rdf_xml'] = {'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}
    (output / 'equipment-xml-export.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    if sample_path:
        sample = serialize_xml(graph, types, owned, equipment_ids, sample='M07-08')
        Path(sample_path).write_text(sample, encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--date', required=True, help='Export date, YYYY-MM-DD')
    parser.add_argument('--output-dir', type=Path)
    parser.add_argument('--sample', type=Path, help='Optional single-record XML sample')
    args = parser.parse_args()
    summary = export(snapshot_date=args.date, output_dir=args.output_dir, sample_path=args.sample)
    print(json.dumps({key: value for key, value in summary.items() if key != 'input_sha256'}, indent=2))
