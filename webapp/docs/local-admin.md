# Local administrator

The portable development preview automatically signs in as **admin** on localhost
and 127.0.0.1. No browser cookie, password or separate sign-in is needed to save
workflows, edit records or use admin tools. Existing local plans retain the same
internal owner ID, so changing the displayed account name does not hide them.

This applies only to the development server on this computer. Incoming identity
headers are removed before the preview injects its local identity, and injection
requires both a loopback hostname and a loopback socket. The production build
does not include the development administrator binding. Hosted sign-in, password
sessions and inventory restrictions are unchanged. Do not expose the local
development server as a public service.

For the anonymous/reader/password access integration tests, start a separate
preview with `SITES_LOCAL_AUTO_ADMIN=0`. That restores the normal mock sign-in
cookie and password flow. Do not run those negative access tests against the
automatic-admin preview: it intentionally has no signed-out state.

`python tests/integration/local_admin_preview.py` checks a filled P27 plan's
initial save, reopen and repeat save without sending sign-in cookies.
