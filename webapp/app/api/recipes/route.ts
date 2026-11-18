import {env} from 'cloudflare:workers';
import {getCurrentUser} from '../../current-user';
import {recipeForVersion,frozenRecipe} from '../../workflow-token-store';
import {researchRow,canReadResearch,researchJson as json} from '../../research-store';
import {readRunLinks} from '../../workflow-token-lib';
export async function GET(request:Request){try{
 const user=await getCurrentUser();if(!user)return json({error:'Sign in to retrieve saved recipes.'},401);
 const p=new URL(request.url).searchParams;let owner=user.userId,recipe=null,workflow:any=null;
 if(p.get('run_id')){const row=await researchRow(p.get('run_id')!);if(!row||!await canReadResearch(row,user))return json({error:'Experiment was not found or shared.'},404);owner=row.owner_id;const links=readRunLinks(JSON.parse(row.payload));if(links?.recipe_token)recipe=await frozenRecipe(owner,links.recipe_token);}
 else if(p.get('workflow_id')){const id=p.get('workflow_id')!,requested=p.get('revision');const row=await env.DB!.prepare('SELECT revision FROM process_workflows WHERE workflow_id=? AND user_id=?').bind(id,owner).first<{revision:number}>();if(!row)return json({error:'Saved workflow was not found in your account.'},404);if(requested&&!/^[1-9]\d*$/.test(requested))return json({error:'Invalid revision.'},400);const result=await recipeForVersion(owner,id,requested?Number(requested):row.revision);recipe=result.recipe;workflow=result.workflow;}
 else if(p.get('token'))recipe=await frozenRecipe(owner,p.get('token')!);
 if(!recipe)return json({error:'The frozen recipe was not found.'},404);
 if(p.get('download')==='1')return new Response(recipe.manifest_text,{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="recipe-'+recipe.recipe_token.slice(7,19)+'.json"','Cache-Control':'no-store','X-Recipe-Token':recipe.recipe_token,'X-Content-Type-Options':'nosniff'}});
 return json({...recipe,workflow_id:workflow?.workflow_id||'',suggested_materials:workflow?.extensions?.material_plan?.inputs||[],geometry:workflow?.extensions?.recipe_geometry||null,suggested_machine_bindings:workflow?workflow.steps.flatMap((s:any)=>s.slots).filter((s:any)=>s.instrument?.extensions?.machine_token).map((s:any)=>({slot_id:s.slot_id,machine_token:s.instrument.extensions.machine_token})):[]});
}catch(e){console.error('Recipe read failed',e);return json({error:'The immutable recipe could not be loaded.'},503)}}
