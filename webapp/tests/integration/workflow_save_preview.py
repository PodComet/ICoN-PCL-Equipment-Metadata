"""Check the reused-instrument quantity save regression against loopback storage only."""
import http.cookiejar
import json
import subprocess
import urllib.error
import urllib.request

BASE='http://127.0.0.1:5173'
jar=http.cookiejar.CookieJar()
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
client.open(BASE+'/signin-with-chatgpt?return_to=%2F').read()

def node(script,payload=None):
    result=subprocess.run(['node','--experimental-strip-types','--input-type=module','-e',script],input=json.dumps(payload) if payload is not None else '',capture_output=True,text=True,encoding='utf-8',check=True)
    return json.loads(result.stdout)

def request(path,body=None):
    req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,method='PUT' if body is not None else 'GET',headers={'Origin':BASE,'Content-Type':'application/json'})
    try:
        with client.open(req) as response:return response.status,json.load(response)
    except urllib.error.HTTPError as e:return e.code,json.load(e)

workflow=node("""
import {readFileSync} from 'node:fs';
import {createWorkflow,assignInstrument,fillMatchingInstrumentSlots,newStep} from './app/process-lib.ts';
const c=JSON.parse(readFileSync('app/data/catalog.json','utf8'));
let w={...createWorkflow(c.routes.find(r=>r.route_id==='P03'),c.steps),name:'QA · Reused-instrument quantity save',steps:[newStep(['M13']),newStep(['M13'])]};
w=assignInstrument(w,w.steps[0].slots[0].slot_id,c.records.find(r=>r.equipment_id==='M13-01'));
w=fillMatchingInstrumentSlots(w,w.steps[0].slots[0].slot_id).workflow;
console.log(JSON.stringify(w));
""")
status,first=request('/api/processes',{'workflow':workflow,'expected_revision':0})
assert status==200,first
updated=node("""
import {readFileSync} from 'node:fs';
import {updateInstrumentAssignment} from './app/process-lib.ts';
const w=JSON.parse(readFileSync(0,'utf8')),slot=w.steps[1].slots[0];
const next=updateInstrumentAssignment(w,slot.slot_id,{...slot.instrument,quantity:2,configuration:{sample_temperature:{value:25,unit:'Cel'}}});
delete next.extensions.process_budget_snapshot;delete next.extensions.output_evidence_snapshot;delete next.extensions.output_evidence_revision;
console.log(JSON.stringify(next));
""",first['workflow'])
status,second=request('/api/processes',{'workflow':updated,'expected_revision':1})
assert status==200,second
rid=second['workflow']['workflow_id']
status,reopened=request('/api/processes?id='+rid)
assert status==200 and reopened['revision']==2
assigned=[s['slots'][0]['instrument'] for s in reopened['workflow']['steps']]
assert [i['quantity'] for i in assigned]==[2,2]
assert assigned[0]['configuration']=={}
assert assigned[1]['configuration']['sample_temperature']=={'value':25,'unit':'Cel'}
assert len(reopened['history'])==2
print('Passed: reused instrument quantity edits save and reopen as revision 2; per-step configuration remains independent.')
