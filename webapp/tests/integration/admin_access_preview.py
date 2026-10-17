"""Local-only access matrix. Prompts for a password or reads ICONPCL_TEST_ADMIN_PASSWORD."""
import getpass
import http.cookiejar
import json
import os
from pathlib import Path
import urllib.error
import urllib.request

BASE = 'http://127.0.0.1:5173'
jar = http.cookiejar.CookieJar()
client = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def request(path, body=None, method=None, origin=BASE, anonymous=False):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
        method=method, headers={'Origin': origin, 'Content-Type': 'application/json'})
    try:
        with (urllib.request.urlopen(req) if anonymous else client.open(req)) as response:
            return response.status, json.load(response), response.headers
    except urllib.error.HTTPError as error:
        text = error.read().decode()
        try: body = json.loads(text)
        except json.JSONDecodeError: body = {'error': text[:300]}
        return error.code, body, error.headers

def no_inventory(data):
    assert data['canAdmin'] is False and data['assets'] == []
    assert all(not row['record']['purdue_instrument_ids'] and not row['record']['purdue_serial_or_other_ids'] for row in data['rows'])

assert request('/api/admin/catalog', anonymous=True)[0] == 401
no_inventory(request('/api/catalog', anonymous=True)[1])
client.open(BASE + '/signin-with-chatgpt?return_to=%2F').read()
normal = request('/api/catalog')[1]
no_inventory(normal)
assert normal['canEdit'] is True
assert request('/api/admin/catalog')[0] == 403
assert request('/api/admin/session', {'password': 'incorrect'}, origin='https://wrong.test')[0] == 403
assert request('/api/admin/session', {'password': 'incorrect'})[0] == 403
password = os.environ.get('ICONPCL_TEST_ADMIN_PASSWORD') or getpass.getpass('Local administrator password: ')
status, unlocked, headers = request('/api/admin/session', {'password': password})
assert status == 200 and unlocked['canAdmin'] is True
assert 'HttpOnly' in headers['Set-Cookie'] and 'SameSite=Strict' in headers['Set-Cookie']
assert request('/api/admin/catalog')[0] == 200
assets = json.loads((Path(__file__).resolve().parents[2] / 'app/data/purdue-inventory.json').read_text(encoding='utf-8'))
admin = request('/api/catalog')[1]
assert admin['canAdmin'] is True and len(admin['assets']) == len(assets)
assert request('/api/admin/catalog', {'mode': 'preview', 'csv': ''}, origin='https://wrong.test')[0] == 403
cookie = next(c for c in jar if c.name == 'iconpcl_admin')
valid_token = cookie.value
cookie.value += 'tampered'
assert request('/api/admin/catalog')[0] == 403
no_inventory(request('/api/catalog')[1])
cookie.value = valid_token
assert request('/api/admin/session', method='DELETE', origin='https://wrong.test')[0] == 403
assert request('/api/admin/catalog')[0] == 200
assert request('/api/admin/session', method='DELETE')[0] == 200
assert request('/api/admin/catalog')[0] == 403
no_inventory(request('/api/catalog')[1])
for _ in range(3):
    assert request('/api/admin/session', {'password': 'incorrect'})[0] == 403
status, _, headers = request('/api/admin/session', {'password': password})
assert status == 429 and int(headers['Retry-After']) > 0
print('Local access matrix passed: anonymous, signed-in reader, admin, inventory isolation, CSRF, tampering, lock, rate limiting.')
