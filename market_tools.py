"""Validate source-bound seller offers independently from MSRP benchmarks."""
import csv
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urlparse

OFFER_FIELDS = ['offer_id', 'equipment_id', 'manufacturer', 'model_name', 'seller_name',
                'price_value', 'currency', 'price_kind', 'condition', 'source_url',
                'checked_date', 'scope']

def seller_offers(root):
    root = Path(root)
    with (root / 'catalog/equipment.csv').open(encoding='utf-8-sig', newline='') as handle:
        records = {r['equipment_id']: r for r in csv.DictReader(handle)}
    with (root / 'catalog/seller_offers.csv').open(encoding='utf-8-sig', newline='') as handle:
        offers = list(csv.DictReader(handle))
    seen = set()
    for offer in offers:
        assert all(offer.get(k) for k in OFFER_FIELDS), 'Incomplete seller offer'
        assert offer['offer_id'] not in seen, 'Duplicate seller offer ID'
        seen.add(offer['offer_id'])
        record = records.get(offer['equipment_id'])
        assert record and all(record[k] == offer[k] for k in ['manufacturer', 'model_name']), 'Seller offer model mismatch'
        try:
            value = Decimal(offer['price_value'])
            assert value.is_finite() and value > 0
        except (InvalidOperation, AssertionError) as error:
            raise ValueError('Invalid seller offer amount') from error
        assert len(offer['currency']) == 3 and offer['currency'].isalpha() and offer['currency'].isupper()
        assert offer['price_kind'] in {'list_price', 'sale_price', 'asking_price', 'starting_price', 'published_price'}
        assert offer['condition'] in {'new', 'used', 'refurbished', 'unspecified'}
        assert urlparse(offer['source_url']).scheme in {'https', 'http'} and urlparse(offer['source_url']).netloc
        assert date.fromisoformat(offer['checked_date']).isoformat() == offer['checked_date']
    return offers
