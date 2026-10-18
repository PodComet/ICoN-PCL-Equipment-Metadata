import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../../../chatgpt-auth';
import {canReadResearch,researchFailure,researchJson as json,researchRow} from '../../../research-store';
export async function GET(request:Request){try{
 const user=await getChatGPTUser();if(!user)return json({error:'Sign in to retrieve research files.'},401);
 const id=new URL(request.url).searchParams.get('id');const file=await env.DB!.prepare('SELECT record_id,object_key,filename,sha256,media_type FROM research_files WHERE file_id=?').bind(id||'').first<{record_id:string;object_key:string;filename:string;sha256:string;media_type:string}>();
 const row=file?await researchRow(file.record_id):null;if(!row||!await canReadResearch(row,user))return json({error:'File not found or not shared.'},404);
 if(JSON.parse(row.payload).status==='withdrawn')return json({error:'Source data were withdrawn. Authorized metadata and history remain available.'},410);
 const object=await env.BUCKET?.get(file!.object_key);if(!object)return json({error:'Source bytes are unavailable. The file manifest remains accessible.'},410);
 return new Response(object.body,{headers:{'Content-Type':file!.media_type,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file!.filename),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'X-Checksum-Sha256':file!.sha256}});
}catch(e){return researchFailure(e)}}
