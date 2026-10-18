"""Derive article facets from scoped evidence, without promoting inferred model claims."""
import csv
from collections import defaultdict
from pathlib import Path

CLASS_FIELDS = ['reference_id', 'class_type', 'class_id', 'class_name', 'basis', 'via_class_ids', 'source_link_ids', 'scope']


def derive_classes(root, data):
    def read(name):
        with (Path(root) / 'catalog' / (name + '.csv')).open(encoding='utf-8-sig', newline='') as f:
            return list(csv.DictReader(f))
    def ids(value):
        return [x.strip() for x in value.split(';') if x.strip()]
    routes = {r['route_id']: r for r in read('routes')}
    categories = {r['category_id']: r for r in read('categories') + read('supplemental_categories')}
    equipment = {r['equipment_id']: r for r in read('equipment')}
    definitions = {key: value['route_name'] for key, value in routes.items()}
    definitions.update({key: value['category_name'] for key, value in categories.items()})
    # X categories remain available as direct context, but the requested machine facet is M.
    classes = [{'class_type': key[0], 'class_id': key, 'class_name': name}
               for key, name in sorted(definitions.items()) if key[0] in 'PMN']
    accumulated = {}
    def add(ref, key, basis, link, via='', scope=''):
        if key not in definitions or key[0] not in 'PMN':
            return
        group = accumulated.setdefault((ref, key, basis), {'links': set(), 'via': set(), 'scopes': set()})
        group['links'].add(link)
        if via:
            group['via'].add(via)
        if scope:
            group['scopes'].add(scope)
    for link in data['reference_links']:
        if link['review_status'] == 'needs_review':
            continue
        ref, key, source = link['reference_id'], link['target_id'], link['link_id']
        basis = 'checked_claim' if link['relation'] == 'supports_claim' else 'background'
        if link['target_type'] in {'route', 'category'}:
            add(ref, key, basis, source, scope=link['scope'])
            if key.startswith('P') and key in routes:
                route = routes[key]
                # The user requested machine classes implied by a process. Do not
                # infer every possible output family: a silver paper is not oxide evidence.
                for child in ids(route['equipment_category_ids']):
                    add(ref, child, 'process_inferred', source, key,
                        'Inferred from the current ontology for ' + key + '; not evidence that the paper used every listed class or an exact model.')
        elif link['target_type'] == 'equipment':
            # Only the instrument's category follows from its identity. Its catalog-wide
            # material/process associations do not become claims made by this paper.
            add(ref, equipment[key]['category_id'], 'equipment_class', source,
                scope='Class of the specifically linked instrument. ' + link['scope'])
    rows = []
    for (ref, key, basis), group in sorted(accumulated.items()):
        rows.append(dict(zip(CLASS_FIELDS, [ref, key[0], key, definitions[key], basis,
            ';'.join(sorted(group['via'])), ';'.join(sorted(group['links'])), ' '.join(sorted(group['scopes']))])))
    indexed = defaultdict(list)
    for row in rows:
        indexed[row['reference_id']].append(row)
    summaries = []
    for ref in data['references']:
        assigned = indexed[ref['reference_id']]
        summaries.append({'reference_id': ref['reference_id'],
            'status': 'classified' if assigned else 'general_background',
            'P': sorted({r['class_id'] for r in assigned if r['class_type'] == 'P'}),
            'M': sorted({r['class_id'] for r in assigned if r['class_type'] == 'M'}),
            'N': sorted({r['class_id'] for r in assigned if r['class_type'] == 'N'}),
            'note': '' if assigned else 'General methods or adjacent background; no specific P, M or N class is established by the current reviewed links.'})
    return rows, classes, summaries
