import copy
import pytest
from component_tools import dataset
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def test_component_dataset_covers_existing_processes_with_scoped_sources():
    data=dataset(ROOT)
    assert len(data['formulations'])==44
    assert len({f['formulation_id'] for f in data['formulations']})==44
    assert all(f['source_url'].startswith('https://') and f['batch_basis'] for f in data['formulations'])
    assert next(f for f in data['formulations'] if f['route_id']=='P43')['components']==[]

def test_stock_and_grade_matches_are_explicit_and_quotes_are_dated():
    data=dataset(ROOT)
    offers={o['offer_id']:o for o in data['offers']}
    for f in data['formulations']:
        for c in f['components']:
            assert set(c['eligible_offer_ids'])<=offers.keys()
            if c['amount_status']=='ambiguous':assert c['quantity_value'] is None
    assert all(o['price_value']>0 and o['checked_date']=='2026-10-17' for o in offers.values())
    assert all(not o['image_url'] or o['image_scope'] for o in offers.values())
    assert not any('methanol' in o['image_url'] for o in offers.values() if o['component_id']=='ethanol')
