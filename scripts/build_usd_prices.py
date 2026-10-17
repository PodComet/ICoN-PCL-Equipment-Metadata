"""Build a dated USD comparison report without overwriting source price evidence."""
from pathlib import Path
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import csv
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from market_tools import seller_offers

def main():
    reference = json.loads((ROOT / 'catalog/currency_reference_rates.json').read_text(encoding='utf-8'), parse_float=Decimal)
    rates = reference['units_per_eur']
    seed = json.loads((ROOT / 'webapp/app/data/catalog.json').read_text(encoding='utf-8'))
    offers = seller_offers(ROOT)
    by_id = {}
    for offer in sorted(offers, key=lambda o: (o['condition'] != 'new', o['offer_id'])):
        by_id.setdefault(offer['equipment_id'], offer)
    def usd(value, currency):
        if value in ('', None):
            return ''
        try:
            amount = Decimal(value)
            if not amount.is_finite() or amount < 0:
                return ''
            rate = Decimal(1) if currency == 'USD' else Decimal(rates['USD']) / Decimal(rates[currency])
            return str((amount * rate).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))
        except (InvalidOperation, KeyError, ZeroDivisionError):
            return ''
    rows = []
    for r in seed['records']:
        seller = by_id.get(r['equipment_id'], {})
        rows.append({
            **{k:r.get(k,'') for k in ['equipment_id','manufacturer','model_name','category_id','msrp_value','msrp_currency','price_source_url','manufacturer_price_value','manufacturer_price_currency','manufacturer_price_kind','manufacturer_price_source_url','estimated_msrp_low','estimated_msrp_high','estimate_currency','estimate_source_urls']},
            'display_currency':'USD', 'msrp_usd':usd(r.get('msrp_value'),r.get('msrp_currency')),
            'manufacturer_price_usd':usd(r.get('manufacturer_price_value'),r.get('manufacturer_price_currency')),
            'seller_name':seller.get('seller_name',''), 'seller_price_value':seller.get('price_value',''),
            'seller_currency':seller.get('currency',''), 'seller_price_kind':seller.get('price_kind',''),
            'seller_condition':seller.get('condition',''), 'seller_price_source_url':seller.get('source_url',''),
            'seller_price_checked_date':seller.get('checked_date',''), 'seller_price_scope':seller.get('scope',''),
            'seller_price_usd':usd(seller.get('price_value'),seller.get('currency')),
            'estimated_msrp_low_usd':usd(r.get('estimated_msrp_low'),r.get('estimate_currency')),
            'estimated_msrp_high_usd':usd(r.get('estimated_msrp_high'),r.get('estimate_currency')),
            'fx_reference_date':reference['date'], 'fx_source_url':reference['source_url'],
        })
    path = ROOT / 'catalog/equipment_prices_usd.csv'
    with path.open('w', encoding='utf-8', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f'Generated USD comparison prices for {len(rows)} records using {reference["date"]}.')

if __name__ == '__main__':
    main()
