"""Local-only API checks. Restores the exact pre-test model overlay afterward."""
import csv
import getpass
import http.cookiejar
import io
import json
import os
from pathlib import Path
import sqlite3
import urllib.error
import urllib.request

BASE='http://127.0.0.1:5173'
root=Path(__file__).resolve().parents[2]
jar=http.cookiejar.CookieJar()
client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def request(path,body=None,origin=BASE,anonymous=False):
    req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers={'Origin':origin,'Content-Type':'application/json'})
    try:
        with (urllib.request.urlopen(req) if anonymous else client.open(req)) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:
        text=e.read().decode()
        try: data=json.loads(text)
        except json.JSONDecodeError:data={'error':text[:100]}
        return e.code,data
assert request('/api/admin/positions',anonymous=True)[0]==401
client.open(BASE+'/signin-with-chatgpt?return_to=%2F').read()
assert request('/api/admin/positions')[0]==403
password=os.environ.get('ICONPCL_TEST_ADMIN_PASSWORD') or getpass.getpass('Local administrator password: ')
assert request('/api/admin/session',{'password':password})[0]==200
snapshot=request('/api/admin/positions')[1]
profile=snapshot['library']['profiles'][0]
row={k:profile[k] for k in ['equipment_id','manufacturer','model_name']}
row.update(position='local_qa_position',fiber_id='local_qa_fiber',fiber_description='Synthetic local API test fixture',direction='qa.action',direction_description='Synthetic test action',effect_summary='Synthetic QA effect; no scientific claim')
def text(rows):
    f=io.StringIO();w=csv.DictWriter(f,list(row));w.writeheader();w.writerows(rows);return f.getvalue()
database=next(p for p in (root/'.wrangler/state/v3/d1').rglob('*.sqlite') if 'position_profile_edits' in {r[0] for r in sqlite3.connect(p).execute("SELECT name FROM sqlite_master WHERE type='table'")})
db=sqlite3.connect(database,timeout=15)
before=db.execute('SELECT payload,revision,updated_at FROM position_profile_edits WHERE equipment_id=?',(profile['equipment_id'],)).fetchone()
try:
    invalid=text([row,{**row,'equipment_id':'does-not-exist'}])
    assert request('/api/admin/positions',{'mode':'preview','csv':invalid})[1]['plan']['errors']
    assert request('/api/admin/positions',{'mode':'apply','csv':invalid,'expected_revision':snapshot['revision']})[0]==400
    assert request('/api/admin/positions')[1]['revision']==snapshot['revision']
    valid=text([row]);preview=request('/api/admin/positions',{'mode':'preview','csv':valid})[1]
    assert not preview['plan']['errors'], preview['plan']['errors']
    assert request('/api/admin/positions',{'mode':'apply','csv':valid,'expected_revision':preview['revision']},origin='https://wrong.test')[0]==403
    status,applied=request('/api/admin/positions',{'mode':'apply','csv':valid,'expected_revision':preview['revision'],'filename':'local-position-qa.csv'})
    assert status==200 and applied['changedCount']==1
    assert request('/api/admin/positions',{'mode':'apply','csv':valid,'expected_revision':preview['revision']})[0]==409
    public=request('/api/catalog',anonymous=True)[1]
    current=next(p for p in public['positions']['profiles'] if p['equipment_id']==profile['equipment_id'])
    assert current['interface']['fibers'][0]['directions'][0]['effect_summary']==row['effect_summary']
    assert public['assets']==[] and public['canAdmin'] is False
finally:
    if before:db.execute('UPDATE position_profile_edits SET payload=?,revision=?,updated_at=? WHERE equipment_id=?',(*before,profile['equipment_id']))
    else:db.execute('DELETE FROM position_profile_edits WHERE equipment_id=?',(profile['equipment_id'],))
    db.commit();db.close()
print('Position API checks passed: admin gate, preview, atomic rejection, persistence, public model data, inventory isolation, CSRF, stale revision, restoration.')
