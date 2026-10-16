import {safeUrl, validateManufacturerPrice, type Equipment, type Route} from './catalog-lib.ts';

export type JsonValue = null | boolean | number | string | JsonValue[] | {[key:string]:JsonValue};
export type Parameters = Record<string,JsonValue>;
export type PriceSnapshot = {kind:'msrp'|'manufacturer'|'estimate'|'unpriced';currency:string;low:number;high:number;source_url:string;checked_date:string;scope:string};
export type ProcessInstrument = {
 instance_id:string; equipment_id:string; category_id:string; category_refs:string[];
 equipment_snapshot:Equipment; quantity:number; configuration:Parameters; operating_parameters:Parameters;
 operation_sequence:string[]; signals:Parameters; inputs:Parameters; outputs:Parameters; extensions:Parameters;
 price_snapshot:PriceSnapshot;
};
export type ProcessSlot = {slot_id:string;label:string;allowed_category_ids:string[];instrument:ProcessInstrument|null;extensions:Parameters};
export type ProcessStep = {step_id:string;label:string;notes:string;source_step_order:string;source_sequence:string;slots:ProcessSlot[];extensions:Parameters};
export type ProcessWorkflow = {schema_version:1;workflow_id:string;route_id:string;route_name:string;name:string;notes:string;steps:ProcessStep[];extensions:Parameters};
export type SavedWorkflow = {workflow:ProcessWorkflow;revision:number;created_at:string;updated_at:string};
export const splitIds=(value:string|undefined)=>[...new Set((value||'').split(';').map(s=>s.trim()).filter(Boolean))];
export const newProcessId=(prefix:string)=>prefix+'-'+crypto.randomUUID();
export function newSlot(allowed:string[]=[],label='Instrument slot'):ProcessSlot{return {slot_id:newProcessId('SLOT'),label,allowed_category_ids:[...allowed],instrument:null,extensions:{}};}
export function newStep(allowed:string[]=[]):ProcessStep{return {step_id:newProcessId('STEP'),label:'New step',notes:'',source_step_order:'',source_sequence:'',slots:[newSlot(allowed)],extensions:{}};}
export function createWorkflow(route:Route,sourceSteps:Record<string,string>[]):ProcessWorkflow{
 const steps=sourceSteps.filter(s=>s.route_id===route.route_id).sort((a,b)=>Number(a.step_order)-Number(b.step_order)).map(s=>({
  ...newStep(),label:s.step_label,source_step_order:s.step_order,source_sequence:s.equipment_sequence,
  slots:splitIds(s.equipment_category_ids).length?[newSlot(splitIds(s.equipment_category_ids))]:[],
 }));
 return {schema_version:1,workflow_id:'',route_id:route.route_id,route_name:route.route_name,name:route.route_name+' — equipment plan',notes:'',steps:steps.length?steps:[newStep(splitIds(route.equipment_category_ids))],extensions:{}};
}
export function priceSnapshot(r:Equipment):PriceSnapshot{
 const number=(s:string)=>s?.trim()!==''&&Number.isFinite(Number(s))&&Number(s)>=0?Number(s):null;
 const exact=number(r.msrp_value),published=number(r.manufacturer_price_value),low=number(r.estimated_msrp_low),high=number(r.estimated_msrp_high);
 if(exact!==null&&/^[A-Z]{3}$/.test(r.msrp_currency))return {kind:'msrp',currency:r.msrp_currency,low:exact,high:exact,source_url:safeUrl(r.price_source_url),checked_date:r.price_checked_date||'',scope:'Recorded model MSRP'};
 if(published!==null&&!validateManufacturerPrice(r))return {kind:'manufacturer',currency:r.manufacturer_price_currency,low:published,high:published,source_url:safeUrl(r.manufacturer_price_source_url),checked_date:r.manufacturer_price_checked_date,scope:r.manufacturer_price_kind+': '+r.manufacturer_price_scope};
 if(low!==null&&high!==null&&high>=low&&/^[A-Z]{3}$/.test(r.estimate_currency))return {kind:'estimate',currency:r.estimate_currency,low,high,source_url:safeUrl(r.estimate_source_url),checked_date:r.estimate_checked_date||'',scope:r.estimate_subject||r.category_name};
 return {kind:'unpriced',currency:'',low:0,high:0,source_url:'',checked_date:'',scope:'Price not recorded'};
}
export function instrumentFor(r:Equipment):ProcessInstrument{return {
 instance_id:newProcessId(r.category_id),equipment_id:r.equipment_id,category_id:r.category_id,
 category_refs:[...new Set([r.category_id,...splitIds(r.legacy_category_ids)])],equipment_snapshot:{...r},quantity:1,
 configuration:{},operating_parameters:{},operation_sequence:[],signals:{},inputs:{},outputs:{},extensions:{},price_snapshot:priceSnapshot(r),
};}
export function slotAccepts(slot:ProcessSlot,r:Equipment){return !slot.allowed_category_ids.length||slot.allowed_category_ids.some(id=>[r.category_id,...splitIds(r.legacy_category_ids)].includes(id));}
export function routeCandidates(records:Equipment[],route:Route,slot:ProcessSlot|null){
 return records.filter(r=>slot?slotAccepts(slot,r):splitIds(route.equipment_category_ids).includes(r.category_id)||splitIds(r.related_process_ids).includes(route.route_id));
}
export function assignInstrument(workflow:ProcessWorkflow,slotId:string,r:Equipment):ProcessWorkflow{
 const slot=workflow.steps.flatMap(s=>s.slots).find(s=>s.slot_id===slotId);
 if(!slot||!slotAccepts(slot,r))throw new Error('This model does not match the slot’s equipment classes. Choose a matching model or edit the slot classes.');
 return {...workflow,steps:workflow.steps.map(s=>({...s,slots:s.slots.map(slot=>slot.slot_id===slotId?{...slot,instrument:instrumentFor(r)}:slot)}))};
}
export function moveInstrument(workflow:ProcessWorkflow,fromId:string,toId:string):ProcessWorkflow{
 if(fromId===toId)return workflow;
 const slots=workflow.steps.flatMap(s=>s.slots),from=slots.find(s=>s.slot_id===fromId),to=slots.find(s=>s.slot_id===toId);
 if(!from?.instrument||!to)throw new Error('Choose an assigned instrument and a destination slot.');
 if(!slotAccepts(to,from.instrument.equipment_snapshot))throw new Error('The destination slot does not accept this equipment class.');
 const instrument=from.instrument;
 return {...workflow,steps:workflow.steps.map(s=>({...s,slots:s.slots.map(slot=>slot.slot_id===fromId?{...slot,instrument:null}:slot.slot_id===toId?{...slot,instrument}:slot)}))};
}
export function clearWorkflowEquipment(workflow:ProcessWorkflow):ProcessWorkflow{
 return {...workflow,steps:workflow.steps.map(step=>({...step,slots:step.slots.map(slot=>({...slot,instrument:null}))}))};
}
export function processPhotoSources(record:Equipment,currentRecords:Equipment[]=[]):Equipment[]{
 const identity=(value:string)=>(value||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
 const current=currentRecords.filter(r=>r.equipment_id===record.equipment_id&&identity(r.model_name)===identity(record.model_name)&&identity(r.manufacturer)===identity(record.manufacturer));
 const seen=new Set<string>();
 return [record,...current].filter(r=>{const url=safeUrl(r.image_url);if(!url||seen.has(url))return false;seen.add(url);return true;});
}
export function workflowBudget(steps:ProcessStep[]){
 const totals=new Map<string,{currency:string;low:number;high:number;estimated:boolean;manufacturer:boolean;quantity:number}>();let missing=0,assigned=0;
 for(const i of steps.flatMap(s=>s.slots).flatMap(s=>s.instrument?[s.instrument]:[])){
  assigned+=i.quantity;const p=i.price_snapshot;if(p.kind==='unpriced'){missing+=i.quantity;continue;}
  const t=totals.get(p.currency)||{currency:p.currency,low:0,high:0,estimated:false,manufacturer:false,quantity:0};
  t.low+=p.low*i.quantity;t.high+=p.high*i.quantity;t.quantity+=i.quantity;t.estimated||=p.kind==='estimate';t.manufacturer||=p.kind==='manufacturer';totals.set(p.currency,t);
 }
 return {totals:[...totals.values()].sort((a,b)=>a.currency.localeCompare(b.currency)),missing,assigned};
}
export function money(value:number,currency='USD'){try{return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:0}).format(value)}catch{return currency+' '+value.toLocaleString()}}
export function budgetLabel(budget:ReturnType<typeof workflowBudget>){
 if(!budget.assigned)return '$0';if(!budget.totals.length)return 'Price not recorded';
 return budget.totals.map(t=>money(t.low,t.currency)+(t.high!==t.low?'–'+money(t.high,t.currency):'')+(t.estimated?'*':'')).join(' + ');
}

const uuid='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const isObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function jsonObject(value:unknown,label:string):asserts value is Parameters{
 if(!isObject(value))throw new Error(label+' must be an object.');
 let count=0;function visit(v:unknown,depth:number){if(++count>4000||depth>12)throw new Error(label+' is too complex.');if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;if(Array.isArray(v)){for(const x of v)visit(x,depth+1);return;}if(isObject(v)){for(const [k,x] of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw new Error('Unsupported property name.');visit(x,depth+1);}return;}throw new Error(label+' contains invalid data.');}visit(value,0);
}
export function validateWorkflow(input:unknown,routes:Route[],records:Equipment[],existing?:ProcessWorkflow):ProcessWorkflow{
 if(!isObject(input)||input.schema_version!==1)throw new Error('Unsupported workflow format.');
 const w=structuredClone(input) as unknown as ProcessWorkflow;
 const text=(v:unknown,max:number,label:string,required=false)=>{if(typeof v!=='string'||v.length>max||required&&!v.trim())throw new Error('Invalid '+label+'.');};
 text(w.name,200,'workflow name',true);text(w.notes,12000,'workflow notes');text(w.workflow_id,100,'workflow ID');
 const route=routes.find(r=>r.route_kind==='manufacturing_process'&&r.route_id===w.route_id);if(!route)throw new Error('Select a valid process.');
 if(existing&&(w.workflow_id!==existing.workflow_id||w.route_id!==existing.route_id))throw new Error('A saved workflow keeps its original process and ID. Start a new workflow to change process.');
 w.route_name=route.route_name;jsonObject(w.extensions,'Workflow extensions');
 if(!Array.isArray(w.steps)||!w.steps.length||w.steps.length>100)throw new Error('Use between 1 and 100 steps.');
 const ids=new Set<string>(),known=new Map(records.map(r=>[r.equipment_id,r]));let slotCount=0;
 const oldInstruments=new Map(existing?.steps.flatMap(s=>s.slots).flatMap(s=>s.instrument?[s.instrument]:[]).map(i=>[i.instance_id,i])||[]);
 function id(value:unknown,prefix:string){if(typeof value!=='string'||!new RegExp('^'+prefix+'-'+uuid+'$','i').test(value)||ids.has(value))throw new Error('Workflow component IDs must be unique system IDs.');ids.add(value);}
 for(const step of w.steps){
  if(!isObject(step))throw new Error('Invalid step.');id(step.step_id,'STEP');text(step.label,200,'step name',true);text(step.notes,12000,'step notes');text(step.source_sequence,12000,'source sequence');text(step.source_step_order,30,'source step');jsonObject(step.extensions,'Step extensions');
  if(!Array.isArray(step.slots)||step.slots.length>50||(slotCount+=step.slots.length)>250)throw new Error('Use at most 50 slots per step and 250 per workflow.');
  for(const slot of step.slots){
   if(!isObject(slot))throw new Error('Invalid slot.');id(slot.slot_id,'SLOT');text(slot.label,200,'slot label',true);jsonObject(slot.extensions,'Slot extensions');
   if(!Array.isArray(slot.allowed_category_ids)||slot.allowed_category_ids.length>100||slot.allowed_category_ids.some(c=>typeof c!=='string'||!/^M\d{2,3}$|^X-[A-Z0-9-]+$/.test(c)))throw new Error('Invalid slot classes.');
   if(slot.instrument===null)continue;const i=slot.instrument;if(!isObject(i))throw new Error('Invalid instrument assignment.');
   const old=oldInstruments.get(i.instance_id);const r=old?.equipment_snapshot||known.get(i.equipment_id);if(!r)throw new Error('This equipment is no longer in your ontology. Re-select a model.');
   id(i.instance_id,r.category_id);if(old&&old.equipment_id!==i.equipment_id)throw new Error('An instrument instance cannot change model. Replace the instrument to create a new instance.');
   if(!slotAccepts(slot,r))throw new Error('An assigned instrument does not match its slot classes.');
   if(!Number.isSafeInteger(i.quantity)||i.quantity<1||i.quantity>1000)throw new Error('Equipment quantity must be a whole number between 1 and 1000.');
   for(const key of ['configuration','operating_parameters','signals','inputs','outputs','extensions'] as const)jsonObject(i[key],key);
   if(!Array.isArray(i.operation_sequence)||i.operation_sequence.length>200||i.operation_sequence.some(v=>typeof v!=='string'||v.length>6000))throw new Error('Invalid operation sequence.');
   // Identity, ontology evidence and prices are server-owned snapshots; custom configuration stays separate.
   const identity=old||instrumentFor(r);i.equipment_id=identity.equipment_id;i.category_id=identity.category_id;i.category_refs=identity.category_refs;i.equipment_snapshot=identity.equipment_snapshot;i.price_snapshot=identity.price_snapshot;
  }
 }
 return w;
}
