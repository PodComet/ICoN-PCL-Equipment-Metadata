import {env} from 'cloudflare:workers';
import {getCurrentUser} from '../../../current-user';
import {normalizedGrantEmail} from '../../../research-access-lib';
import {researchFailure,researchJson as json,researchRow,sameResearchOrigin} from '../../../research-store';
export async function GET(request:Request){try{
 const user=await getCurrentUser();if(!user)return json({error:'Sign in required.'},401);const space=await researchRow(new URL(request.url).searchParams.get('space_id')||'');
 if(!space||space.kind!=='space'||space.owner_id!==user.userId)return json({error:'Owned Space not found.'},404);
 return json({grants:(await env.DB!.prepare('SELECT email,role,created_at FROM research_grants WHERE space_id=? ORDER BY email').bind(space.record_id).all()).results});
}catch(e){return researchFailure(e)}}
export async function PUT(request:Request){try{
 const user=await getCurrentUser();if(!user)return json({error:'Sign in required.'},401);if(!sameResearchOrigin(request))return json({error:'Same-origin requests required.'},403);
 const raw=await request.text();if(raw.length>1000)return json({error:'Grant request too large.'},413);let input;let email;try{input=JSON.parse(raw);email=normalizedGrantEmail(input.email);if(typeof input.remove!=='boolean')throw new Error('Specify grant or revoke.');}catch(e){return json({error:e instanceof Error?e.message:'Invalid grant.'},400)}
 const space=await researchRow(input.space_id||'');if(!space||space.kind!=='space'||space.owner_id!==user.userId)return json({error:'Owned Space not found.'},404);
 if(input.remove)await env.DB!.prepare('DELETE FROM research_grants WHERE space_id=? AND email=?').bind(space.record_id,email).run();else {const count=await env.DB!.prepare('SELECT COUNT(*) AS n FROM research_grants WHERE space_id=?').bind(space.record_id).first<{n:number}>();if((count?.n||0)>=50)return json({error:'A Space supports up to 50 explicit viewers.'},409);await env.DB!.prepare('INSERT INTO research_grants(space_id,email,role,created_at) VALUES(?,?,\'viewer\',?) ON CONFLICT(space_id,email) DO NOTHING').bind(space.record_id,email,new Date().toISOString()).run();}
 return json({ok:true});
}catch(e){return researchFailure(e)}}
