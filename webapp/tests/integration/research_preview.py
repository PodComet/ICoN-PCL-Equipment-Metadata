"""Research data / ELN checks against loopback only; never contacts a hosted Site."""
import concurrent.futures
import copy
import hashlib
import http.cookiejar
import io
import json
from pathlib import Path
import urllib.error
import urllib.request
import uuid
import zipfile

BASE = 'http://127.0.0.1:5173'
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
client.open(BASE + '/signin-with-chatgpt?return_to=%2F').read()

def request(path, body=None, method=None, anonymous=False, origin=BASE, content_type='application/json', binary=False):
    data = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method or ('PUT' if data is not None else 'GET'), headers={'Origin':origin,'Content-Type':content_type})
    try:
        with (urllib.request.urlopen(req) if anonymous else client.open(req)) as response:
            raw = response.read()
            return response.status, raw if binary else json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try: return e.code, json.loads(raw)
        except json.JSONDecodeError: return e.code, {'error':raw.decode()[:300]}

def blank(kind, code, parent=''):
    types={'space':'SPACE','project':'PROJECT','collection':'EXPERIMENT','object':'SAMPLE','dataset':'RAW_DATA'}
    return {'schema':'iconpcl-research/v1','record_id':'','kind':kind,'code':code,'name':code+' · synthetic local QA','description':'Synthetic research metadata; no experimental claim.','container_id':parent,'type_code':types[kind],'status':'planned','creators':[{'name':'Synthetic researcher','orcid':'0000-0002-1825-0097','affiliation':'Example institution','ror':''}],'license_uri':'','access_scope':'private','process_ids':['P03'],'material_ids':['N01'],'equipment_ids':['M13-01'],'category_ids':[],'relations':[],'workflow_id':'','workflow_revision':None,'acquisition_time':'','properties':{},'notes':'Disposable local integration example.','files':[]}

def save(record, revision=0):
    status, body = request('/api/research', {'record':record,'expected_revision':revision})
    assert status == 200, body
    return body

assert request('/api/research', anonymous=True)[0] == 401
assert request('/api/research', {}, origin='https://other.test')[0] == 403
suffix=uuid.uuid4().hex[:10].upper()
space=save(blank('space','QA_'+suffix))
project=save(blank('project','PROJECT',space['record']['record_id']))
collection=save(blank('collection','EXPERIMENT',project['record']['record_id']))
sample=save(blank('object','SAMPLE_001',collection['record']['record_id']))
bad=blank('dataset','BAD',space['record']['record_id'])
assert request('/api/research',{'record':bad,'expected_revision':0})[0] == 400
record=blank('dataset','RAW_001',sample['record']['record_id'])
source=b'# model: Synthetic centrifuge\r\ntime [s],mass [mg]\r\n0,2\r\n1,3\r\n'
key=str(uuid.uuid4())
def ingest(key_value=key,source_bytes=source,anonymous=False):
    boundary='----ICONPCL'+uuid.uuid4().hex
    fields=[('record',json.dumps(record)),('ingest_key',key_value)]
    body=b''
    for name,value in fields:
        body+=f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    body+=f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="synthetic.csv"\r\nContent-Type: text/csv\r\n\r\n'.encode()+source_bytes+f'\r\n--{boundary}--\r\n'.encode()
    return request('/api/research/ingest',body,method='POST',content_type='multipart/form-data; boundary='+boundary,anonymous=anonymous)
assert ingest(anonymous=True)[0] == 401
status,first=ingest();assert status == 200, first
rid=first['record']['record_id'];file=first['record']['files'][0];fid=file['file_id']
assert file['sha256'] == hashlib.sha256(source).hexdigest()
assert file['extraction']['row_count'] == 2 and first['record']['category_ids'] == ['M13']
assert ingest()[1]['record']['record_id'] == rid
assert ingest(source_bytes=source+b'2,4\r\n')[0] == 409
assert request('/api/research/files?id='+fid,anonymous=True)[0] == 401
assert request('/api/research/files?id='+fid,binary=True)[1] == source
assert request('/api/research?id='+rid,anonymous=True)[0] == 401
assert request('/api/research?id=RSR-'+str(uuid.uuid4()))[0] == 404
tampered=copy.deepcopy(first['record']);tampered['files'][0]['sha256']='0'*64
assert request('/api/research',{'record':tampered,'expected_revision':1})[0] == 400
status,package=request('/api/research/package?id='+rid,binary=True);assert status == 200, package
with zipfile.ZipFile(io.BytesIO(package)) as archive:
    assert archive.testzip() is None
    crate=json.loads(archive.read('ro-crate-metadata.json'))
    graph=crate['@graph'];root=next(n for n in graph if n['@id']=='./')
    raw_path=root['hasPart'][0]['@id'];assert archive.read(raw_path) == source
    assert hashlib.sha256(archive.read(raw_path)).hexdigest() == file['sha256']
    assert json.loads(archive.read('datacite-draft.json'))['registration_ready'] is False
draft=copy.deepcopy(first['record']);draft['notes']='Second revision'
second=save(draft,1)
assert request('/api/research',{'record':draft,'expected_revision':1})[0] == 409
assert request('/api/research?id='+rid+'&revision=1')[1]['record']['notes'] == first['record']['notes']
def competing(label):
    next_record=copy.deepcopy(second['record']);next_record['notes']=label
    return request('/api/research',{'record':next_record,'expected_revision':2})
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    outcomes=list(pool.map(competing,['A','B']))
assert sorted(s for s,_ in outcomes) == [200,409], outcomes
latest=request('/api/research?id='+rid)[1]
assert len(latest['history']) == 3
assert request('/api/research/grants',{'space_id':space['record']['record_id'],'email':'viewer@example.invalid','remove':False})[0] == 200
assert request('/api/research/grants?space_id='+space['record']['record_id'])[1]['grants'][0]['role'] == 'viewer'
assert request('/api/research/grants',{'space_id':space['record']['record_id'],'email':'viewer@example.invalid','remove':True})[0] == 200
withdrawn=copy.deepcopy(latest['record']);withdrawn['status']='withdrawn'
save(withdrawn,latest['revision'])
assert request('/api/research/files?id='+fid)[0] == 410
assert request('/api/research/package?id='+rid)[0] == 410
assert request('/api/research?id='+rid+'&format=ro-crate')[0] == 200
assert request('/api/research?id='+rid+'&revision=1')[0] == 200
# Cross-record updates must not admit a lineage cycle through separate revisions.
a_record=blank('object','CYCLE_A',collection['record']['record_id']);a_record['status']='completed'
b_record=blank('object','CYCLE_B',collection['record']['record_id']);b_record['status']='completed'
a=save(a_record);b=save(b_record)
def competing_edge(pair):
    source_saved,target_saved=pair
    updated=copy.deepcopy(source_saved['record']);updated['relations']=[{'relation':'wasDerivedFrom','target_id':target_saved['record']['record_id']}]
    return request('/api/research',{'record':updated,'expected_revision':1})
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    edges=list(pool.map(competing_edge,[(a,b),(b,a)]))
assert sum(status==200 for status,_ in edges)==1,edges
assert all(status in (200,400,409) for status,_ in edges),edges
Path('.sites-runtime/research-qa.json').write_text(json.dumps({'space_id':space['record']['record_id'],'sample_id':sample['record']['record_id'],'dataset_id':rid}),encoding='utf-8')
print('Passed: authentication, origin check, hierarchy, exact source bytes/checksums, extraction, idempotency, guarded manifests, readable ZIP exports, history, concurrent saves, viewer grants and retained metadata after withdrawal.')
