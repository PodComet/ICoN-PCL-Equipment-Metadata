"""Local-preview-only integration checks; never pointed at a hosted catalog."""
import concurrent.futures
import csv
import getpass
import os
import http.cookiejar
import io
import json
import urllib.error
import urllib.request

BASE = 'http://127.0.0.1:5173'
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
client.open(BASE + '/signin-with-chatgpt?return_to=%2F').read()

def request(path, body=None, origin=BASE, anonymous=False):
    headers = {'Origin': origin, 'Content-Type': 'application/json'}
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
    try:
        with (urllib.request.urlopen(req) if anonymous else client.open(req)) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        payload=error.read().decode()
        try: body=json.loads(payload)
        except json.JSONDecodeError: body={"error":payload[:300]}
        return error.code, body

def csv_text(rows):
    output = io.StringIO()
    writer = csv.DictWriter(output, list(dict.fromkeys(k for row in rows for k in row)))
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()

password = os.environ.get('ICONPCL_TEST_ADMIN_PASSWORD') or getpass.getpass('Local administrator password: ')
assert request('/api/admin/session', {'password': password})[0] == 200
assert request('/api/admin/catalog', anonymous=True)[0] == 401
assert request('/api/admin/catalog', {'mode': 'preview', 'csv': ''}, origin='https://wrong.test')[0] == 403
status, snapshot = request('/api/admin/catalog')
assert status == 200
original = {r['equipment_id']: r for r in snapshot['records']}
revision = snapshot['revision']
invalid=csv_text([{'operation':'update','equipment_id':'M37-09','notes':'Must not apply'},{'operation':'update','equipment_id':'does-not-exist','notes':'bad'}])
assert request('/api/admin/catalog', {'mode':'apply','csv':invalid,'expected_revision':revision})[0] == 400
assert request('/api/admin/catalog')[1]['revision'] == revision
update = csv_text([{'operation': 'update', 'equipment_id': 'M37-09', 'notes': 'Local CSV integration check, with comma\nand newline.'},{'operation':'update','equipment_id':'M37-10','notes':'Second row in the same atomic batch.'}])
status, preview = request('/api/admin/catalog', {'mode': 'preview', 'csv': update})
assert status == 200 and not preview['plan']['errors'] and len(preview['plan']['changes']) == 2
assert request('/api/admin/catalog')[1]['revision'] == revision, 'Preview wrote changes'
status, applied = request('/api/admin/catalog', {'mode': 'apply', 'csv': update, 'filename': 'local-qa.csv', 'expected_revision': revision})
assert status == 200 and applied['changedCount'] == 2
assert request('/api/admin/catalog', {'mode': 'apply', 'csv': update, 'expected_revision': revision})[0] == 409
status, normal = request('/api/catalog')
assert status == 200
assert next(r['record'] for r in normal['rows'] if r['record']['equipment_id'] == 'M37-09')['notes'].startswith('Local CSV integration check')

revision = applied['revision']
files = [csv_text([{'operation': 'update', 'equipment_id': 'M37-09', 'notes': label}]) for label in ['Concurrent A', 'Concurrent B']]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    outcomes = list(pool.map(lambda text: request('/api/admin/catalog', {'mode': 'apply', 'csv': text, 'filename': 'local-concurrent.csv', 'expected_revision': revision}), files))
assert sorted(code for code, _ in outcomes) == [200, 409], outcomes
latest = request('/api/admin/catalog')[1]
assert latest['revision'] == revision + 1
restoration = csv_text([{'operation': 'update', 'equipment_id': key, 'notes': original[key]['notes'] or '[CLEAR]'} for key in ['M37-09','M37-10']])
assert request('/api/admin/catalog', {'mode': 'apply', 'csv': restoration, 'filename': 'local-restore.csv', 'expected_revision': latest['revision']})[0] == 200
print('Local integration passed: authentication, CSRF, preview without writes, shared persistence, stale/concurrent conflict, history, restoration.')
