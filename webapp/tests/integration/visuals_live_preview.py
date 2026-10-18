"""Loopback-only fixture for verifying graph refresh against saved revisions.

Run once, choose its named plan in Visuals, run with --advance, then Refresh.
"""
from pathlib import Path
import json
import subprocess
import sys
import urllib.request

BASE='http://127.0.0.1:5173'
state=Path('.sites-runtime/visuals-live-fixture.json')
def request(path,body=None):
    req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body else None,
        method='PUT' if body else 'GET',headers={'Origin':BASE,'Content-Type':'application/json'})
    with urllib.request.urlopen(req) as response:return json.load(response)
def node(code,value=None):
    return json.loads(subprocess.run(['node','--experimental-strip-types','--input-type=module','-e',code],input=json.dumps(value) if value else '',capture_output=True,text=True,encoding='utf-8',check=True).stdout)
if '--advance' in sys.argv:
    initial=json.loads(state.read_text(encoding='utf-8'));current=request('/api/processes?id='+initial['workflow']['workflow_id'])
    assert current['workflow']['name'].startswith('QA · Visual live refresh')
    workflow=node("""import {readFileSync} from 'node:fs';import {newStep} from './app/process-lib.ts';
    const w=JSON.parse(readFileSync(0,'utf8'));w.steps.push({...newStep(['M13']),label:'Live-refresh test stage'});
    for(const k of ['process_budget_snapshot','output_evidence_snapshot','output_evidence_revision'])delete w.extensions[k];
    console.log(JSON.stringify(w));""",current['workflow'])
    result=request('/api/processes',{'workflow':workflow,'expected_revision':current['revision']})
    assert result['revision']==current['revision']+1
else:
    workflow=node("""import {readFileSync} from 'node:fs';import {createWorkflow} from './app/process-lib.ts';
    const c=JSON.parse(readFileSync('app/data/catalog.json','utf8'));const w=createWorkflow(c.routes.find(r=>r.route_id==='P27'),c.steps);
    w.name='QA · Visual live refresh';console.log(JSON.stringify(w));""")
    result=request('/api/processes',{'workflow':workflow,'expected_revision':0})
    state.parent.mkdir(exist_ok=True);state.write_text(json.dumps(result),encoding='utf-8')
print(json.dumps({'name':result['workflow']['name'],'revision':result['revision'],'steps':len(result['workflow']['steps'])}))
