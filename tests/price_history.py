"""Reconstruct catalog checkpoints without allowing unaudited quote edits."""
import json


def quotes_at_checkpoint(root, rows, checked_date):
    by_id = {r['offer_id']: r for r in rows}
    for path in sorted((root / 'catalog').glob('material_price_refresh_*.json'), reverse=True):
        audit = json.loads(path.read_text(encoding='utf-8'))
        if audit['checked_date'] <= checked_date:
            continue
        for entry in audit['offers']:
            before, after = entry['before'], entry['after']
            assert by_id[entry['offer_id']] == after, 'Quote changed outside the dated audit'
            assert {k for k in before if before[k] != after[k]} <= {'checked_date', 'price_value'}
            by_id[entry['offer_id']] = before
    return [by_id[r['offer_id']] for r in rows]
