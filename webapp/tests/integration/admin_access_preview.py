"""Prompt for the local QA password and run the password-only access matrix."""
import getpass
import json
import os
from pathlib import Path
import subprocess

app = Path(__file__).resolve().parents[2]
password = os.environ.get('ICONPCL_TEST_ADMIN_PASSWORD') or getpass.getpass('Local administrator password: ')
result = subprocess.run(
    [os.environ.get('ICONPCL_NODE', 'node'), '--experimental-strip-types',
     str(app / 'tests/integration/password_access.mjs')],
    cwd=app, input=json.dumps({'password': password}), text=True, encoding='utf-8',
)
raise SystemExit(result.returncode)
