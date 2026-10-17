"""Offline validation and app export of source-scoped component formulations and offers."""
from __future__ import annotations
import csv
import json
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

FORMULATION_FIELDS = ['formulation_id','route_id','label','output_label','batch_basis','source_url','source_title','source_locator','reference_ids_json','scope','completeness']
COMPONENT_FIELDS = ['formulation_id','line_id','component_id','name','role','source_role','amount','quantity_value','quantity_unit','concentration','scope','amount_status','cost_scope','eligible_offer_ids_json','offer_match_notes']
OFFER_FIELDS = ['offer_id','component_id','name','seller','manufacturer','sku','grade','form','pack_quantity','pack_unit','price_value','currency','price_kind','source_url','checked_date','image_url','image_source_url','image_scope','condition','notes','cas_number','molar_mass_g_mol','molar_mass_source_url']
ROLES = {'feedstock','target','precursor','polymer','nanofiller','substrate','solvent','reagent','dopant','ligand','gas','sample'}

def read(root, name, fields=None):
    with (Path(root)/'catalog'/f'{name}.csv').open(encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream)
        if fields is not None and reader.fieldnames!=fields: raise ValueError(f'{name}: unexpected columns')
        rows=list(reader)
        if any(None in row or any(v is None for v in row.values()) for row in rows): raise ValueError(f'{name}: malformed row')
        return rows

def url(value, required=True):
    if not value and not required:return
    parsed=urlsplit(value)
    if parsed.scheme not in {'http','https'} or not parsed.netloc:raise ValueError('Unsafe or missing component source URL')

def number(value):
    if value=='':return None
    parsed=float(value)
    if not 0<=parsed<float('inf'):raise ValueError('Invalid component quantity or price')
    return parsed

def dataset(root):
    formulations=read(root,'component_formulations',FORMULATION_FIELDS)
    components=read(root,'formulation_components',COMPONENT_FIELDS)
    offers=read(root,'component_offers',OFFER_FIELDS)
    ids={f['formulation_id'] for f in formulations}
    if len(ids)!=len(formulations):raise ValueError('Duplicate formulation ID')
    routes={r['route_id'] for r in read(root,'routes') if r['route_id'].startswith('P')}
    if {f['route_id'] for f in formulations}!=routes:raise ValueError('Every P-class needs a reviewed formulation or explicit not-applicable record')
    known_refs={r['reference_id'] for r in read(root,'references')}
    offer_ids={o['offer_id'] for o in offers}
    if len(offer_ids)!=len(offers):raise ValueError('Duplicate component offer')
    for offer in offers:
        for field in ['pack_quantity','price_value','molar_mass_g_mol']:offer[field]=number(offer[field])
        if not offer['price_value'] or offer['condition']!='new':raise ValueError('Component quotes require an explicit new-product price')
        for field in ['source_url','image_url','image_source_url','molar_mass_source_url']:url(offer[field],field=='source_url')
        date.fromisoformat(offer['checked_date'])
        if offer['image_url'] and not offer['image_scope']:raise ValueError('Component image needs scope')
        if offer['molar_mass_g_mol'] and not offer['molar_mass_source_url']:raise ValueError('Molar mass requires source evidence')
    seen=set()
    for component in components:
        if component['formulation_id'] not in ids or component['line_id'] in seen:raise ValueError('Unknown formulation or duplicate component line')
        seen.add(component['line_id'])
        if component['role'] not in ROLES or component['cost_scope'] not in {'consumed','stock_preparation','reusable','reference'}:raise ValueError('Invalid component role or cost scope')
        if not component['name'] or len(component['name'])>180 or len(component['amount'])>100:raise ValueError('Component exceeds saved input limits')
        component['quantity_value']=number(component['quantity_value'])
        component['eligible_offer_ids']=json.loads(component.pop('eligible_offer_ids_json'))
        if any(oid not in offer_ids for oid in component['eligible_offer_ids']):raise ValueError('Unknown eligible component offer')
        if component['amount_status']=='ambiguous' and component['quantity_value'] is not None:raise ValueError('Ambiguous quantity must not have an automatic numeric dose')
    for formulation in formulations:
        url(formulation['source_url'])
        formulation['reference_ids']=json.loads(formulation.pop('reference_ids_json'))
        if any(r not in known_refs for r in formulation['reference_ids']):raise ValueError('Unknown formulation academic reference')
        formulation['components']=[{k:v for k,v in c.items() if k!='formulation_id'} for c in components if c['formulation_id']==formulation['formulation_id']]
        if not formulation['components'] and formulation['completeness']!='not_applicable':raise ValueError('Missing formulation inputs')
        if len(formulation['components'])>30:raise ValueError('Too many formulation inputs for saved plan')
    return {'checked_date':max((o['checked_date'] for o in offers),default='2026-10-17'),'formulations':formulations,'offers':offers}

def build(root):
    data=dataset(root)
    (Path(root)/'webapp/app/data/components.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    return data
