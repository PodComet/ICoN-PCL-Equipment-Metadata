import {env} from 'cloudflare:workers';
import type {ChatGPTUser} from './chatgpt-auth';
import type {SavedResearch} from './research-lib';
import {researchMayRead} from './research-access-lib';
export type ResearchRow={record_id:string;owner_id:string;space_id:string;kind:string;container_id:string;code:string;payload:string;revision:number;access_scope:string;created_at:string;updated_at:string};
export const researchJson=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function savedResearch(row:ResearchRow,user:ChatGPTUser):SavedResearch{return {record:JSON.parse(row.payload),revision:row.revision,created_at:row.created_at,updated_at:row.updated_at,can_edit:row.owner_id===user.userId,space_id:row.space_id};}
export async function researchRow(id:string){return env.DB!.prepare('SELECT * FROM research_records WHERE record_id=?').bind(id).first<ResearchRow>();}
export async function canReadResearch(row:ResearchRow,user:ChatGPTUser){const grant=row.owner_id===user.userId?false:!!await env.DB!.prepare('SELECT 1 FROM research_grants WHERE space_id=? AND email=?').bind(row.space_id,user.email.toLowerCase()).first();return researchMayRead(row.owner_id,user.userId,row.kind,row.access_scope,grant);}
export async function researchRows(user:ChatGPTUser,owned=false){
 const query=owned?'SELECT * FROM research_records WHERE owner_id=? ORDER BY created_at,record_id LIMIT 501':'SELECT * FROM research_records WHERE owner_id=? OR ((access_scope=\'space\' OR kind=\'space\') AND space_id IN (SELECT space_id FROM research_grants WHERE email=?)) ORDER BY created_at,record_id LIMIT 1001';
 const stmt=env.DB!.prepare(query),result=await (owned?stmt.bind(user.userId):stmt.bind(user.userId,user.email.toLowerCase())).all<ResearchRow>();
 if(result.results.length>(owned?500:1000))throw new Error('Research workspace capacity reached. Export records and contact the maintainer before adding more. No records were truncated.');
 return result.results;
}
export function researchFailure(e:unknown){console.error('Research operation failed',e);return researchJson({error:'Research storage is unavailable. Your draft remains open; retry or download the draft.'},503);}
export const sameResearchOrigin=(request:Request)=>request.headers.get('origin')===new URL(request.url).origin;
export async function researchFence(ownerId:string){await env.DB!.prepare('INSERT OR IGNORE INTO research_owners(owner_id,revision) VALUES(?,0)').bind(ownerId).run();return (await env.DB!.prepare('SELECT revision FROM research_owners WHERE owner_id=?').bind(ownerId).first<{revision:number}>())!.revision;}
export const advanceResearchFence=(ownerId:string,expected:number)=>env.DB!.prepare('UPDATE research_owners SET revision=CASE WHEN revision=? THEN revision+1 ELSE NULL END WHERE owner_id=?').bind(expected,ownerId);
export async function researchFenceChanged(ownerId:string,expected:number){return (await env.DB!.prepare('SELECT revision FROM research_owners WHERE owner_id=?').bind(ownerId).first<{revision:number}>())?.revision!==expected;}
export async function boundedResearchBody(request:Request,max:number){
 if(Number(request.headers.get('content-length')||0)>max)throw new Error('Request exceeds the upload limit.');
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();const parts:Uint8Array[]=[];let length=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new Error('Request exceeds the upload limit.');}parts.push(value);}}finally{reader.releaseLock();}
 const result=new Uint8Array(length);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
