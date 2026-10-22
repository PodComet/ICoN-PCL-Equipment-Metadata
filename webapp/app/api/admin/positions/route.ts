import {env} from 'cloudflare:workers';
import {getCurrentUser} from '../../../current-user';
import {isCatalogAdmin} from '../../../admin-policy';
import {loadPositionLibrary} from '../../../position-store';
import {loadSharedCatalog} from '../../../catalog-store';
import {buildPositionPlan} from '../../../position-csv';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){const user=await getCurrentUser();if(!await isCatalogAdmin(user))return json({error:'Unlock administration first.'},user?403:401);try{return json(await loadPositionLibrary());}catch{return json({error:'Position profiles could not be loaded.'},500);}}
export async function POST(request:Request){
 try{
  const user=await getCurrentUser();if(!await isCatalogAdmin(user))return json({error:'Unlock administration first.'},user?403:401);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Same-origin requests required.'},403);
  if(Number(request.headers.get('content-length')||0)>3_100_000)return json({error:'Use a file under 3 MB.'},413);
  const text=await request.text();if(text.length>3_100_000)return json({error:'Use a file under 3 MB.'},413);
  let input:{csv?:string;mode?:string;expected_revision?:number;filename?:string};try{input=JSON.parse(text)}catch{return json({error:'Invalid request.'},400);}
  if(!input||typeof input.csv!=='string'||!['preview','apply'].includes(input.mode||''))return json({error:'Choose a CSV and preview it first.'},400);
  const snapshot=await loadPositionLibrary(),catalog=await loadSharedCatalog(),plan=buildPositionPlan(input.csv,catalog.records,snapshot.library);
  if(input.mode==='preview')return json({plan,revision:snapshot.revision});
  if(!Number.isSafeInteger(input.expected_revision)||input.expected_revision!==snapshot.revision)return json({error:'Position data changed. Preview the file again.'},409);
  if(plan.errors.length||!plan.changes.length)return json({error:'Resolve validation errors before applying.',plan},400);
  const now=new Date().toISOString(),revision=snapshot.revision+1;
  const statements=[env.DB!.prepare("INSERT INTO catalog_meta(id,revision) VALUES('positions',1) ON CONFLICT(id) DO UPDATE SET revision=CASE WHEN revision=? THEN revision+1 ELSE NULL END").bind(snapshot.revision)];
  for(const change of plan.changes)statements.push(env.DB!.prepare('INSERT INTO position_profile_edits(equipment_id,payload,revision,updated_at) VALUES(?,?,?,?) ON CONFLICT(equipment_id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision,updated_at=excluded.updated_at').bind(change.equipment_id,JSON.stringify({after:change.after,evidence:change.evidence}),revision,now));
  statements.push(env.DB!.prepare('INSERT INTO position_imports(id,user_id,filename,revision,changes_json,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),user!.userId,String(input.filename||'positions.csv').slice(0,200),revision,JSON.stringify(plan.changes),now));
  try{await env.DB!.batch(statements)}catch{const latest=await loadPositionLibrary();if(latest.revision!==snapshot.revision)return json({error:'Another administrator changed positions. Preview again; this batch was not applied.'},409);throw new Error('Position import failed');}
  return json({revision,changedCount:plan.changes.length});
 }catch{console.error('Position import failed');return json({error:'Position profiles could not be saved.'},500);}
}
