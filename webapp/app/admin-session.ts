// Server-side cryptography, also exercised directly by the security tests.
export type AdminSecrets={CATALOG_ADMIN_PASSWORD_HASH?:string;CATALOG_ADMIN_SESSION_KEY?:string};
export const ADMIN_COOKIE='iconpcl_admin';
export const ADMIN_SESSION_SECONDS=8*60*60;
const encoder=new TextEncoder();
const hex=(bytes:ArrayBuffer)=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const unhex=(s:string)=>new Uint8Array(s.match(/../g)!.map(x=>parseInt(x,16)));
function equal(a:string,b:string){let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
export function adminConfigured(secrets:AdminSecrets){return /^pbkdf2-sha256\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(secrets.CATALOG_ADMIN_PASSWORD_HASH||'')&&/^[a-f0-9]{64}$/.test(secrets.CATALOG_ADMIN_SESSION_KEY||'');}
export async function passwordHash(password:string,salt:string){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 return 'pbkdf2-sha256$100000$'+salt+'$'+hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unhex(salt),iterations:100000},key,256));
}
export async function verifyPassword(password:string,secrets:AdminSecrets){if(!adminConfigured(secrets)||!password||password.length>256)return false;const salt=secrets.CATALOG_ADMIN_PASSWORD_HASH!.split('$')[2];return equal(await passwordHash(password,salt),secrets.CATALOG_ADMIN_PASSWORD_HASH!);}
async function signature(value:string,secrets:AdminSecrets){
 const key=await crypto.subtle.importKey('raw',encoder.encode(secrets.CATALOG_ADMIN_SESSION_KEY+'|'+secrets.CATALOG_ADMIN_PASSWORD_HASH),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));
}
const encode=(s:string)=>btoa(String.fromCharCode(...encoder.encode(s))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
function decode(s:string){return new TextDecoder().decode(Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0)));}
export async function issueAdminSession(userId:string,secrets:AdminSecrets,now=Math.floor(Date.now()/1000)){
 if(!userId||!adminConfigured(secrets))throw new Error('Administration is not configured.');
 const payload=encode(JSON.stringify({v:1,sub:userId,iat:now,exp:now+ADMIN_SESSION_SECONDS}));return payload+'.'+await signature(payload,secrets);
}
export async function verifyAdminSession(token:string|undefined,userId:string|undefined,secrets:AdminSecrets,now=Math.floor(Date.now()/1000)){
 if(!userId||!token||token.length>2048||!adminConfigured(secrets))return false;
 try{const [payload,mac,...extra]=token.split('.');if(extra.length||!payload||!mac||!equal(mac,await signature(payload,secrets)))return false;
 const p=JSON.parse(decode(payload));return p.v===1&&p.sub===userId&&Number.isSafeInteger(p.iat)&&Number.isSafeInteger(p.exp)&&p.iat<=now&&p.exp>now&&p.exp-p.iat===ADMIN_SESSION_SECONDS;
 }catch{return false;}
}
export async function adminRateKey(identity:string,secrets:AdminSecrets){return signature('admin-unlock-rate|'+identity,secrets);}
export function adminCookie(token:string,secure=true){return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token?ADMIN_SESSION_SECONDS:0}${secure?'; Secure':''}`;}
