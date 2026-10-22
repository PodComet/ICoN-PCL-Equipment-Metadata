import {ADMIN_COOKIE, verifyAdminSession, type AdminSecrets} from './admin-session.ts';
import {isLocalAdmin} from './local-admin.ts';
import {PASSWORD_ADMIN_ID} from './password-identity.ts';

type AccessSecrets = AdminSecrets & {SITES_LOCAL_ADMIN?: string};
const publicBranding = new Set(['/favicon.svg', '/assets/icon-pcl-logo.jpg', '/assets/purdue-university.svg', '/assets/drexel-university.svg']);
const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export function requestAdminCookie(request: Request): string | undefined {
  const values = (request.headers.get('cookie') || '').split(';').map(p => p.trim())
    .filter(p => p.startsWith(ADMIN_COOKIE + '=')).map(p => p.slice(ADMIN_COOKIE.length + 1));
  return values.length === 1 ? values[0] : undefined;
}

export async function requestHasAdminAccess(request: Request, secrets: AccessSecrets): Promise<boolean> {
  const userId = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if (userId && email && isLocalAdmin({userId, email}, secrets)) return true;
  const token = requestAdminCookie(request);
  if (await verifyAdminSession(token, PASSWORD_ADMIN_ID, secrets)) return true;
  // Retain verified account-bound sessions when a visitor chooses ChatGPT sign-in.
  return !!userId && !!email && verifyAdminSession(token, userId, secrets);
}

export function passwordLoginResponse(error = '', status = 200, headers: Record<string,string> = {}): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Administrator access · Nanomaterial Equipment Ontology</title><link rel="icon" href="/favicon.svg"><style>
  *{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:28px;background:#0d2035;color:#172334;font-family:Arial,sans-serif}main{width:min(100%,540px);padding:34px;background:#fffdf7;border:1px solid #cdb77d;border-radius:18px;box-shadow:0 18px 70px #0005}.logo{width:170px;max-width:70%;height:auto;margin-bottom:24px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.14em;color:#6c5421}h1{font-size:30px;line-height:1.15;margin:12px 0 24px}h2{font-size:21px;margin:0 0 10px}p{font-size:16px;line-height:1.5}form{display:grid;gap:12px;margin-top:24px}label{font-size:16px;font-weight:800}input{width:100%;padding:14px;border:2px solid #364e62;border-radius:8px;font:inherit;color:#111;background:white}button{padding:14px;border:0;border-radius:8px;background:#173e37;color:white;font:700 17px Arial,sans-serif;cursor:pointer}input:focus,button:focus{outline:3px solid #b8943b;outline-offset:3px}.error{padding:12px;border:1px solid #b32e2e;border-radius:7px;color:#8a1111;background:#fff1ec;font-weight:700}.note{font-size:13px;color:#46525d;margin:18px 0 0}.partners{display:flex;align-items:center;gap:24px;margin-top:28px;padding-top:20px;border-top:1px solid #d9d6cd}.partners img{width:110px;max-height:48px;object-fit:contain}@media(max-width:480px){main{padding:24px}h1{font-size:26px}}
  </style></head><body><main><img class="logo" src="/assets/icon-pcl-logo.jpg" alt="ICoN-PCL"><p class="eyebrow">RESEARCH EQUIPMENT · MATERIALS · PROCESSES</p><h1>Nanomaterial Equipment Ontology</h1><h2>Administrator access</h2><p>Enter the shared administrator password to continue.</p>${error ? '<p class="error" role="alert">'+escapeHtml(error)+'</p>' : ''}<form method="post" action="/api/admin/session"><label for="password">Administrator password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required autofocus><button type="submit">Enter the ontology</button></form><p class="note">Access lasts up to 8 hours in this browser.</p><div class="partners"><img src="/assets/purdue-university.svg" alt="Purdue University"><img src="/assets/drexel-university.svg" alt="Drexel University"></div></main></body></html>`;
  return new Response(html, {status, headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Vary':'Cookie','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'self'",...headers}});
}

/** Runs before every application route AND static asset in production. */
export async function siteAccessResponse(request: Request, secrets: AccessSecrets): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path === '/api/admin/session' || publicBranding.has(path) && ['GET','HEAD'].includes(request.method)) return null;
  if (await requestHasAdminAccess(request, secrets)) return null;
  if (path === '/' && ['GET','HEAD'].includes(request.method)) {
    const response = passwordLoginResponse();
    return request.method === 'HEAD' ? new Response(null, response) : response;
  }
  return Response.json({error:'Enter the administrator password to access the ontology.'}, {status:401,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
}

export function privateSiteResponse(response: Response): Response {
  const result = new Response(response.body, response);
  result.headers.set('Cache-Control', 'private, no-store');
  result.headers.append('Vary', 'Cookie');
  result.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return result;
}
