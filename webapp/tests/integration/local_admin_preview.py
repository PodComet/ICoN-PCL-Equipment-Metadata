"""Automatic loopback admin and a filled P27 save, with no sign-in cookies."""
import json
import subprocess
import urllib.request
BASE='http://127.0.0.1:5173'
def request(path, body=None):
    req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body else None,
        method='PUT' if body else 'GET',headers={'Origin':BASE,'Content-Type':'application/json'})
    with urllib.request.urlopen(req) as res:return json.load(res)
session=request('/api/admin/session')
assert session['signedIn'] and session['canAdmin'] and session['localAdmin']
catalog=request('/api/catalog');assert catalog['canEdit'] and catalog['canAdmin']
script="""
import {readFileSync} from 'node:fs';
import {createWorkflow,assignInstrument,slotAccepts} from './app/process-lib.ts';
const c=JSON.parse(readFileSync('app/data/catalog.json','utf8'));
let w=createWorkflow(c.routes.find(r=>r.route_id==='P27'),c.steps);
w.name='QA · P27 automatic local admin save';
for(const s of w.steps)for(const slot of s.slots){
 const e=c.records.find(r=>slotAccepts(slot,r,w.steps));
 if(e)w=assignInstrument(w,slot.slot_id,e);
}
console.log(JSON.stringify(w));
"""
workflow=json.loads(subprocess.run(['node','--experimental-strip-types','--input-type=module','-e',script],capture_output=True,text=True,encoding='utf-8',check=True).stdout)
saved=request('/api/processes',{'workflow':workflow,'expected_revision':0})
assert saved['revision']==1
reopened=request('/api/processes?id='+saved['workflow']['workflow_id'])
assert reopened['workflow']['route_id']=='P27' and reopened['revision']==1
assert any(slot['instrument'] for step in reopened['workflow']['steps'] for slot in step['slots'])
reopened['workflow']['notes']='Repeat-save check without a login cookie.'
again=request('/api/processes',{'workflow':reopened['workflow'],'expected_revision':1})
assert again['revision']==2
print('Passed: automatic admin, catalog administration, filled P27 save/reopen/repeat save without signing in.')
