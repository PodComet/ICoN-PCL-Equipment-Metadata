"""Reproduce purchase-price coverage without equating missing prices to zero."""
import csv
import json
from collections import Counter
from pathlib import Path
from market_tools import seller_offers
from component_tools import dataset

def write_csv(path,rows,fields):
    with path.open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)

def build(root,records):
    root=Path(root);offers=seller_offers(root);by_equipment={}
    for o in offers:by_equipment.setdefault(o['equipment_id'],[]).append(o)
    instruments=[]
    for r in records:
        related=by_equipment.get(r['equipment_id'],[])
        new=[o for o in related if o['condition']=='new']
        status='explicit_msrp' if r['msrp_value'] else 'manufacturer_price' if r['manufacturer_price_value'] else 'new_seller_price' if new else 'secondary_market_only' if related else 'estimate_only' if r.get('estimated_msrp_low') else 'no_purchase_price'
        instruments.append(dict(equipment_id=r['equipment_id'],category_id=r['category_id'],manufacturer=r['manufacturer'],model_name=r['model_name'],status=status,msrp_value=r['msrp_value'],manufacturer_price_value=r['manufacturer_price_value'],seller_offer_count=len(related),new_seller_offer_count=len(new),estimate_low=r.get('estimated_msrp_low',''),estimate_high=r.get('estimated_msrp_high',''),source_urls=';'.join(dict.fromkeys(filter(None,[r['price_source_url'],r['manufacturer_price_source_url'],*[o['source_url'] for o in related]])))))
    data=dataset(root);components=[]
    for f in data['formulations']:
        for c in f['components']:
            related=[o for o in data['offers'] if o['component_id']==c['component_id'] or o['offer_id'] in c['eligible_offer_ids']]
            components.append(dict(route_id=f['route_id'],formulation_id=f['formulation_id'],line_id=c['line_id'],component_id=c['component_id'],name=c['name'],amount=c['amount'],cost_scope=c['cost_scope'],market_offer_count=len(related),compatible_offer_count=len(c['eligible_offer_ids']),status='compatible_pack_offer' if c['eligible_offer_ids'] else 'reference_offer_only' if related else 'no_market_offer',source_urls=';'.join(dict.fromkeys(o['source_url'] for o in related))))
    write_csv(root/'catalog/instrument_price_coverage.csv',instruments,list(instruments[0]))
    write_csv(root/'catalog/component_price_coverage.csv',components,list(components[0]))
    sources=json.loads((root/'catalog/pricing_sources_2026.json').read_text(encoding='utf-8'))
    sources['coverage']={'instrument_records':len(instruments),'instrument_statuses':dict(sorted(Counter(r['status'] for r in instruments).items())),'component_occurrences':len(components),'component_statuses':dict(sorted(Counter(r['status'] for r in components).items())),'component_pack_offers':len(data['offers'])}
    (root/'webapp/app/data/pricing-sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return sources['coverage']
