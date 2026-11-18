import {env} from 'cloudflare:workers';
import {getCurrentUser} from '../../current-user';
import {loadSharedCatalog,personalRecord} from '../../catalog-store';
import {boundedResearchBody,sameResearchOrigin,researchJson as json} from '../../research-store';
import {machineUnitsFor} from '../../workflow-token-store';
import type {MachineUnit} from '../../workflow-token-lib';
export async function GET(){try{const user=await getCurrentUser();if(!user)return json({error:'Sign in to view your physical-machine registry.'},401);return json({machines:await machineUnitsFor(user.userId)});}catch(e){console.error('Machine registry read failed',e);return json({error:'Your machine registry could not be loaded.'},503)}}
export async function POST(request:Request){try{
 const user=await getCurrentUser();if(!user)return json({error:'Sign in to register a physical machine.'},401);if(!sameResearchOrigin(request))return json({error:'Same-origin requests required.'},403);
 let input:any;try{input=JSON.parse(new TextDecoder().decode(await boundedResearchBody(request,6000)))}catch{return json({error:'Invalid machine registration.'},400)}
 if(typeof input.equipment_id!=='string'||typeof input.label!=='string'||!input.label.trim()||input.label.length>160||typeof input.registration_key!=='string'||!/^[0-9a-f-]{36}$/i.test(input.registration_key))return json({error:'Choose a model and enter a physical-unit label.'},400);
 const prior=await env.DB!.prepare('SELECT payload FROM machine_units WHERE owner_id=? AND registration_key=?').bind(user.userId,input.registration_key).first<{payload:string}>();if(prior){const machine=JSON.parse(prior.payload);if(machine.catalog_equipment_id!==input.equipment_id||machine.label!==input.label.trim())return json({error:'This registration request already belongs to a different machine. Open a new registration form.'},409);return json({machine});}
 if((await machineUnitsFor(user.userId)).length>=2000)return json({error:'Machine registry capacity reached.'},409);
 const base=(await loadSharedCatalog()).records.find(r=>r.equipment_id===input.equipment_id),edit=await env.DB!.prepare('SELECT payload FROM equipment_edits WHERE user_id=? AND equipment_id=?').bind(user.userId,input.equipment_id).first<{payload:string}>(),model=edit?personalRecord(base,JSON.parse(edit.payload)):base;if(!model)return json({error:'The equipment model was not found.'},400);
 const machine:MachineUnit={machine_token:'urn:uuid:'+crypto.randomUUID(),catalog_equipment_id:model.equipment_id,label:input.label.trim(),manufacturer:model.manufacturer,model_name:model.model_name,category_id:model.category_id,created_at:new Date().toISOString(),registration_status:'user_registered_physical_unit'};
 await env.DB!.prepare('INSERT OR IGNORE INTO machine_units(machine_token,owner_id,equipment_id,registration_key,payload,created_at) VALUES(?,?,?,?,?,?)').bind(machine.machine_token,user.userId,model.equipment_id,input.registration_key,JSON.stringify(machine),machine.created_at).run();
 const stored=await env.DB!.prepare('SELECT payload FROM machine_units WHERE owner_id=? AND registration_key=?').bind(user.userId,input.registration_key).first<{payload:string}>(),registered=JSON.parse(stored!.payload);if(registered.catalog_equipment_id!==input.equipment_id||registered.label!==input.label.trim())return json({error:'This registration request already belongs to another machine.'},409);return json({machine:registered},201);
}catch(e){console.error('Machine registration failed',e);return json({error:'The machine was not registered. Retry with the same registration form.'},503)}}
