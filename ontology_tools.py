"""Reproducible public ontology export, validation and model-name review.

No network calls, inventory files, saved user plans or model fitting are used.
"""
import argparse
import csv
import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from decimal import Decimal
from importlib.metadata import version
from pathlib import Path
from urllib.parse import quote

import networkx as nx
from pyshacl import validate as shacl_validate
from rdflib import Graph, Literal, Namespace, URIRef
from rdflib.namespace import DCTERMS, OWL, RDF, RDFS, XSD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors

from ontology_models import EquipmentIdentity, Requirements, schemas
from ontology_units import check_registry, normalize_condition
from process_science_tools import dataset
from reference_classification import derive_classes
from metadata_profile import add_standard_metadata

ROOT = Path(__file__).resolve().parent
BASE = 'https://github.com/PodComet/ICoN-PCL-Equipment-Metadata/'
VOCAB = Namespace(BASE + 'ontology#')
PROV = Namespace('http://www.w3.org/ns/prov#')
SH = Namespace('http://www.w3.org/ns/shacl#')
LIBRARIES = ['pint', 'pydantic', 'rdflib', 'pyshacl', 'networkx', 'scikit-learn']


def read(root, name):
    with (Path(root) / 'catalog' / (name + '.csv')).open(encoding='utf-8-sig', newline='') as source:
        return list(csv.DictReader(source))


def ids(text):
    return [part.strip() for part in text.split(';') if part.strip()]


def node(kind, identifier):
    return URIRef(BASE + 'id/' + kind + '/' + quote(str(identifier), safe=''))


def unique(rows, field):
    values = [r[field] for r in rows]
    if any(not v.strip() for v in values) or len(values) != len(set(values)):
        raise ValueError('Empty or duplicate ' + field)
    return set(values)


def require_links(values, known, context):
    missing = sorted(set(values) - known)
    if missing:
        raise ValueError(context + ' has unresolved links: ' + ', '.join(missing))


def validate_catalog(records, categories, routes, steps, formulations, references):
    category_ids = unique(categories, 'category_id')
    route_ids = unique(routes, 'route_id')
    material_ids = {r['route_id'] for r in routes if r['route_kind'] == 'material_family'}
    unique(records, 'equipment_id')
    unique(formulations, 'formulation_id')
    reference_ids = unique(references, 'reference_id')
    seen_steps = set()
    for record in records:
        EquipmentIdentity.model_validate(record)
        require_links([record['category_id']], category_ids, record['equipment_id'])
        require_links(ids(record['related_material_ids']), material_ids, record['equipment_id'])
        require_links(ids(record['related_process_ids']), route_ids, record['equipment_id'])
    for category in categories:
        require_links(ids(category['related_process_ids']), route_ids, category['category_id'])
        require_links(ids(category['related_material_ids']), material_ids, category['category_id'])
    for route in routes:
        require_links(ids(route['equipment_category_ids']), category_ids, route['route_id'])
        require_links(ids(route['related_material_ids']), material_ids, route['route_id'])
    for step in steps:
        require_links([step['route_id']], route_ids, 'Process step')
        key = (step['route_id'], step['step_order'])
        order = Decimal(step['step_order'])
        if key in seen_steps or not order.is_finite() or order < 0:
            raise ValueError('Invalid or duplicate source step ' + str(key))
        seen_steps.add(key)
        require_links(ids(step['equipment_category_ids']), category_ids, str(key))
        if step['requirements_json']:
            req = Requirements.model_validate_json(step['requirements_json'])
            required = [c for b in req.required_branches + req.optional_branches for c in b]
            required += req.optional_category_ids + list(req.allowed_subtypes_by_category)
            for override in req.when_selected:
                if set(override) != {'category_id', 'required_branches', 'notes'}:
                    raise ValueError('Unknown conditional requirement fields')
                required += [override['category_id']] + [c for b in override['required_branches'] for c in b]
            require_links(required, category_ids, str(key))
    for formulation in formulations:
        require_links([formulation['route_id']], route_ids, formulation['formulation_id'])
        require_links(json.loads(formulation['reference_ids_json']), reference_ids, formulation['formulation_id'])


def dependency_audit(steps):
    """Validate explicit prerequisites, or the app's legacy linear fallback."""
    graph = nx.DiGraph()
    if any(not isinstance(s.get('step_id'), str) or not s['step_id'] for s in steps):
        raise ValueError('Every step needs a nonempty string identity')
    graph.add_nodes_from(s['step_id'] for s in steps)
    if graph.number_of_nodes() != len(steps):
        raise ValueError('Duplicate step identity')
    for index, step in enumerate(steps):
        extensions = step.get('extensions', {})
        if not isinstance(extensions, dict):
            raise ValueError('Step extensions must be an object')
        parents = extensions['prerequisite_step_ids'] if 'prerequisite_step_ids' in extensions else ([steps[index-1]['step_id']] if index else [])
        if not isinstance(parents, list) or any(not isinstance(p, str) for p in parents):
            raise ValueError('Invalid prerequisites')
        if len(parents) != len(set(parents)) or any(p not in graph or p == step['step_id'] for p in parents):
            raise ValueError('Missing, repeated or self-referencing prerequisite')
        graph.add_edges_from((parent, step['step_id']) for parent in parents)
    if not nx.is_directed_acyclic_graph(graph):
        raise ValueError('Process dependencies contain a cycle')
    levels = [sorted(level) for level in nx.topological_generations(graph)]
    return graph, levels


def source_sequences(routes, steps):
    summaries = []
    for route in sorted(routes, key=lambda r: r['route_id']):
        ordered = sorted((s for s in steps if s['route_id'] == route['route_id']), key=lambda s: Decimal(s['step_order']))
        by_order = {s['step_order']: s for s in ordered}
        for step in ordered:
            for field in ('anchor_step_order', 'before_step_order'):
                if step[field] and step[field] not in by_order:
                    raise ValueError('Unknown extension anchor in ' + route['route_id'])
            if step['anchor_step_order'] and Decimal(step['anchor_step_order']) >= Decimal(step['step_order']):
                raise ValueError('Extension must follow its anchor')
            if step['before_step_order'] and Decimal(step['before_step_order']) <= Decimal(step['step_order']):
                raise ValueError('Extension must precede its successor')
        workflow_steps = [{'step_id': s['route_id'] + ':' + s['step_order']} for s in ordered]
        graph, levels = dependency_audit(workflow_steps)
        summaries.append({'route_id': route['route_id'], 'step_count': len(ordered),
                          'status': 'acyclic_source_order' if ordered else 'no_source_sequence',
                          'levels': levels, 'edge_count': graph.number_of_edges()})
    return summaries


def normalized_name(text):
    return re.sub(r'[^\w]+', '', unicodedata.normalize('NFKC', text).casefold())


def model_review(records, families):
    """Name similarity is a curation aid, never identity or successor evidence."""
    group = defaultdict(list)
    for record in records:
        group[normalized_name(record['manufacturer'])].append(record)
    family = {r['equipment_id']: r['model_variant_id'] for r in families}
    candidates, intentional = {}, 0
    for rows in group.values():
        rows = sorted(rows, key=lambda r: r['equipment_id'])
        if len(rows) < 2:
            continue
        names = [unicodedata.normalize('NFKC', r['model_name']).casefold() for r in rows]
        matrix = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 5)).fit_transform(names)
        neighbors = NearestNeighbors(metric='cosine', algorithm='brute').fit(matrix)
        distances, indices = neighbors.kneighbors(matrix, n_neighbors=min(6, len(rows)))
        for i, (distance_row, index_row) in enumerate(zip(distances, indices)):
            for distance, j in zip(distance_row, index_row):
                if j == i or 1 - distance < .90:
                    continue
                a, b = sorted([rows[i], rows[j]], key=lambda r: r['equipment_id'])
                key = (a['equipment_id'], b['equipment_id'])
                if key in candidates:
                    continue
                same_name = normalized_name(a['model_name']) == normalized_name(b['model_name'])
                curated = family.get(a['equipment_id']) and family.get(a['equipment_id']) == family.get(b['equipment_id'])
                if curated and a['category_id'] != b['category_id']:
                    intentional += int(i < j)
                    continue
                candidates[key] = {'equipment_a': key[0], 'equipment_b': key[1],
                                   'manufacturer': a['manufacturer'], 'model_a': a['model_name'], 'model_b': b['model_name'],
                                   'similarity': round(float(1-distance), 6),
                                   'reason': 'same_normalized_name' if same_name else 'similar_model_names_may_be_distinct_variants',
                                   'status': 'review_only_no_merge'}
    return sorted(candidates.values(), key=lambda r: (-r['similarity'], r['equipment_a'], r['equipment_b'])), intentional


def build_graph(root, science, records, categories, routes, steps, formulations, references, definitions):
    graph = Graph()
    for prefix, ns in [('icon', VOCAB), ('prov', PROV), ('dct', DCTERMS), ('owl', OWL), ('rdfs', RDFS), ('xsd', XSD)]:
        graph.bind(prefix, ns)

    def entity(kind, identifier, cls, label):
        subject = node(kind, identifier)
        graph.add((subject, RDF.type, VOCAB[cls]))
        graph.add((subject, DCTERMS.identifier, Literal(identifier)))
        graph.add((subject, RDFS.label, Literal(label)))
        return subject

    def field(subject, predicate, value):
        if value is not None and value != '':
            graph.add((subject, VOCAB[predicate], Literal(value)))

    for cls in ['EquipmentModel', 'EquipmentCategory', 'Manufacturer', 'Route', 'MaterialFamily', 'ManufacturingProcess', 'ProcessStep', 'Formulation', 'SourceEvidence', 'OperatingCondition', 'ReportedProperty', 'AcademicReference', 'ArticleClassAssertion', 'ReferenceLink', 'RequirementBranch', 'EquipmentRequirement', 'QuantityKind']:
        graph.add((VOCAB[cls], RDF.type, OWL.Class))
    ontology = URIRef(BASE + 'ontology')
    graph.add((ontology, RDF.type, OWL.Ontology))
    graph.add((ontology, DCTERMS.description, Literal('Public catalog snapshot. Category associations are scoped candidates, not validated exact-model suitability or operating procedures. No private inventory or saved user plans.')))
    for category in categories:
        entity('category', category['category_id'], 'EquipmentCategory', category['category_name'])
    for record in records:
        subject = entity('equipment', record['equipment_id'], 'EquipmentModel', record['model_name'])
        manufacturer_id = normalized_name(record['manufacturer'])
        brand = entity('manufacturer', manufacturer_id, 'Manufacturer', record['manufacturer'])
        graph.add((subject, VOCAB.manufacturer, brand))
        graph.add((subject, VOCAB.inCategory, node('category', record['category_id'])))
        field(subject, 'associationBasis', record['association_basis'])
        for route_id in ids(record['related_process_ids']) + ids(record['related_material_ids']):
            graph.add((subject, VOCAB.catalogAssociation, node('route', route_id)))
        for key, predicate in [('product_page_url', 'productPage'), ('technical_spec_url', 'technicalSpecification'), ('manual_url', 'manual'), ('image_url', 'photo')]:
            if record[key].startswith(('https://', 'http://')):
                graph.add((subject, VOCAB[predicate], URIRef(record[key])))
        field(subject, 'manualMatchStatus', record['manual_match_status'])
    for route in routes:
        subject = entity('route', route['route_id'], 'Route', route['route_name'])
        graph.add((subject, RDF.type, VOCAB.MaterialFamily if route['route_kind'] == 'material_family' else VOCAB.ManufacturingProcess))
        field(subject, 'associationBasis', route['association_basis'])
    grouped = defaultdict(list)
    for step in steps:
        grouped[step['route_id']].append(step)
        identifier = step['route_id'] + ':' + step['step_order']
        subject = entity('step', identifier, 'ProcessStep', step['step_label'])
        graph.add((subject, VOCAB.inRoute, node('route', step['route_id'])))
        field(subject, 'sourceOrder', float(step['step_order']))
        field(subject, 'sourceSequence', step['equipment_sequence'])
        if step['requirements_json']:
            req = json.loads(step['requirements_json'])
            field(subject, 'requirementsJSON', step['requirements_json'])
            field(subject, 'requiresConfigurationReview', req['readiness_review_required'])
            for index, branch in enumerate(req['required_branches']):
                branch_id = identifier + ':branch:' + str(index+1)
                branch_node = entity('branch', branch_id, 'RequirementBranch', 'Required alternative ' + str(index+1))
                graph.add((subject, VOCAB.requiredAlternative, branch_node))
                for occurrence, category_id in enumerate(branch):
                    graph.add((branch_node, VOCAB.requiresCategory, node('category', category_id)))
                    occurrence_node = entity('requirement', branch_id + ':' + str(occurrence+1), 'EquipmentRequirement', category_id + ' requirement ' + str(occurrence+1))
                    graph.add((branch_node, VOCAB.hasRequirement, occurrence_node))
                    graph.add((occurrence_node, VOCAB.requiresCategory, node('category', category_id)))
            for category_id in req['optional_category_ids']:
                graph.add((subject, VOCAB.optionalCategory, node('category', category_id)))
        else:
            for category_id in ids(step['equipment_category_ids']):
                graph.add((subject, VOCAB.sourceCandidateCategory, node('category', category_id)))
    for route_id, sequence in grouped.items():
        sequence.sort(key=lambda s: Decimal(s['step_order']))
        for before, after in zip(sequence, sequence[1:]):
            graph.add((node('step', route_id + ':' + after['step_order']), VOCAB.sourceOrderPredecessor, node('step', route_id + ':' + before['step_order'])))
    for reference in references:
        subject = entity('reference', reference['reference_id'], 'AcademicReference', reference['title'])
        field(subject, 'publicationYear', reference['publication_year'])
        if reference['doi']:
            graph.add((subject, DCTERMS.identifier, Literal('doi:' + reference['doi'])))
    reference_links = read(root, 'reference_links')
    for link in reference_links:
        subject = entity('reference-link', link['link_id'], 'ReferenceLink', link['claim'])
        graph.add((subject, DCTERMS.references, node('reference', link['reference_id'])))
        field(subject, 'relation', link['relation'])
        field(subject, 'reviewStatus', link['review_status'])
        field(subject, 'sourceLocator', link['locator'])
        field(subject, 'scope', link['scope'])
    article_classes, _, _ = derive_classes(root, {'references': references, 'reference_links': reference_links})
    for classification in article_classes:
        identifier = ':'.join(classification[k] for k in ['reference_id', 'class_id', 'basis'])
        subject = entity('article-class', identifier, 'ArticleClassAssertion', classification['class_name'])
        graph.add((subject, DCTERMS.references, node('reference', classification['reference_id'])))
        target_kind = 'category' if classification['class_type'] == 'M' else 'route'
        graph.add((subject, VOCAB.classificationTarget, node(target_kind, classification['class_id'])))
        field(subject, 'classificationBasis', classification['basis'])
        field(subject, 'scope', classification['scope'])
        for source in ids(classification['source_link_ids']):
            graph.add((subject, PROV.wasDerivedFrom, node('reference-link', source)))
        for via in ids(classification['via_class_ids']):
            graph.add((subject, VOCAB.inferredViaProcess, node('route', via)))
    for formulation in formulations:
        subject = entity('formulation', formulation['formulation_id'], 'Formulation', formulation['label'])
        graph.add((subject, VOCAB.inRoute, node('route', formulation['route_id'])))
        field(subject, 'outputLabel', formulation['output_label'])
        field(subject, 'scope', formulation['scope'])
        field(subject, 'batchBasis', formulation['batch_basis'])
        for reference in json.loads(formulation['reference_ids_json']):
            graph.add((subject, DCTERMS.references, node('reference', reference)))
    for evidence in science['evidence']:
        subject = entity('evidence', evidence['evidence_id'], 'SourceEvidence', evidence['source_title'])
        graph.add((subject, PROV.hadPrimarySource, URIRef(evidence['source_url'])))
        field(subject, 'claim', evidence['claim'])
        field(subject, 'sourceLocator', evidence['source_locator'])
        field(subject, 'classification', evidence['classification'])
        field(subject, 'scope', evidence['scope'])
        for reference in evidence['reference_ids']:
            graph.add((subject, DCTERMS.references, node('reference', reference)))
    for key, definition in definitions.items():
        entity('quantity-kind', key, 'QuantityKind', definition['label'])
    normalization = []
    for condition in science['conditions']:
        subject = entity('condition', condition['template_id'], 'OperatingCondition', condition['label'])
        graph.add((subject, VOCAB.quantityKind, node('quantity-kind', condition['parameter'])))
        canonical = normalize_condition(condition, definitions)
        if canonical:
            field(subject, 'canonicalValue', canonical['value'])
            field(subject, 'canonicalUpperValue', canonical['upper_value'])
            field(subject, 'canonicalUnit', canonical['unit'])
            field(subject, 'semanticDimension', canonical['semantic_dimension'])
        normalization.append({'template_id': condition['template_id'], 'evidence_id': condition['evidence_id'], 'reported_value': condition['value'], 'reported_unit': condition['unit'], 'canonical': canonical})
        for predicate, value in [('reportedValue', condition['value']), ('reportedUpperValue', condition['upper_value']), ('reportedUnit', condition['unit']), ('operator', condition['operator']), ('reportedText', condition['text_value']), ('scope', condition['scope']), ('matchScope', condition['match_scope'])]:
            field(subject, predicate, value)
        graph.add((subject, VOCAB.inRoute, node('route', condition['route_id'])))
        graph.add((subject, VOCAB.inFormulation, node('formulation', condition['formulation_id'])))
        graph.add((subject, VOCAB.supportedBy, node('evidence', condition['evidence_id'])))
        if condition['source_step_order']:
            graph.add((subject, VOCAB.inStep, node('step', condition['route_id'] + ':' + condition['source_step_order'])))
    for prop in science['properties']:
        subject = entity('property', prop['anchor_id'], 'ReportedProperty', prop['label'])
        graph.add((subject, VOCAB.inRoute, node('route', prop['route_id'])))
        graph.add((subject, VOCAB.inFormulation, node('formulation', prop['formulation_id'])))
        graph.add((subject, VOCAB.supportedBy, node('evidence', prop['evidence_id'])))
        for predicate, value in [('reportedValue', prop['value']), ('reportedUpperValue', prop['upper_value']), ('reportedUnit', prop['unit']), ('operator', prop['operator']), ('reportedText', prop['text_value']), ('scope', prop['scope']), ('materialScope', prop['material_scope']), ('supportsExpectation', prop['supports_expectation'])]:
            field(subject, predicate, value)
        if prop['uncertainty']:
            field(subject, 'reportedUncertaintyJSON', json.dumps(prop['uncertainty'], sort_keys=True))
        for condition_id in prop['required_condition_ids']:
            graph.add((subject, VOCAB.requiresCondition, node('condition', condition_id)))
    return graph, normalization


def validate_graph(graph, root):
    shapes = Graph().parse(Path(root) / 'catalog/ontology/shapes.ttl', format='turtle')
    conforms, report, text = shacl_validate(graph, shacl_graph=shapes, inference='none', advanced=False, abort_on_first=False)
    if not conforms:
        raise ValueError('Ontology SHACL validation failed:\n' + text)
    return len(list(report.subjects(RDF.type, SH.ValidationResult)))


def json_text(data):
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + '\n'


def stable_jsonld(value):
    if isinstance(value, dict):
        return {k: stable_jsonld(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        return sorted((stable_jsonld(v) for v in value), key=lambda v: json.dumps(v, sort_keys=True))
    return value


def artifacts(root):
    root = Path(root)
    science = dataset(root)
    definitions = json.loads((root / 'catalog/condition_definitions.json').read_text(encoding='utf-8'))
    records, categories, routes, steps, formulations, references = [read(root, n) for n in ['equipment', 'categories', 'routes', 'route_steps', 'component_formulations', 'references']]
    categories += read(root, 'supplemental_categories')
    validate_catalog(records, categories, routes, steps, formulations, references)
    sequences = source_sequences(routes, steps)
    candidates, contexts = model_review(records, read(root, 'product_families'))
    reviews = {(r['equipment_a'], r['equipment_b']): r for r in read(root, 'model_identity_reviews')}
    for candidate in candidates:
        review = reviews.get((candidate['equipment_a'], candidate['equipment_b']))
        if review and review['model_a'] == candidate['model_a'] and review['model_b'] == candidate['model_b']:
            candidate.update(disposition=review['disposition'], review_basis=review['review_basis'], reviewed_date=review['reviewed_date'])
    graph, normalization = build_graph(root, science, records, categories, routes, steps, formulations, references, definitions)
    metadata_alignment = add_standard_metadata(graph, root, node)
    violations = validate_graph(graph, root)
    # A sorted N-Triples document is also valid Turtle, with no generated blank IDs.
    turtle = '\n'.join(sorted(line for line in graph.serialize(format='nt').splitlines() if line.strip())) + '\n'
    jsonld = json_text(stable_jsonld(json.loads(graph.serialize(format='json-ld'))))
    inputs = sorted(['equipment.csv', 'categories.csv', 'supplemental_categories.csv', 'routes.csv', 'route_steps.csv', 'component_formulations.csv', 'references.csv', 'reference_links.csv', 'product_families.csv', 'model_identity_reviews.csv', 'condition_definitions.json', 'process_conditions.csv', 'process_condition_evidence.csv', 'process_property_anchors.csv', 'process_science_review_2026-10-17.json', 'ontology/shapes.ttl'])
    inputs += ['metadata-profile.json', 'ontology_term_references.csv']
    hashes = {name: hashlib.sha256((root / 'catalog' / name).read_bytes().replace(b'\r\n', b'\n')).hexdigest() for name in inputs}
    report = {
        'schema': 'icon-ontology-audit/v1', 'review_date': science['checked_date'],
        'scope': 'Committed public catalog snapshot; excludes live admin edits, private inventory and saved user plans.',
        'status': 'passed', 'shacl_conforms': True, 'shacl_violations': violations,
        'metadata_alignment': metadata_alignment,
        'counts': {'equipment_records': len(records), 'categories': len(categories), 'm_categories': sum(c['category_id'].startswith('M') for c in categories), 'x_categories': sum(c['category_id'].startswith('X-') for c in categories), 'routes': len(routes),
                   'process_steps': len(steps), 'conditions': len(science['conditions']), 'source_evidence': len(science['evidence']),
                   'reported_properties': len(science['properties']), 'numeric_conditions': sum(r['canonical'] is not None for r in normalization),
                   'unit_definitions_checked': check_registry(definitions), 'rdf_triples': len(graph),
                   'acyclic_source_sequences': sum(s['status'] == 'acyclic_source_order' for s in sequences),
                   'routes_without_source_sequence': sum(s['status'] == 'no_source_sequence' for s in sequences),
                   'model_name_review_pairs': len(candidates), 'unreviewed_model_name_pairs': sum('disposition' not in c for c in candidates), 'recognized_cross_category_contexts': contexts},
        'libraries': {name: version(name) for name in LIBRARIES},
        'input_sha256_lf_normalized': hashes,
        'checks': ['Typed record contracts and cross-record links', 'Pint conversion parity, physical bounds and compatible uncertainty units',
                   'SHACL graph constraints with no inference', 'NetworkX source sequence and extension anchor checks',
                   'TF-IDF/cosine model-name review; no automatic merges or property-model training'],
        'limitations': ['A schema pass does not verify a scientific claim, web link, manufacturer or operating procedure.',
                       'Source-order predecessors describe the default planning display, not experimentally established causal dependencies.',
                       'Model-name similarity is not identity, interchangeability or successor evidence.',
                       'Experimental property validation remains future roadmap functionality.'],
        'source_sequences': sequences, 'model_review_candidates': candidates,
    }
    outputs = {'ontology.ttl': turtle, 'ontology.jsonld': jsonld, 'audit.json': json_text(report),
               'schemas.json': json_text(schemas()), 'normalized-conditions.json': json_text(normalization),
               'shapes.ttl': (root / 'catalog/ontology/shapes.ttl').read_text(encoding='utf-8')}
    outputs['metadata-profile.json'] = (root / 'catalog/metadata-profile.json').read_text(encoding='utf-8')
    outputs['ontology-term-references.csv'] = (root / 'catalog/ontology_term_references.csv').read_text(encoding='utf-8')
    return outputs, report


def build(root=ROOT, check=False):
    outputs, report = artifacts(root)
    for folder in [Path(root) / 'catalog/ontology', Path(root) / 'webapp/public/ontology']:
        if not check:
            folder.mkdir(parents=True, exist_ok=True)
        for name, content in outputs.items():
            target = folder / name
            if check:
                if not target.exists() or target.read_text(encoding='utf-8') != content:
                    raise ValueError('Stale ontology artifact: ' + str(target))
            else:
                target.write_text(content, encoding='utf-8', newline='\n')
    summary = {k: v for k, v in report.items() if k not in {'source_sequences', 'model_review_candidates', 'input_sha256_lf_normalized'}}
    target = Path(root) / 'webapp/app/data/ontology-health.json'
    if check:
        if not target.exists() or target.read_text(encoding='utf-8') != json_text(summary):
            raise ValueError('Stale ontology health summary')
    else:
        target.write_text(json_text(summary), encoding='utf-8', newline='\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify committed exports without changing files')
    parser.add_argument('--workflow', type=Path, help='Check a local exported workflow dependency graph without publishing it')
    args = parser.parse_args()
    if args.workflow:
        data = json.loads(args.workflow.read_text(encoding='utf-8'))
        workflow = data.get('workflow', data)
        graph, levels = dependency_audit(workflow['steps'])
        print(json_text({'acyclic': True, 'steps': graph.number_of_nodes(), 'levels': levels}))
    else:
        result = build(check=args.check)
        print(json_text({k: result[k] for k in ['status', 'counts', 'libraries']}))
