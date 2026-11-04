"""Export the public equipment catalog, with model-bound I/O, as standalone RDF.

Only the explicit public input files and fields below are read. No inventory,
live service, user plans, credentials or source documents are opened.
"""
from __future__ import annotations

import argparse
import csv
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from urllib.parse import quote, urlsplit

from rdflib import Graph, Literal, Namespace, URIRef
from rdflib.compare import isomorphic
from rdflib.namespace import DCTERMS, OWL, RDF, RDFS, SKOS, XSD

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://github.com/PodComet/ICoN-PCL-Equipment-Metadata/'
RAW = 'https://raw.githubusercontent.com/PodComet/ICoN-PCL-Equipment-Metadata/main/'
ICON = Namespace(BASE + 'ontology#')
SCHEMA = Namespace('https://schema.org/')
PROV = Namespace('http://www.w3.org/ns/prov#')
DCAT = Namespace('http://www.w3.org/ns/dcat#')

INPUTS = [
    'equipment.csv', 'equipment_io.csv', 'categories.csv', 'supplemental_categories.csv',
    'routes.csv', 'manufacturers.csv', 'product_families.csv', 'model_lifecycle.csv',
    'equipment_msrp_estimates.csv', 'seller_offers.csv', 'evidence_registry.csv',
    'currency_reference_rates.json',
]
# Explicitly omit Purdue membership, inventory identifiers and institution fields.
TEXT_FIELDS = [
    'record_kind', 'capacity_ml', 'variant_label', 'model_status', 'manual_status',
    'manual_scope', 'price_status', 'related_material_types', 'related_process_types',
    'association_basis', 'source_page', 'source_sha256', 'review_date', 'notes',
    'catalog_scope', 'manual_match_status', 'model_evidence_status', 'image_scope',
    'media_checked_date', 'product_page_scope', 'equipment_subtype', 'source_record_id',
]
URL_FIELDS = {
    'model_evidence_url': 'modelEvidenceURL', 'manual_url': 'manual',
    'documentation_url': 'documentation', 'technical_spec_url': 'technicalSpecification',
    'image_url': 'photo', 'image_source_url': 'imageSource',
    'product_page_url': 'productPage', 'brochure_url': 'brochure',
}
IO_FIELDS = {
    'inputs_and_states': ('inputDescription', 'Input and input states'),
    'outputs_and_states': ('outputDescription', 'Output and output states'),
    'units_of_measure': ('measuringUnitsDescription', 'Measuring units'),
}
IDENTITY_NOTE = (
    'One resource per catalog equipment ID, representing a model or category-context '
    'record, not a count of physical assets. Variants and repeated model contexts are '
    'retained. Catalog process/material associations do not establish exact-model '
    'suitability. Input/output and unit descriptions preserve source text; they are '
    'not parsed into an executable control interface. Prices are dated source quotes '
    'or explicitly labeled estimates, not live offers. No private inventory, serial '
    'numbers, saved workflows or source document files are included.'
)


def node(kind, identifier):
    return URIRef(BASE + 'id/' + kind + '/' + quote(str(identifier), safe=''))


def normalized(value):
    return re.sub(r'[^a-z0-9+]', '', unicodedata.normalize('NFKC', value).casefold())


def brand_id(value):
    # Reuse the existing whole-ontology manufacturer identifiers.
    return re.sub(r'[^\w]+', '', unicodedata.normalize('NFKC', value).casefold())


def terms(value):
    return [v.strip() for v in value.split(';') if v.strip()]


def camel(value):
    first, *rest = value.split('_')
    return first + ''.join(v.title() for v in rest)


def read_csv(root, name):
    with (root / 'catalog' / name).open(encoding='utf-8-sig', newline='') as source:
        return [{key: value.replace('\r\n', '\n') for key, value in row.items()} for row in csv.DictReader(source)]


def source_hash(path):
    # Same portability policy as the existing whole-ontology exporter.
    return hashlib.sha256(path.read_bytes().replace(b'\r\n', b'\n')).hexdigest()


def index(rows, field):
    result = {}
    for row in rows:
        identifier = row[field]
        if not identifier or identifier in result:
            raise ValueError('Empty or duplicate ' + field)
        result[identifier] = row
    return result


def web_uri(value):
    """Only public HTTP(S) source identifiers; never file paths or credentials."""
    if not value:
        return None
    parsed = urlsplit(value)
    if parsed.scheme not in ('https', 'http') or not parsed.netloc:
        return None
    if parsed.username or parsed.password or parsed.hostname in ('localhost', '127.0.0.1', '::1'):
        raise ValueError('Nonpublic URL in public input')
    return URIRef(quote(value, safe="/:?#[]@!$&'()*+,;=%"))


def numeric(value):
    result = Decimal(str(value))
    if not result.is_finite() or result < 0:
        raise ValueError('Invalid nonnegative numeric value')
    return result


def build_graph(root=ROOT, snapshot_date='2026-11-04'):
    root = Path(root)
    date.fromisoformat(snapshot_date)
    records = read_csv(root, 'equipment.csv')
    equipment = index(records, 'equipment_id')
    io = index(read_csv(root, 'equipment_io.csv'), 'equipment_id')
    categories = index(read_csv(root, 'categories.csv') + read_csv(root, 'supplemental_categories.csv'), 'category_id')
    routes = index(read_csv(root, 'routes.csv'), 'route_id')
    makers = index(read_csv(root, 'manufacturers.csv'), 'manufacturer')
    families = index(read_csv(root, 'product_families.csv'), 'equipment_id')
    lifecycle = index(read_csv(root, 'model_lifecycle.csv'), 'equipment_id')
    estimates = index(read_csv(root, 'equipment_msrp_estimates.csv'), 'equipment_id')
    rates = json.loads((root / 'catalog/currency_reference_rates.json').read_text(encoding='utf-8'))
    for rows in (io, families, lifecycle, estimates):
        if set(rows) - set(equipment):
            raise ValueError('Unknown equipment ID in auxiliary input')
        for identifier, row in rows.items():
            original = equipment[identifier]
            if any(normalized(row[k]) != normalized(original[k]) for k in ['manufacturer', 'model_name']):
                raise ValueError('Exact-model mismatch for ' + identifier)

    graph = Graph()
    for prefix, ns in [('icon', ICON), ('schema', SCHEMA), ('prov', PROV), ('dct', DCTERMS),
                       ('dcat', DCAT), ('skos', SKOS), ('owl', OWL), ('rdfs', RDFS), ('xsd', XSD)]:
        graph.bind(prefix, ns)

    def text(subject, predicate, value):
        if value is not None and value != '':
            literal = value if isinstance(value, Literal) else Literal(value)
            if literal.datatype == XSD.decimal:
                lexical = format(Decimal(str(literal)), 'f')
                if '.' not in lexical:
                    lexical += '.0'
                literal = Literal(lexical, datatype=XSD.decimal)
            graph.add((subject, predicate, literal))

    def link(subject, predicate, value):
        target = web_uri(value)
        if target:
            graph.add((subject, predicate, target))

    def entity(kind, identifier, cls, label):
        subject = node(kind, identifier)
        graph.add((subject, RDF.type, cls))
        text(subject, DCTERMS.identifier, identifier)
        text(subject, RDFS.label, label)
        return subject

    dataset = entity('dataset', 'equipment', DCAT.Dataset, 'ICoN-PCL Nanomaterial Equipment Ontology — equipment records')
    text(dataset, DCTERMS.description, IDENTITY_NOTE)
    text(dataset, DCTERMS.issued, Literal(snapshot_date, datatype=XSD.date))
    text(dataset, DCTERMS.rights, 'Code license is in the repository LICENSE. Linked third-party manuals, photographs and source material retain their own rights; this export does not relicense them.')
    graph.add((dataset, DCTERMS.conformsTo, URIRef(BASE + 'blob/main/catalog/metadata-profile.json')))
    for filename in INPUTS:
        source = URIRef(RAW + 'catalog/' + filename)
        graph.add((dataset, PROV.wasDerivedFrom, source))
        text(source, ICON.sha256LFNormalized, source_hash(root / 'catalog' / filename))
    for extension, media in [('ttl', 'text/turtle'), ('rdf', 'application/rdf+xml')]:
        distribution = node('distribution', 'equipment.' + extension)
        graph.add((dataset, DCAT.distribution, distribution))
        graph.add((distribution, RDF.type, DCAT.Distribution))
        graph.add((distribution, DCAT.downloadURL, URIRef(RAW + 'catalog/ontology/equipment.' + extension)))
        text(distribution, DCAT.mediaType, media)

    for identifier, row in sorted(categories.items()):
        subject = entity('category', identifier, ICON.EquipmentCategory, row['category_name'])
        graph.add((subject, RDF.type, SKOS.Concept))
        text(subject, SKOS.notation, identifier)
    for identifier, row in sorted(routes.items()):
        subject = entity('route', identifier, ICON.Route, row['route_name'])
        graph.add((subject, RDF.type, SKOS.Concept))
        graph.add((subject, RDF.type, ICON.MaterialFamily if row['route_kind'] == 'material_family' else ICON.ManufacturingProcess))
        text(subject, SKOS.notation, identifier)
        text(subject, ICON.associationBasis, row['association_basis'])

    for row in records:
        identifier = row['equipment_id']
        subject = entity('equipment', identifier, ICON.EquipmentModel, row['model_name'])
        graph.add((subject, RDF.type, SCHEMA.ProductModel))
        graph.add((subject, DCTERMS.isPartOf, dataset))
        graph.add((subject, PROV.wasDerivedFrom, URIRef(RAW + 'catalog/equipment.csv')))
        text(subject, SCHEMA.name, row['model_name'])
        text(subject, SCHEMA.model, row['model_name'])
        if row['category_id'] not in categories:
            raise ValueError('Unknown category')
        graph.add((subject, ICON.inCategory, node('category', row['category_id'])))
        graph.add((subject, SCHEMA.category, node('category', row['category_id'])))
        maker = entity('manufacturer', brand_id(row['manufacturer']), ICON.Manufacturer, row['manufacturer'])
        graph.add((subject, ICON.manufacturer, maker))
        # An unspecified maker label is not a verified organization.
        if row['manufacturer'].casefold() != 'unspecified':
            graph.add((subject, SCHEMA.manufacturer, maker))
            graph.add((maker, RDF.type, SCHEMA.Organization))
        brand = makers[row['manufacturer']]
        for key in ['brand_identity_status', 'research_use_status', 'verification_basis', 'verification_notes', 'company_status', 'company_status_note', 'review_date']:
            text(maker, ICON[camel(key)], brand[key])
        for key, prop in [('official_website_url', SCHEMA.url), ('research_evidence_url', ICON.researchEvidenceURL), ('company_status_source_url', ICON.companyStatusSource)]:
            link(maker, prop, brand[key])
        for key in TEXT_FIELDS:
            text(subject, ICON[camel(key)], row[key])
        for key, predicate in URL_FIELDS.items():
            link(subject, ICON[predicate], row[key])
            if key in ('manual_url', 'documentation_url', 'technical_spec_url', 'brochure_url'):
                link(subject, DCTERMS.references, row[key])
        link(subject, SCHEMA.url, row['product_page_url'])
        link(subject, SCHEMA.image, row['image_url'])
        for field in ['related_process_ids', 'related_material_ids']:
            for route_id in terms(row[field]):
                if route_id not in routes:
                    raise ValueError('Unknown process/material association')
                graph.add((subject, ICON.catalogAssociation, node('route', route_id)))
        for old in terms(row['legacy_category_ids']):
            text(subject, ICON.legacyCategoryID, old)

        family = families.get(identifier)
        if family:
            target = entity('product-family', family['product_family_id'], ICON.ProductFamily, family['product_family'])
            graph.add((subject, ICON.inProductFamily, target))
            text(subject, ICON.variantLabel, family['variant_label'])
            text(subject, ICON.modelVariantID, family['model_variant_id'])
            text(target, ICON.groupingBasis, family['grouping_basis'])
            link(target, PROV.wasDerivedFrom, family['grouping_source_url'])
        review = lifecycle.get(identifier, {})
        for key in ['lifecycle_status', 'successor_model_name', 'successor_scope', 'successor_checked_date', 'successor_relationship']:
            text(subject, ICON[camel(key)], review.get(key, ''))
        for key in ['successor_product_url', 'successor_evidence_url']:
            link(subject, ICON[camel(key)], review.get(key, ''))

        profile = io.get(identifier)
        text(subject, ICON.inputOutputStatus, 'exact_model_source_row' if profile else 'no_exact_model_data')
        if profile:
            target = entity('equipment-io', identifier, ICON.InputOutputProfile, row['model_name'] + ' — input/output metadata')
            graph.add((subject, ICON.inputOutputProfile, target))
            graph.add((target, PROV.wasDerivedFrom, URIRef(RAW + 'catalog/equipment_io.csv')))
            for key, (predicate, label) in IO_FIELDS.items():
                text(target, ICON[predicate], profile[key])
                if profile[key]:
                    value = node('equipment-property', identifier + ':' + key)
                    graph.add((subject, SCHEMA.additionalProperty, value))
                    graph.add((value, RDF.type, SCHEMA.PropertyValue))
                    text(value, SCHEMA.name, label)
                    text(value, SCHEMA.propertyID, key)
                    text(value, SCHEMA.value, profile[key])
                    graph.add((value, PROV.wasDerivedFrom, target))
            for key in ['source_sha256', 'source_sheet', 'source_row', 'source_model', 'imported_date']:
                text(target, ICON[camel(key)], profile['equipment_io_' + key])
            for key in ['equipment_io_manual_url', 'equipment_io_spec_url']:
                link(target, DCTERMS.references, profile[key])

    def price(identifier, quote_id, amount, currency, kind, source_url, checked, scope, seller='', condition='', estimate=None):
        amount = numeric(amount)
        source_currency = currency.strip().upper()
        if not source_currency:
            raise ValueError('Missing currency for priced record')
        rate_values = rates['units_per_eur']
        conversion = Decimal(1) if source_currency == 'USD' else numeric(rate_values['USD']) / numeric(rate_values[source_currency])
        target = entity('price-estimate' if estimate else 'price-quote', quote_id,
                        ICON.PriceEstimate if estimate else ICON.PriceQuote, kind)
        graph.add((node('equipment', identifier), ICON.priceEstimate if estimate else ICON.priceQuote, target))
        graph.add((target, RDF.type, SCHEMA.PriceSpecification))
        text(target, SCHEMA.priceCurrency, 'USD')
        text(target, ICON.originalCurrency, source_currency)
        text(target, ICON.originalPrice, Literal(amount, datatype=XSD.decimal))
        text(target, ICON.priceKind, kind)
        text(target, ICON.checkedDate, checked)
        text(target, DCTERMS.description, scope)
        text(target, ICON.sellerName, seller)
        text(target, ICON.condition, condition)
        for url in terms(source_url):
            link(target, PROV.wasDerivedFrom, url)
        usd = (amount * conversion).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
        if estimate:
            high = numeric(estimate['estimated_msrp_high'])
            if high < amount:
                raise ValueError('Reversed price estimate')
            text(target, SCHEMA.minPrice, Literal(usd, datatype=XSD.decimal))
            text(target, SCHEMA.maxPrice, Literal((high * conversion).quantize(Decimal('.01'), rounding=ROUND_HALF_UP), datatype=XSD.decimal))
            text(target, ICON.originalMaxPrice, Literal(high, datatype=XSD.decimal))
            for key in ['estimate_method', 'estimate_status', 'estimate_subject', 'estimate_basis', 'estimate_confidence', 'estimate_benchmark_ids']:
                text(target, ICON[camel(key)], estimate[key])
        else:
            text(target, SCHEMA.price, Literal(usd, datatype=XSD.decimal))
        if source_currency != 'USD':
            text(target, ICON.fxRate, Literal(conversion, datatype=XSD.decimal))
            text(target, ICON.fxDate, rates['date'])
            link(target, ICON.fxSource, rates['source_url'])

    for row in records:
        identifier = row['equipment_id']
        for prefix, kind in [('msrp', 'explicit_msrp'), ('manufacturer_price', row['manufacturer_price_kind'])]:
            if row[prefix + '_value']:
                price(identifier, identifier + ':' + prefix, row[prefix + '_value'], row[prefix + '_currency'], kind,
                      row['price_source_url'] if prefix == 'msrp' else row['manufacturer_price_source_url'],
                      row['price_checked_date'] if prefix == 'msrp' else row['manufacturer_price_checked_date'],
                      row['manufacturer_price_scope'] if prefix != 'msrp' else 'Catalog explicit MSRP; retain its source date.')
        estimate = estimates.get(identifier, {})
        if estimate.get('estimated_msrp_low') and estimate.get('estimated_msrp_high'):
            price(identifier, identifier + ':estimate', estimate['estimated_msrp_low'], estimate['estimate_currency'], 'estimated_msrp',
                  estimate['estimate_source_urls'], estimate['estimate_checked_date'], estimate['estimate_basis'], estimate=estimate)
    for offer in read_csv(root, 'seller_offers.csv'):
        identifier = offer['equipment_id']
        if identifier not in equipment or any(normalized(offer[k]) != normalized(equipment[identifier][k]) for k in ['manufacturer', 'model_name']):
            raise ValueError('Seller offer exact-model mismatch')
        price(identifier, offer['offer_id'], offer['price_value'], offer['currency'], offer['price_kind'],
              offer['source_url'], offer['checked_date'], offer['scope'], offer['seller_name'], offer['condition'])

    for row in read_csv(root, 'evidence_registry.csv'):
        linked = [r['record_id'] for r in json.loads(row['related_records_json']) if r['record_type'] == 'equipment' and r['record_id'] in equipment]
        if not linked:
            continue
        target = entity('evidence', row['evidence_id'], ICON.SourceEvidence, row['claim'])
        text(target, ICON.claim, row['claim'])
        text(target, ICON.classification, row['classification'])
        text(target, ICON.scope, row['scope'])
        graph.add((target, RDF.type, PROV.Entity))
        graph.add((target, PROV.wasDerivedFrom, URIRef(RAW + 'catalog/evidence_registry.csv')))
        for identifier in linked:
            graph.add((node('equipment', identifier), ICON.supportedBy, target))
        for number, source in enumerate(json.loads(row['sources_json']), start=1):
            citation = node('evidence-source', row['evidence_id'] + ':' + str(number))
            graph.add((target, DCTERMS.source, citation))
            graph.add((citation, RDF.type, PROV.Entity))
            text(citation, DCTERMS.title, source.get('title', ''))
            text(citation, ICON.sourceLocator, source.get('locator', ''))
            text(citation, ICON.checkedDate, source.get('checked_date', ''))
            link(citation, PROV.hadPrimarySource, source.get('url', ''))
            link(target, PROV.wasDerivedFrom, source.get('url', ''))

    # A self-describing local vocabulary, alongside the existing exchange terms.
    for cls in sorted(set(graph.objects(None, RDF.type)), key=str):
        if str(cls).startswith(str(ICON)):
            graph.add((cls, RDF.type, OWL.Class))
            text(cls, RDFS.label, re.sub(r'(?<!^)(?=[A-Z])', ' ', str(cls).split('#')[-1]))
    for predicate in sorted(set(graph.predicates()), key=str):
        if str(predicate).startswith(str(ICON)):
            objects = list(graph.objects(None, predicate))
            graph.add((predicate, RDF.type, OWL.ObjectProperty if all(isinstance(o, URIRef) for o in objects) else OWL.DatatypeProperty))
            text(predicate, RDFS.label, re.sub(r'(?<!^)(?=[A-Z])', ' ', str(predicate).split('#')[-1]))
    text(ICON.catalogAssociation, RDFS.comment, 'Scoped catalog relevance only; does not certify exact-model suitability or experimental use.')
    text(ICON.inProductFamily, RDFS.comment, 'Curated display grouping; does not imply identity or inheritance of features between models.')
    report = {
        'schema': 'iconpcl-equipment-rdf-export/v1', 'snapshot_date': snapshot_date,
        'equipment_records': len(equipment), 'equipment_with_io': len(io),
        'equipment_without_io': sorted(set(equipment) - set(io)),
        'rdf_triples': len(graph), 'scope': IDENTITY_NOTE,
        'price_quotes': len(set(graph.subjects(RDF.type, ICON.PriceQuote))),
        'price_estimates': len(set(graph.subjects(RDF.type, ICON.PriceEstimate))),
        'direct_equipment_evidence_records': len(set(graph.subjects(RDF.type, ICON.SourceEvidence))),
        'input_hash_policy': 'SHA-256 after CRLF to LF normalization; original source-document hashes remain as recorded.',
        'input_sha256': {name: source_hash(root / 'catalog' / name) for name in INPUTS},
    }
    return graph, report


def export(root=ROOT, snapshot_date='2026-11-04', output_dir=None):
    graph, report = build_graph(root, snapshot_date)
    output = Path(output_dir) if output_dir else Path(root) / 'catalog/ontology'
    output.mkdir(parents=True, exist_ok=True)
    for filename, fmt in [('equipment.ttl', 'turtle'), ('equipment.rdf', 'xml')]:
        content = graph.serialize(format=fmt, encoding='utf-8')
        parsed = Graph().parse(data=content, format=fmt)
        if not isomorphic(graph, parsed):
            raise ValueError('RDF round-trip validation failed')
        (output / filename).write_bytes(content)
        report.setdefault('files', {})[filename] = {'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest(), 'format': fmt}
    report['validation'] = {'turtle_round_trip': True, 'rdf_xml_round_trip': True, 'equivalent_graphs': True, 'exact_model_io_matching': True}
    (output / 'equipment-export.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--date', required=True, help='Snapshot date, YYYY-MM-DD; does not redate source quotes.')
    parser.add_argument('--output-dir', type=Path)
    args = parser.parse_args()
    result = export(snapshot_date=args.date, output_dir=args.output_dir)
    print(json.dumps({k: result[k] for k in ['snapshot_date', 'equipment_records', 'equipment_with_io', 'rdf_triples', 'price_quotes', 'price_estimates']}, indent=2))
