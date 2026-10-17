import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {isCatalogAdmin} from '../../../admin-policy';
import {adminConfigured,adminCookie,adminRateKey,issueAdminSession,verifyPassword,type AdminSecrets} from '../../../admin-session';
const json=(body:unknown,status=200,headers:Record<string,string>={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const sameOrigin=(request:Request)=>request.headers.get('origin')===new URL(request.url).origin;
export async function GET(){const user=await getChatGPTUser();return json({signedIn:!!user,canAdmin:await isCatalogAdmin(user),configured:adminConfigured(env as AdminSecrets)});}
export async function POST(request:Request){
 try{
  if(!sameOrigin(request))return json({error:'Same-origin requests required.'},403);
  const user=await getChatGPTUser();if(!user)return json({error:'Sign in before unlocking administration.'},401);
  if(!adminConfigured(env as AdminSecrets)||!env.DB)return json({error:'Administration has not been configured on this host.'},503);
  if(Number(request.headers.get('content-length')||0)>2048)return json({error:'Request is too large.'},413);
  const text=await request.text();if(text.length>2048)return json({error:'Request is too large.'},413);
  let input:unknown;try{input=JSON.parse(text)}catch{return json({error:'Invalid request.'},400)}
  const password=(input as {password?:unknown})?.password;if(typeof password!=='string'||!password||password.length>256)return json({error:'Enter the administrator password.'},400);
  const now=Math.floor(Date.now()/1000),window=15*60;
  // Persisted atomic counters survive worker restarts. Identity/IP values are HMAC digests.
  const identities=['user:'+user.userId];const ip=request.headers.get('cf-connecting-ip');if(ip)identities.push('ip:'+ip);
  const keys=await Promise.all(identities.map(id=>adminRateKey(id,env as AdminSecrets)));
  const counters=await env.DB.batch(keys.map(key=>env.DB!.prepare('INSERT INTO admin_unlock_limits(key,window_started,attempts) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN window_started<=? THEN 1 ELSE attempts+1 END,window_started=CASE WHEN window_started<=? THEN excluded.window_started ELSE window_started END RETURNING attempts,window_started').bind(key,now,now-window,now-window)));
  const blocked=counters.map(r=>r.results[0] as {attempts:number;window_started:number}).filter(r=>r.attempts>5);
  if(blocked.length)return json({error:'Too many unlock attempts. Try again after the 15-minute window.'},429,{'Retry-After':String(Math.max(...blocked.map(r=>r.window_started+window-now)))});
  if(!await verifyPassword(password,env as AdminSecrets))return json({error:'The administrator password was not accepted.'},403);
  const token=await issueAdminSession(user.userId,env as AdminSecrets);
  return json({canAdmin:true},200,{'Set-Cookie':adminCookie(token,new URL(request.url).protocol==='https:')});
 }catch(e){console.error('Admin unlock failed');return json({error:'Administration could not be unlocked. Please retry.'},500);}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return json({error:'Same-origin requests required.'},403);return json({canAdmin:false},200,{'Set-Cookie':adminCookie('',new URL(request.url).protocol==='https:')});}
