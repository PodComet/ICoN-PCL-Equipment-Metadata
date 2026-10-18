"""Loopback-only persistence, revision, concurrent-save and ownership checks.

Creates explicitly named synthetic QA plans/model variants; never edits existing plans.
"""
import concurrent.futures
import json
from pathlib import Path
import sqlite3
import subprocess
import urllib.error
import urllib.request
import uuid

BASE='http://127.0.0.1:5173'
root=Path(__file__).resolve().parents[2]
def request(path,body=None,method=None,origin=BASE):
    req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,method=method or ('PUT' if body is not None else 'GET'),headers={'Origin':origin,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=30) as response:return response.status,json.load(response)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
def node(code):
    return json.loads(subprocess.run(['node','--experimental-strip-types','--input-type=module','-e',code],cwd=root,capture_output=True,text=True,encoding='utf-8',check=True).stdout)
def put(workflow,revision):return request('/api/processes',{'workflow':workflow,'expected_revision':revision})
def detail(eid):
    status,result=request('/api/evidence?id='+eid);assert status==200,result;return result

workflow=node("""import {readFileSync} from 'node:fs';import {createWorkflow,newStep,assignInstrument,reuseInstrument} from './app/process-lib.ts';import {chooseSequence} from './app/process-controls-lib.ts';import {blankSequence,newControlAction} from './app/control-sequence-lib.ts';
const c=JSON.parse(readFileSync('app/data/catalog.json')),model=c.records.find(r=>r.equipment_id==='EXT-M70-OPENTRONS-GEN2');let w=createWorkflow(c.routes.find(r=>r.route_id==='P43'),c.steps);w.name='QA · Evidence sequence reproduction';w.steps=[newStep(['M70']),newStep(['M70'])];w=assignInstrument(w,w.steps[0].slots[0].slot_id,model);w=reuseInstrument(w,w.steps[1].slots[0].slot_id,w.steps[0].slots[0].slot_id);
for(const step of w.steps)w=chooseSequence(w,step.slots[0].slot_id,{...blankSequence(),steps:['tc.close_lid','tc.deactivate','tc.close_lid'].map(direction=>({...newControlAction(),position:'lid_open',fiber_id:'lid_open',direction,notes:'Synthetic QA planning record; not operating instructions.'}))});console.log(JSON.stringify(w));""")
status,created=put(workflow,0);assert status==200,created
wid=created['workflow']['workflow_id']
status,first=request('/api/processes?id='+wid);assert status==200
refs=[s['slots'][0]['instrument']['extensions']['saved_control_evidence'] for s in first['workflow']['steps']]
assert refs[0]['evidence_id']!=refs[1]['evidence_id']
old=detail(refs[0]['evidence_id']);old_bytes=json.dumps(old,sort_keys=True)
assert len(old['record']['context']['sequence']['steps'])==3
assert old['record']['context']['source_evidence_snapshot']
combo=detail(first['workflow']['extensions']['control_evidence_snapshot']['evidence_id'])
assert combo['workflow_integrity_verified'] is True
assert combo['workflow_snapshot']==first['workflow']
assert len(combo['related'])==2

changed=json.loads(json.dumps(first['workflow']))
seq=changed['steps'][0]['slots'][0]['instrument']['configuration']['ontology_control_sequence']
seq['steps']=[seq['steps'][1],seq['steps'][0],seq['steps'][2]]
seq['steps'][0]['notes']='Modified synthetic QA notes, revision two.'
status,second=put(changed,1);assert status==200,second
new_ref=second['workflow']['steps'][0]['slots'][0]['instrument']['extensions']['saved_control_evidence']
assert new_ref['evidence_id']!=refs[0]['evidence_id']
assert detail(new_ref['evidence_id'])['record']['supersedes_id']==refs[0]['evidence_id']
assert json.dumps(detail(refs[0]['evidence_id']),sort_keys=True)==old_bytes
assert request('/api/processes?id='+wid+'&revision=1')[1]['workflow']==first['workflow']
count_before=request('/api/evidence?scope=mine')[1]['total']
assert put(changed,1)[0]==409
assert request('/api/evidence?scope=mine')[1]['total']==count_before
assert put(changed,2)[0]==200  # Same sequence in a new save still gets fresh evidence IDs.
third=request('/api/processes?id='+wid)[1]
count_before=request('/api/evidence?scope=mine')[1]['total']
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    outcomes=list(pool.map(lambda _:put(third['workflow'],3),range(2)))
assert sorted(o[0] for o in outcomes)==[200,409],outcomes
current=next(o[1] for o in outcomes if o[0]==200)
# Two sequences with three actions each, a combination and one workflow assessment.
assert request('/api/evidence?scope=mine')[1]['total']-count_before==10
assert not request('/api/evidence?scope=public&q='+wid)[1]['records']

catalog=request('/api/catalog')[1]
model=next(r for r in catalog['rows'] if r['record']['equipment_id']=='EXT-M70-OPENTRONS-GEN2')
fields={'model_name':'QA synthetic sequence model '+str(uuid.uuid4())[:8],'product_family':'QA evidence fixture','variant_label':'Synthetic QA variant'}
status,variant=request('/api/catalog',{'create_variant':True,'template_id':model['record']['equipment_id'],'expected_revision':0,'fields':fields});assert status==200,variant
record=variant['record'];sequence={'schema':'instrument-control-sequence/v1','order_basis':'user_ordered','steps':[{'id':str(uuid.uuid4()),'position':'QA position','fiber_id':'QA fiber','direction':'QA direction','source':'user_defined','notes':'Synthetic local fixture.'}]}
template={'schema':'instrument-sequence-template/v1','subject':{k:record[k] for k in ['equipment_id','manufacturer','model_name']},'sequence':sequence,'saved_evidence':{'evidence_id':'FORGED-ID'}}
status,saved=request('/api/catalog',{'equipment_id':record['equipment_id'],'expected_revision':variant['revision'],'fields':{'control_sequence_json':json.dumps(template)}});assert status==200,saved
ref=json.loads(saved['record']['control_sequence_json'])['saved_evidence'];assert ref['evidence_id'].startswith('SEQ-EV-')
stored=detail(ref['evidence_id']);assert stored['record']['context']['sequence']==sequence
assert stored['record']['source_evidence_ids']==[]
assert request('/api/catalog',{'equipment_id':record['equipment_id'],'expected_revision':variant['revision'],'fields':{'control_sequence_json':json.dumps(template)}})[0]==409

database=next(p for p in (root/'.wrangler/state/v3/d1').rglob('*.sqlite') if 'evidence_records' in {row[0] for row in sqlite3.connect(p).execute("SELECT name FROM sqlite_master WHERE type='table'")})
foreign_id='SEQ-EV-'+str(uuid.uuid4());db=sqlite3.connect(database,timeout=15)
try:
    db.execute('INSERT INTO evidence_records VALUES(?,?,?,?,?,?,?)',(foreign_id,'qa-other-owner','instrument_sequence','QA',1,json.dumps({'evidence_id':foreign_id,'private':'FOREIGN-QA-RECORD'}),'2026-10-18T00:00:00Z'));db.commit()
    assert request('/api/evidence?id='+foreign_id)[0]==404
    assert request('/api/evidence?q=FOREIGN-QA-RECORD')[1]['total']==0
finally:
    db.execute('DELETE FROM evidence_records WHERE evidence_id=? AND owner_id=?',(foreign_id,'qa-other-owner'));db.commit();db.close()
fixture={'workflow':current,'sequence_evidence_id':refs[0]['evidence_id'],'template_evidence_id':ref['evidence_id']}
(root/'.sites-runtime/evidence-qa.json').write_text(json.dumps(fixture),encoding='utf-8')
print(json.dumps({'workflow_id':wid,'workflow_revision':current['revision'],'sequence_evidence_id':refs[0]['evidence_id'],'source_claims':request('/api/evidence?scope=public')[1]['public_source_count'],'checks':'save/reopen, repeated instruments, ordered actions, frozen old revisions, concurrent rollback, template save and cross-account isolation passed'}))
