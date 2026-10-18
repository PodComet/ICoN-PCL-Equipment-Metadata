import json
import re
from catalog_tools import ROOT, load_csv


def test_submodel_photo_review_matches_catalog_without_promoting_other_evidence():
    report = json.loads((ROOT / 'catalog/submodel_photo_review_2026-10-15.json').read_text(encoding='utf-8'))
    records = {r['equipment_id']: r for r in load_csv(ROOT / 'catalog/equipment.csv')}
    assert report['summary']['added_photo_profiles'] == len(report['records']) == 81
    assert report['summary']['added_submodels'] == len({r['model_variant_id'] for r in report['records']}) == 78
    assert report['summary']['remaining_missing_submodels'] == len({r['model_variant_id'] for r in report['not_added']}) == 36
    assert len({r['equipment_id'] for r in report['records']}) == 81
    latest = json.loads((ROOT / 'catalog/market_expansion_2026-10-16.json').read_text(encoding='utf-8'))
    latest_by_id = {r['equipment_id']: r['after'] for r in latest['updates']}
    sweep=json.loads((ROOT/'catalog/link_review_2026-10-17-sellers.json').read_text(encoding='utf-8'))
    for update in sweep['equipment_updates']:
        latest_by_id.setdefault(update['equipment_id'],{}).update(update['after'])
    media=json.loads((ROOT/'catalog/manufacturer_media_review_2026-10-17.json').read_text(encoding='utf-8'))
    for update in media['equipment_updates']:
        latest_by_id.setdefault(update['equipment_id'],{}).update(update['after'])
    photos=json.loads((ROOT/'catalog/instrument_photo_review_2026-10-18.json').read_text(encoding='utf-8'))
    for update in photos['records']:
        latest_by_id.setdefault(update['equipment_id'],{}).update(update['after'])
    for review in report['records']:
        record = records[review['equipment_id']]
        assert review['model_name'] == record['model_name'] and review['manufacturer'] == record['manufacturer']
        assert review['before']['image_url'] == ''
        assert set(review['after']) == {'image_url', 'image_source_url', 'image_scope', 'media_checked_date'}
        expected = {**review['after'], **latest_by_id.get(review['equipment_id'], {})}
        assert all(record[k] == v for k, v in expected.items())
        assert review['image_url'].startswith('https://') and review['image_source_url'].startswith('https://')
        assert review['image_scope'] and min(review['width'], review['height']) >= 100
        assert review['verification'] in {'decoded_image', 'browser_decoded_image'}
        if 'family_reference' in review['photo_kind']:
            assert re.search(r'reference|family|not .*?(?:pictured|distinguished)|not confirmed', review['image_scope'].lower())
    for review in report['not_added']:
        assert (not records[review['equipment_id']]['image_url'] or latest_by_id.get(review['equipment_id'], {}).get('image_url')) and review['reason']
