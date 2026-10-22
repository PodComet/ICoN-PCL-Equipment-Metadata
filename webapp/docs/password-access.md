# Password-only administrator access

The hosted entry page accepts the shared administrator password without a
ChatGPT account. A successful login creates an eight-hour, signed, HttpOnly,
Secure, SameSite=Strict cookie. The password stays in runtime secrets as a salted
PBKDF2 hash; it is never shipped in the page, source repository or client code.
Changing the password hash or signing key invalidates existing sessions.

Every password holder is an administrator, including access to the private
Purdue inventory and shared catalog changes. Password-only visitors share an
`admin` workspace for newly saved workflows, personal catalog overlays and
research records. Existing ChatGPT-account-owned plans and research retain
their ownership and grant checks. An existing account-bound administrator
session remains supported; the password gate does not grant access to other
accounts' private research.

The hosting audience must allow anonymous requests to reach the password form.
Application authorization remains mandatory: `build/sites-worker.ts` checks
every request before the framework runs. Static assets use
`assets.run_worker_first: true`, so templates, ontology exports, bundled data,
client code and API routes cannot bypass the password gate. Only the login
endpoint and a short allowlist of branding assets are available before login.
Private responses are marked `private, no-store` and `Vary: Cookie`.

The production build also packages protected static files into a compressed
Worker module and removes their edge-served copies. This is necessary because
managed hosting can serve static assets ahead of user Worker code despite the
Wrangler routing setting. The Worker serves those exact bytes only after the
same session check; only the four login-branding files remain public. The build
retains a byte-count and SHA-256 manifest for verifying the packaged files.

The login endpoint retains same-origin checks, bounded request bodies and
persistent IP/account rate limits. It accepts either JSON or the native HTML
form. Logout clears the administrator cookie and returns to the entry page.
The portable loopback-only automatic development administrator is unchanged.

Runtime secret names remain `CATALOG_ADMIN_PASSWORD_HASH` and
`CATALOG_ADMIN_SESSION_KEY`. Never put their values in `.openai/hosting.json` or
tracked files. Keep the hosting audience restricted until the protected Worker
has been deployed and checked, then allow anonymous transport to the entry page.

Run `node --experimental-strip-types --test tests/admin-session.test.mjs
tests/site-access.test.mjs` for session and gate checks. The local access-matrix
test also checks wrong passwords, CSRF, anonymous asset/API denial, cookie
tampering, logout and password-only administration. Production verification
must include an anonymous request to a real built client asset, as well as the
home page and catalog API.
