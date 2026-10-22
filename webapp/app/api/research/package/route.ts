import {env} from 'cloudflare:workers';
import {getCurrentUser} from '../../../current-user';
import {canReadResearch,researchFailure,researchJson as json,researchRow,researchRows,savedResearch} from '../../../research-store';
import {crateFilePath,researchCrate,dataCiteDraft,researchExport} from '../../../research-export-lib';
import {researchZip} from '../../../research-zip-lib';
import {digestBytes} from '../../../instrument-ingest-lib';
export async function GET(request:Request){try{
 const user=await getCurrentUser();if(!user)return json({error:'Sign in to export research packages.'},401);const row=await researchRow(new URL(request.url).searchParams.get('id')||'');
 if(!row||!await canReadResearch(row,user))return json({error:'Record not found or not shared.'},404);
 const saved=savedResearch(row,user);if(saved.record.status==='withdrawn'&&saved.record.files.length)return json({error:'Data were withdrawn. Download the metadata-only export instead.'},410);
 const all=(await researchRows(user)).map(r=>savedResearch(r,user)),origin=new URL(request.url).origin,encode=(x:unknown)=>new TextEncoder().encode(JSON.stringify(x,null,2));
 const entries=[{name:'ro-crate-metadata.json',bytes:encode(researchCrate(saved,all,origin,true))},{name:'research-record.json',bytes:encode(researchExport(saved,all,origin))},{name:'datacite-draft.json',bytes:encode(dataCiteDraft(saved))}];
 for(const file of saved.record.files){const source=await env.DB!.prepare('SELECT object_key FROM research_files WHERE file_id=? AND record_id=?').bind(file.file_id,row.record_id).first<{object_key:string}>();const object=source?await env.BUCKET?.get(source.object_key):null;if(!object)return json({error:'Source file missing; package was not created. Metadata can still be exported.'},410);const bytes=new Uint8Array(await object.arrayBuffer());if(await digestBytes(bytes)!==file.sha256)return json({error:'Source checksum did not match; package was not created.'},409);entries.push({name:crateFilePath(file),bytes});}
 const zip=researchZip(entries);return new Response(zip as BodyInit,{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${saved.record.code}-r${saved.revision}-ro-crate.zip"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return researchFailure(e)}}
