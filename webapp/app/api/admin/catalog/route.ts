import {env} from "cloudflare:workers";
import seed from "../../../data/catalog.json";
import {getChatGPTUser} from "../../../chatgpt-auth";
import {isCatalogAdmin} from "../../../admin-policy";
import {loadSharedCatalog} from "../../../catalog-store";
import {buildPlan} from "../../../csv-updates";

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(){
 try{
  const user=await getChatGPTUser();if(!isCatalogAdmin(user))return json({error:"Sign in to access CSV administration."},401);
  const catalog=await loadSharedCatalog();
  const history=await env.DB!.prepare("SELECT id,filename,revision,changed_count,created_at FROM catalog_imports ORDER BY revision DESC LIMIT 20").all();
  return json({...catalog,history:history.results,categories:seed.categories,routes:seed.routes,adminPolicy:"all_signed_in_users"});
 }catch(e){console.error("Admin catalog read failed",e);return json({error:"Shared catalog could not be loaded."},500)}
}
export async function POST(request:Request){
 try{
  const user=await getChatGPTUser();if(!isCatalogAdmin(user))return json({error:"Sign in to access CSV administration."},401);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:"Same-origin requests required."},403);
  if(Number(request.headers.get('content-length')||0)>3_100_000)return json({error:"CSV request exceeds 3 MB."},413);
  const text=await request.text();if(text.length>3_100_000)return json({error:"CSV request exceeds 3 MB."},413);
  let input:any;try{input=JSON.parse(text)}catch{return json({error:"Invalid import request."},400)}
  if(typeof input.csv!=='string'||!['preview','apply'].includes(input.mode))return json({error:"Choose a CSV file and preview it first."},400);
  const catalog=await loadSharedCatalog();
  if(input.mode==='apply'&&(!Number.isSafeInteger(input.expected_revision)||input.expected_revision!==catalog.revision))return json({error:"The shared catalog changed since preview. Preview this CSV again."},409);
  const plan=buildPlan(input.csv,catalog.records,seed.categories,seed.routes,seed.manufacturers,seed.category_aliases);
  if(input.mode==='preview')return json({plan,revision:catalog.revision});
  if(plan.errors.length)return json({error:"Resolve CSV validation errors before applying.",plan},400);
  if(!plan.changes.length)return json({error:"No changes to apply."},400);
  const id=crypto.randomUUID(),now=new Date().toISOString(),revision=catalog.revision+1;
  const statements=[env.DB!.prepare("INSERT INTO catalog_meta(id,revision) VALUES('shared',1) ON CONFLICT(id) DO UPDATE SET revision=CASE WHEN catalog_meta.revision=? THEN catalog_meta.revision+1 ELSE NULL END").bind(catalog.revision)];
  statements.push(env.DB!.prepare("INSERT INTO catalog_shared(equipment_id,payload,revision,updated_at) SELECT json_extract(value,'$.equipment_id'),json_extract(value,'$.payload'),?,? FROM json_each(?) WHERE true ON CONFLICT(equipment_id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision,updated_at=excluded.updated_at").bind(revision,now,JSON.stringify(plan.changes.map(change=>({equipment_id:change.equipment_id,payload:JSON.stringify(change.after)})))));
  statements.push(env.DB!.prepare("INSERT INTO catalog_imports(id,user_id,filename,revision,changed_count,changes_json,created_at) VALUES(?,?,?,?,?,?,?)").bind(id,user!.userId,String(input.filename||'updates.csv').slice(0,200),revision,plan.changes.length,JSON.stringify(plan.changes),now));
  try{await env.DB!.batch(statements)}catch(e){
   // The non-null revision guard aborts and rolls back the complete batch on conflict.
   const latest=await loadSharedCatalog();if(latest.revision!==catalog.revision)return json({error:"Another admin applied changes. Preview this CSV again; none of this batch was applied."},409);
   throw e;
  }
  return json({success:true,importId:id,revision,changedCount:plan.changes.length});
 }catch(e){console.error("CSV import failed",e);return json({error:"The import could not be applied. No partial batch is accepted; retry the preview."},500)}
}
