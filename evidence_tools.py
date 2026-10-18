"""Rebuild the public, readable evidence register from reviewed source records."""
import csv
import json
from pathlib import Path

def read(root,name):
    with (root/'catalog'/f'{name}.csv').open(encoding='utf-8-sig',newline='') as stream:
        return list(csv.DictReader(stream))

def dataset(root):
    root=Path(root)
    conditions=read(root,'process_conditions');properties=read(root,'process_property_anchors')
    routes={r['route_id']:r for r in read(root,'routes')}
    equipment={r['equipment_id']:r for r in read(root,'equipment')}
    records=[]
    for e in read(root,'process_condition_evidence'):
        contexts=[{'record_type':'condition','record_id':c['template_id'],**c} for c in conditions if c['evidence_id']==e['evidence_id']]
        contexts += [{'record_type':'property','record_id':p['anchor_id'],**p} for p in properties if p['evidence_id']==e['evidence_id']]
        related=[{'record_type':c['record_type'],'record_id':c['record_id'],'label':c['label']} for c in contexts]
        for rid in sorted({c['route_id'] for c in contexts}):
            related.append({'record_type':'process','record_id':rid,'label':routes[rid]['route_name']})
            for cid in filter(None,routes[rid]['equipment_category_ids'].split(';')):
                related.append({'record_type':'equipment_class','record_id':cid,'label':'Process-associated class; not exact-model evidence'})
        for fid in sorted({c['formulation_id'] for c in contexts}):related.append({'record_type':'formulation','record_id':fid,'label':''})
        related += [{'record_type':'academic_reference','record_id':rid,'label':''} for rid in json.loads(e['reference_ids_json'])]
        records.append(dict(schema='iconpcl-evidence-record/v1',evidence_id=e['evidence_id'],record_kind='source_claim',classification=e['classification'],title=e['claim'],claim=e['claim'],scope=e['scope'] or 'Source claim scope not explicitly recorded; inspect the linked formulation and method before reuse.',recorded_at=e['reviewed_date'],sources=[{'title':e['source_title'],'url':e['source_url'],'locator':e['source_locator'],'checked_date':e['reviewed_date']}],related_records=related,source_evidence_ids=[],supersedes_id='',context={'source_contexts':contexts}))
    positions=json.loads((root/'catalog/position_interfaces.json').read_text(encoding='utf-8'))
    for group in positions['evidence']:
        for e in group['entries']:
            related=[]
            for profile in positions['profiles']:
                used=e['id'] in profile['interface']['evidence_ids'] or any(e['id'] in f['evidence_ids'] or any(e['id'] in d['evidence_ids']+(d.get('effect_evidence_ids') or []) for d in f['directions']) for f in profile['interface']['fibers'])
                if used:
                    related.append({'record_type':'equipment','record_id':profile['equipment_id'],'label':profile['manufacturer']+' '+profile['model_name']})
                    if profile['equipment_id'] in equipment:
                        model=equipment[profile['equipment_id']]
                        related.append({'record_type':'equipment_class','record_id':model['category_id'],'label':''})
                        for rid in filter(None,model['related_process_ids'].split(';')):
                            if rid in routes:related.append({'record_type':'process','record_id':rid,'label':routes[rid]['route_name']+' — model planning association'})
            records.append(dict(schema='iconpcl-evidence-record/v1',evidence_id=e['id'],record_kind='source_claim',classification=e['classification'],title=e['claim'],claim=e['claim'],scope='Model-bound control documentation; not a validation of a user sequence.',recorded_at=e['source']['accessed'],sources=[{'title':e['source']['title'],'url':e['source']['url'] or '', 'locator':e['source']['section'],'checked_date':e['source']['accessed']}],related_records=related,source_evidence_ids=[],supersedes_id='',context={'subject':group['subject'],'verification':e['verification']}))
    photo_register=root/'catalog/instrument_photo_evidence.json'
    if photo_register.exists():
        records.extend(json.loads(photo_register.read_text(encoding='utf-8'))['records'])
    records.sort(key=lambda r:r['evidence_id'])
    if len({r['evidence_id'] for r in records})!=len(records):raise ValueError('Evidence IDs must be unique across source registers')
    return {'schema':'iconpcl-evidence-register/v1','scope':'Public reviewed source claims. User plans are stored separately with account access controls.','records':records}

def markdown(data):
    def clean(value):return str(value).replace('\\','\\\\').replace('[','\\[').replace(']','\\]').replace('<','&lt;').replace('>','&gt;').replace('\n',' ')
    lines=['# Public evidence register','','Generated from canonical source data by `python scripts/build_app_data.py`. Do not edit this generated file.', '',f"{len(data['records'])} source claims. Search by evidence ID, P/M class, reference ID or claim. Saved user sequences are account-private and appear in the app’s Evidence register, with JSON, CSV and Markdown export.",'','Process-associated M classes are contextual links, not proof of exact-model use. Planned/user-entered sequence IDs do not establish experimental or hardware validation.','']
    for r in data['records']:
        lines += ['## '+r['evidence_id'],'',clean(r['claim']),'', '**Classification:** '+r['classification']+' · **Checked:** '+r['recorded_at'],'','**Scope:** '+clean(r['scope']),'']
        for s in r['sources']:lines.append('- Source: ['+clean(s['title'])+']('+s['url']+') — '+clean(s['locator']))
        lines += ['','**Related records:** '+', '.join('`'+x['record_id']+'` ('+x['record_type']+')' for x in r['related_records']), '']
        for c in r['context'].get('source_contexts',[]):
            value=c.get('text_value') or (c.get('value','')+('–'+c['upper_value'] if c.get('upper_value') else '')+' '+c.get('unit','')).strip()
            lines.append('- '+clean(c['record_id'])+': '+clean(c['label'])+' = '+clean(value)+'; operator '+c.get('operator','')+'; formulation '+c['formulation_id']+'; source step '+(c.get('source_step_order') or 'not specified')+'.')
        lines.append('')
    return '\n'.join(lines).rstrip()+'\n'

def build(root):
    root=Path(root);data=dataset(root)
    for p in [root/'catalog/evidence_registry.json',root/'webapp/app/data/evidence-registry.json']:
        p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    fields=['evidence_id','record_kind','classification','claim','scope','recorded_at','sources_json','related_records_json','context_json']
    with (root/'catalog/evidence_registry.csv').open('w',encoding='utf-8',newline='') as stream:
        w=csv.DictWriter(stream,fieldnames=fields);w.writeheader()
        for r in data['records']:w.writerow({**{k:r[k] for k in fields if not k.endswith('_json')},**{k:json.dumps(r[k[:-5]],ensure_ascii=False) for k in fields if k.endswith('_json')}})
    (root/'docs/evidence-register.md').write_text(markdown(data),encoding='utf-8')
    return data
