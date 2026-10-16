"""Exercise process persistence only against the loopback development database."""
import concurrent.futures
import copy
import http.cookiejar
import json
import urllib.error
import urllib.request
import uuid
from pathlib import Path

BASE='http://127.0.0.1:5173'
jar=http.cookiejar.CookieJar()
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
client.open(BASE+'/signin-with-chatgpt?return_to=%2F').read()
def request(path,body=None,anonymous=False,origin=BASE):
    req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,method='PUT' if body is not None else 'GET',headers={'Origin':origin,'Content-Type':'application/json'})
    try:
        with (urllib.request.urlopen(req) if anonymous else client.open(req)) as response:return response.status,json.load(response)
    except urllib.error.HTTPError as e:
        payload=e.read().decode()
        try:return e.code,json.loads(payload)
        except json.JSONDecodeError:return e.code,{'error':payload[:300]}

assert request('/api/processes',anonymous=True)[0]==401
assert request('/api/processes',{},origin='https://wrong.test')[0]==403
status,catalog=request('/api/catalog');assert status==200
record=next(r['record'] for r in catalog['rows'] if r['record']['equipment_id']=='M13-01')
instance={
    'instance_id':'M13-'+str(uuid.uuid4()),'equipment_id':record['equipment_id'],'category_id':'M13','category_refs':['M13'],
    'equipment_snapshot':{'model_name':'tampered'},'price_snapshot':{'kind':'msrp','currency':'USD','low':1,'high':1},'quantity':2,
    'configuration':{'volume':{'value':250,'unit':'mL'}},'operating_parameters':{'speed':{'value':1000,'unit':'rpm'}},
    'operation_sequence':['Check configuration','Acquire data'],'signals':{'ready':{'type':'boolean'}},'inputs':{'sample':{'format':'custom'}},'outputs':{'measurements':{'format':'csv'}},'extensions':{'future_namespace':{'version':2}},
}
workflow={
    'schema_version':1,'workflow_id':'','route_id':'P03','route_name':'tampered','name':'Local process persistence QA '+str(uuid.uuid4()),'notes':'Disposable local integration test.',
    'extensions':{'future':{'nested':['retained',42]}},
    'steps':[{'step_id':'STEP-'+str(uuid.uuid4()),'label':'Recover particles','notes':'','source_step_order':'','source_sequence':'',
              'extensions':{},'slots':[{'slot_id':'SLOT-'+str(uuid.uuid4()),'label':'Centrifuge','allowed_category_ids':['M13'],'instrument':instance,'extensions':{}}]}],
}
status,first=request('/api/processes',{'workflow':workflow,'expected_revision':0});assert status==200,first
id=first['workflow']['workflow_id'];assert id.startswith('PROC-P03-')
Path('.sites-runtime/process-qa-id.json').write_text(json.dumps({'workflow_id':id}),encoding='utf-8')
assert first['revision']==1
stored=first['workflow']['steps'][0]['slots'][0]['instrument']
assert stored['equipment_snapshot']['model_name']==record['model_name']
assert stored['price_snapshot']['low']!=1
assert stored['inputs']==instance['inputs'] and stored['extensions']==instance['extensions']
assert any(w['workflow_id']==id for w in request('/api/processes')[1]['workflows'])
opened=request('/api/processes?id='+id)[1]
assert opened['workflow']==first['workflow'] and len(opened['history'])==1
draft=copy.deepcopy(first['workflow']);draft['notes']='Revision 2'
status,second=request('/api/processes',{'workflow':draft,'expected_revision':1});assert status==200,second
assert second['workflow']['steps'][0]['slots'][0]['instrument']['instance_id']==instance['instance_id']
assert request('/api/processes',{'workflow':draft,'expected_revision':1})[0]==409
assert request('/api/processes?id='+id+'&revision=1')[1]['workflow']['notes']==workflow['notes']
bad=copy.deepcopy(second['workflow']);bad['steps'][0]['slots'][0]['allowed_category_ids']=['M56']
assert request('/api/processes',{'workflow':bad,'expected_revision':2})[0]==400
assert request('/api/processes?id=PROC-P03-'+str(uuid.uuid4()))[0]==404
def competing(label):
    w=copy.deepcopy(second['workflow']);w['notes']=label
    return request('/api/processes',{'workflow':w,'expected_revision':2})
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:outcomes=list(pool.map(competing,['Concurrent A','Concurrent B']))
assert sorted(status for status,_ in outcomes)==[200,409],outcomes
latest=request('/api/processes?id='+id)[1]
assert latest['revision']==3 and len(latest['history'])==3
print('Passed: authentication, origin check, server-owned identity/prices, future metadata, persistence, history, incompatible-slot rejection and concurrent-save protection.')
print('Disposable local workflow ID:',id)
