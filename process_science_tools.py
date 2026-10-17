"""Validate and export literature-scoped operating conditions and property anchors."""
import csv
import json
import math
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit
from ontology_models import validate_science
from ontology_units import check_registry, normalize_condition, convert

CONDITION_FIELDS=['template_id','route_id','formulation_id','source_step_order','parameter','label','operator','value','upper_value','unit','text_value','evidence_id','scope','match_scope']
EVIDENCE_FIELDS=['evidence_id','classification','claim','source_url','source_title','source_locator','reference_ids_json','scope','reviewed_date']
PROPERTY_FIELDS=['anchor_id','route_id','formulation_id','property','label','value','upper_value','unit','text_value','operator','evidence_id','required_condition_ids_json','scope','material_scope','supports_expectation','uncertainty_json','approximate']

def read(root,name,fields=None):
    with (root/'catalog'/f'{name}.csv').open(encoding='utf-8-sig',newline='') as f:
        r=csv.DictReader(f)
        if fields and r.fieldnames!=fields:raise ValueError('Unexpected process science CSV columns: '+name)
        rows=list(r)
        if any(None in row or any(v is None for v in row.values()) for row in rows):raise ValueError('Malformed process science row')
        return rows

def number(v):
    if v=='':return None
    n=float(v)
    if not math.isfinite(n):raise ValueError('Process science values must be finite')
    return n

def dataset(root):
    root=Path(root);definitions=json.loads((root/'catalog/condition_definitions.json').read_text(encoding='utf-8'))
    conditions=read(root,'process_conditions',CONDITION_FIELDS);evidence=read(root,'process_condition_evidence',EVIDENCE_FIELDS);properties=read(root,'process_property_anchors',PROPERTY_FIELDS)
    formulations={f['formulation_id']:f for f in read(root,'component_formulations')};steps={(s['route_id'],s['step_order']) for s in read(root,'route_steps')};references={r['reference_id'] for r in read(root,'references')}
    known=set()
    for e in evidence:
        if e['evidence_id'] in known or not e['evidence_id']:raise ValueError('Duplicate evidence ID')
        known.add(e['evidence_id']);e['reference_ids']=json.loads(e.pop('reference_ids_json'))
        if not set(e['reference_ids'])<=references:raise ValueError('Unknown process-science reference')
        url=urlsplit(e['source_url'])
        if url.scheme not in {'https','http'} or not url.netloc or not e['source_locator'] or not e['claim']:raise ValueError('Source evidence requires URL, locator and claim')
        date.fromisoformat(e['reviewed_date'])
        if e['classification'] not in {'literature_reported','curator_interpretation','manufacturer_fact'}:raise ValueError('Unsupported evidence classification')
    ids=set()
    for c in conditions:
        if c['template_id'] in ids:raise ValueError('Duplicate condition template')
        ids.add(c['template_id'])
        if c['formulation_id'] not in formulations or c['route_id']!=formulations[c['formulation_id']]['route_id']:raise ValueError('Condition formulation mismatch')
        if c['source_step_order'] and (c['route_id'],c['source_step_order']) not in steps:raise ValueError('Unknown source step')
        if c['parameter'] not in definitions or c['evidence_id'] not in known:raise ValueError('Unknown condition type or evidence')
        if c['match_scope'] not in {'example','parameter_study','ambiguous'}:raise ValueError('Invalid source condition scope')
        c['value']=number(c['value']);c['upper_value']=number(c['upper_value'])
        if c['operator'] not in {'eq','range','gte','lte','gt','lt','text'}:raise ValueError('Invalid condition operator')
        if c['operator']=='text':
            if c['value'] is not None or c['upper_value'] is not None or not c['text_value']:raise ValueError('Descriptive condition needs text without numeric values')
        elif c['unit'] not in {u['unit'] for u in definitions[c['parameter']]['units']} or c['value'] is None:raise ValueError('Numeric condition requires compatible units and value')
        if c['operator']=='range' and (c['upper_value'] is None or c['value']>c['upper_value']):raise ValueError('Invalid condition range')
    pids=set()
    for p in properties:
        if p['anchor_id'] in pids:raise ValueError('Duplicate property anchor')
        pids.add(p['anchor_id']);p['value']=number(p['value']);p['upper_value']=number(p['upper_value']);p['required_condition_ids']=json.loads(p.pop('required_condition_ids_json'));p['uncertainty']=json.loads(p.pop('uncertainty_json'))
        if p['formulation_id'] not in formulations or p['route_id']!=formulations[p['formulation_id']]['route_id'] or p['evidence_id'] not in known:raise ValueError('Property source mismatch')
        if not set(p['required_condition_ids'])<=ids:raise ValueError('Unknown property condition reference')
        if any(c['formulation_id']!=p['formulation_id'] for c in conditions if c['template_id'] in p['required_condition_ids']):raise ValueError('Property conditions cross formulation boundaries')
        if p['supports_expectation'] not in {'true','false'} or p['approximate'] not in {'true','false'}:raise ValueError('Invalid property flags')
        p['supports_expectation']=p['supports_expectation']=='true';p['approximate']=p['approximate']=='true'
        if p['supports_expectation'] and not p['required_condition_ids']:raise ValueError('A conditional expectation requires source conditions')
    review=json.loads((root/'catalog/process_science_review_2026-10-17.json').read_text(encoding='utf-8'))
    data={'schema':'process-science/v1','checked_date':review['checked_date'],'conditions':conditions,'properties':properties,'evidence':evidence,'route_reviews':review['route_reviews'],'relationship_candidates':review['relationship_candidates'],'experimental_validation':'future_roadmap'}
    validate_science(data)
    check_registry(definitions)
    for condition in conditions:normalize_condition(condition,definitions)
    for prop in properties:
        if prop['operator']!='text':convert(prop['value'],prop['unit'],prop['unit'])
        if prop['uncertainty'] is not None:convert(prop['uncertainty']['value'],prop['uncertainty']['unit'],prop['unit'])
    return data

def build(root):
    root=Path(root);data=dataset(root)
    (root/'webapp/app/data/process-science.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (root/'webapp/app/data/condition-definitions.json').write_text((root/'catalog/condition_definitions.json').read_text(encoding='utf-8'),encoding='utf-8')
    return data
