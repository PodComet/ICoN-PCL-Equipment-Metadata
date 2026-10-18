from reference_classification import derive_classes
from reference_tools import ROOT, read_database, load_csv


def test_classes_are_reproducible_and_every_article_has_an_explicit_status():
    data = read_database()
    rows, definitions, summaries = derive_classes(ROOT, data)
    assert rows == load_csv(ROOT / 'catalog/reference_classes.csv')
    assert {x['reference_id'] for x in summaries} == {x['reference_id'] for x in data['references']}
    assert len({(r['reference_id'], r['class_id'], r['basis']) for r in rows}) == len(rows)
    assert all(r['source_link_ids'] and r['scope'] for r in rows)
    assert {d['class_type'] for d in definitions} == {'P', 'M', 'N'}
    assert len([d for d in definitions if d['class_type'] == 'M']) == 97


def test_process_inference_is_scoped_and_never_promotes_exact_model_evidence():
    data = read_database()
    rows, _, _ = derive_classes(ROOT, data)
    routes = {r['route_id']: r for r in load_csv(ROOT / 'catalog/routes.csv')}
    links = {r['link_id']: r for r in data['reference_links']}
    for row in rows:
        if row['basis'] == 'process_inferred':
            for via in row['via_class_ids'].split(';'):
                assert row['class_id'] in (routes[via]['equipment_category_ids'] + ';' + routes[via]['related_material_ids']).split(';')
            assert 'not evidence' in row['scope']
            assert all(links[l]['target_type'] == 'route' for l in row['source_link_ids'].split(';'))
    # A project-wide database-design paper cannot silently acquire all instrument classes.
    general = next(r for r in data['references'] if r['doi'] == '10.5334/dsj-2019-012')
    assert not any(row['reference_id'] == general['reference_id'] for row in rows)
    # Equipment identity grants a category; catalog associations must not grant new routes.
    paper = data['references'][0]
    equipment = load_csv(ROOT / 'catalog/equipment.csv')[0]
    sample = {**data, 'reference_links': [{'reference_id': paper['reference_id'], 'target_type': 'equipment', 'target_id': equipment['equipment_id'], 'relation': 'supports_claim', 'review_status': 'claim_checked', 'link_id': 'EXACT', 'scope': 'One model only.'}]}
    derived, _, _ = derive_classes(ROOT, sample)
    assert [r['class_id'] for r in derived] == [equipment['category_id']]
