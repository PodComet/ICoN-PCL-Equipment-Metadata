"""Three-token persistence and access checks. Only uses the loopback preview."""
import copy
import hashlib
import http.cookiejar
import io
import json
import os
from pathlib import Path
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile

BASE='http://127.0.0.1:5173'
jar=http.cookiejar.CookieJar()
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
client.open(BASE+'/signin-with-chatgpt?return_to=%2F').read()

def request(path,body=None,method=None,anonymous=False,origin=BASE,binary=False):
    raw=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(BASE+path,data=raw,method=method or ('PUT' if raw is not None else 'GET'),headers={'Origin':origin,'Content-Type':'application/json'})
    try:
        with (urllib.request.urlopen(req,timeout=90) if anonymous else client.open(req,timeout=90)) as r:
            value=r.read()
            return r.status,value if binary else json.loads(value)
    except urllib.error.HTTPError as e:
        error=e.read()
        try: return e.code,json.loads(error)
        except json.JSONDecodeError: return e.code,{'error':error.decode()[:300]}

def expect(status,path,body=None,**kw):
    actual,result=request(path,body,**kw)
    assert actual==status,(path,actual,result)
    return result

root=Path(__file__).resolve().parents[2]
if os.environ.get('ICONPCL_TEST_ADMIN_COOKIE_FILE'):
    name,value=Path(os.environ['ICONPCL_TEST_ADMIN_COOKIE_FILE']).read_text().split('=',1)
    jar.set_cookie(http.cookiejar.Cookie(0,name,value,None,False,'127.0.0.1',False,False,'/',True,False,None,True,None,None,{},False))
if os.environ.get('ICONPCL_TEST_ADMIN_PASSWORD'):
    expect(200,'/api/admin/session',{'password':os.environ['ICONPCL_TEST_ADMIN_PASSWORD']},method='POST')
fixture=json.loads(subprocess.check_output([os.environ['ICONPCL_TEST_NODE'],str(Path(__file__).with_name('workflow-token-fixture.mjs'))],cwd=root))
model=fixture['model_id']
for path in ['/api/machines','/api/recipes','/api/runs','/api/processes']:
    expect(401,path,anonymous=True)
for path in ['/api/machines','/api/runs']:
    expect(403,path,{},method='POST',origin='https://other.example')

key=str(uuid.uuid4())
registration={'equipment_id':model,'label':'Synthetic local QA unit A','registration_key':key}
unit=expect(201,'/api/machines',registration,method='POST')['machine']
assert expect(200,'/api/machines',registration,method='POST')['machine']==unit
expect(409,'/api/machines',{**registration,'label':'Different unit'},method='POST')
other=expect(201,'/api/machines',{**registration,'label':'Synthetic local QA unit B','registration_key':str(uuid.uuid4())},method='POST')['machine']
assert other['machine_token']!=unit['machine_token']
assert unit['machine_token'] in [u['machine_token'] for u in expect(200,'/api/machines')['machines']]

w=fixture['workflow']
for step in w['steps']:
    for slot in step['slots']: slot['instrument']['extensions']['machine_token']=unit['machine_token']
saved=expect(200,'/api/processes',{'workflow':w,'expected_revision':0})
wid=saved['workflow']['workflow_id'];token=saved['recipe_token']
assert token.startswith('sha256:') and saved['workflow']['extensions']['recipe_token']==token

def recipe_bytes(rev):
    return expect(200,'/api/recipes?'+urllib.parse.urlencode({'workflow_id':wid,'revision':rev,'download':1}),binary=True)

data=recipe_bytes(1)
assert 'sha256:'+hashlib.sha256(data).hexdigest()==token
manifest=json.loads(data)
assert manifest['geometry']['shape']=='Annular coupon' and len(manifest['machine_roles'])==1
assert 'urn:uuid:' not in data.decode() # actual unit belongs to the run, not the recipe
# Check the shared exchange schema, including the live planning-draft profile.
import jsonschema
schema_path=root/'public/ontology/machine-recipe-run.schema.json'
if schema_path.exists():
    schema=json.loads(schema_path.read_text(encoding='utf-8'))
    jsonschema.Draft202012Validator({'$defs':schema['$defs'],'$ref':'#/$defs/RecipeManifest'}).validate(manifest)

again=expect(200,'/api/processes',{'workflow':saved['workflow'],'expected_revision':1})
assert again['recipe_token']==token
assert recipe_bytes(1)==recipe_bytes(2)
changed=copy.deepcopy(again['workflow'])
changed['steps'][0]['slots'][0]['instrument']['operating_parameters']['synthetic_power']={'value':125,'unit':'W'}
latest=expect(200,'/api/processes',{'workflow':changed,'expected_revision':2})
assert latest['recipe_token']!=token and recipe_bytes(1)==data
# Older unchanged revisions still resolve to the original hash.
assert expect(200,'/api/processes?id='+wid+'&revision=1')['recipe_token']==token

request_key=str(uuid.uuid4())
command={'workflow_id':wid,'workflow_revision':1,'request_key':request_key}
first=expect(201,'/api/runs',command,method='POST')
replayed=expect(200,'/api/runs',command,method='POST')
second=expect(201,'/api/runs',{**command,'request_key':str(uuid.uuid4())},method='POST')
rid=first['record']['record_id'];run=first['record']['properties']['ontology_run_tokens']
assert replayed['record']['record_id']==rid
assert run['run_token']!=second['record']['properties']['ontology_run_tokens']['run_token']
assert run['recipe_token']==second['record']['properties']['ontology_run_tokens']['recipe_token']==token
assert run['machine_bindings'][0]['machine_token']==unit['machine_token']
expect(409,'/api/runs',{**command,'workflow_revision':2},method='POST')
assert request('/api/research',{'record':{**first['record'],'status':'in_progress'},'expected_revision':1})[0]==400

# Create linked material and specimen records inside the run's collection.
def sample(code,name,status):
    r={**copy.deepcopy(first['record']),'record_id':'','kind':'object','type_code':'SAMPLE','code':code,'name':name,'container_id':rid,'status':status,'workflow_id':'','workflow_revision':None,'properties':{},'equipment_ids':[],'category_ids':[]}
    return expect(200,'/api/research',{'record':r,'expected_revision':0})
suffix=uuid.uuid4().hex[:8].upper()
feed=sample('FEED_'+suffix,'Synthetic powder batch','planned')
specimen=sample('COUPON_'+suffix,'Synthetic sample record','completed')
draft=copy.deepcopy(first['record']);links=draft['properties']['ontology_run_tokens']
links['material_bindings'][0].update({'batch_id':'SYNTHETIC-LOT-A','record_id':feed['record']['record_id'],'record_revision':1})
links['specimen_bindings'][0].update({'record_id':specimen['record']['record_id'],'record_revision':1})
filled=expect(200,'/api/research',{'record':draft,'expected_revision':1})
updated_feed=copy.deepcopy(feed['record']);updated_feed['name']='Edited material label'
expect(200,'/api/research',{'record':updated_feed,'expected_revision':1})
reopened=expect(200,'/api/research?id='+rid)
assert reopened['record']['properties']['ontology_run_tokens']['material_bindings'][0]['record_snapshot']['name']=='Synthetic powder batch'
assert reopened['record']['properties']['ontology_run_tokens']['material_bindings'][0]['record_revision']==1

bad=copy.deepcopy(filled['record']);bad['workflow_revision']=3
expect(400,'/api/research',{'record':bad,'expected_revision':filled['revision']})
bad=copy.deepcopy(filled['record']);bad['properties']['ontology_run_tokens']['machine_bindings'][0]['machine_token']='urn:uuid:'+str(uuid.uuid4())
expect(400,'/api/research',{'record':bad,'expected_revision':filled['revision']})
completed=copy.deepcopy(filled['record']);completed['status']='completed';completed['properties']['ontology_run_tokens']['specimen_bindings'][0]['kind']='reported'
done=expect(200,'/api/research',{'record':completed,'expected_revision':filled['revision']})
assert done['record']['properties']['ontology_run_tokens']['run_token']==run['run_token']
export=expect(200,'/api/runs?id='+rid)
assert export['recipe']['manifest_text'].encode()==data and export['links']['material_bindings'][0]['batch_id']=='SYNTHETIC-LOT-A'
assert export['links']['specimen_bindings'][0]['record_id']==specimen['record']['record_id']
assert export['machines'][0]['machine_token']==unit['machine_token']
expect(401,'/api/runs?id='+rid,anonymous=True)
expect(404,'/api/runs?id=RSR-'+str(uuid.uuid4()))
expect(404,'/api/recipes?token=sha256:'+'0'*64)
archive=expect(200,'/api/research/package?id='+rid,binary=True)
with zipfile.ZipFile(io.BytesIO(archive)) as z:
    assert z.testzip() is None
    assert z.read('recipe-manifest.json')==data
    assert json.loads(z.read('run-token-links.json'))['run_token']==run['run_token']
crate=expect(200,'/api/research?id='+rid+'&format=ro-crate')
assert run['run_token'] in json.dumps(crate)
print('PASS: registrations, exact recipe hashes, recipe history, run idempotency, unique run UUIDs, batch/specimen revision pinning, access checks and RO-Crate package.')
