import {SEQUENCE_KEY,validateControlSequence} from './control-sequence-lib.ts';
import {usdPrice} from './currency-lib.ts';
import {sellerPrice} from './seller-prices.ts';
import {safeUrl, validateManufacturerPrice, type Equipment, type Route} from './catalog-lib.ts';
import {processDependencyGraph} from './process-dependencies.ts';
import {validateMaterialPlan} from './process-materials-lib.ts';

export type JsonValue = null | boolean | number | string | JsonValue[] | {[key:string]:JsonValue};
export type Parameters = Record<string,JsonValue>;
export type PriceSnapshot = {kind:'msrp'|'manufacturer'|'seller'|'estimate'|'unpriced';currency:string;low:number;high:number;source_url:string;checked_date:string;scope:string};
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
export type StepRequirements={required_branches:string[][];optional_category_ids:string[];optional_branches?:string[][];allowed_subtypes_by_category?:Record<string,string[]>;unresolved_required_equipment:boolean;readiness_review_required:boolean;notes:string};
export function stepRequirements(source:Record<string,string>):StepRequirements|null{
 try{const r=JSON.parse(source.requirements_json||'null');if(!r||!Array.isArray(r.required_branches)||!r.required_branches.every((b:unknown)=>Array.isArray(b)&&b.every(c=>typeof c==='string'))||!Array.isArray(r.optional_category_ids))return null;return r;}catch{return null;}
}
export function requirementSlots(requirements:StepRequirements):ProcessSlot[]{
 const counts=new Map<string,number>();
 for(const branch of requirements.required_branches){const n=new Map<string,number>();for(const c of branch)n.set(c,(n.get(c)||0)+1);for(const [c,v] of n)counts.set(c,Math.max(counts.get(c)||0,v));}
 for(const c of requirements.optional_category_ids)if(!counts.has(c))counts.set(c,1);
 const slots:ProcessSlot[]=[...counts].flatMap(([cid,n])=>Array.from({length:n},(_,i)=>({...newSlot([cid],cid+(n>1?' · unit '+(i+1):'')),extensions:{requirement_role:requirements.optional_category_ids.includes(cid)?'optional':requirements.required_branches.every(b=>b.filter(c=>c===cid).length>i)?'required':'alternative'}})));
 if(requirements.unresolved_required_equipment)slots.push({...newSlot([],'Unclassified required apparatus'),extensions:{requirement_role:'unclassified'}});
 for(const slot of slots){const subtypes=requirements.allowed_subtypes_by_category?.[slot.allowed_category_ids[0]];if(subtypes)slot.extensions.allowed_equipment_subtypes=[...subtypes];}
 return slots;
}
export function createWorkflow(route:Route,sourceSteps:Record<string,string>[]):ProcessWorkflow{
 const steps=sourceSteps.filter(s=>s.route_id===route.route_id).sort((a,b)=>Number(a.step_order)-Number(b.step_order)).map<ProcessStep>(s=>({
  ...newStep(),label:s.step_label,source_step_order:s.step_order,source_sequence:s.equipment_sequence,
  slots:stepRequirements(s)?requirementSlots(stepRequirements(s)!):splitIds(s.equipment_category_ids).length?[newSlot(splitIds(s.equipment_category_ids))]:[],
  extensions:(stepRequirements(s)?{requirements:stepRequirements(s)! as unknown as JsonValue}:{}) as Parameters,
 }));
 return {schema_version:1,workflow_id:'',route_id:route.route_id,route_name:route.route_name,name:route.route_name+' — equipment plan',notes:'',steps:steps.length?steps:[newStep(splitIds(route.equipment_category_ids))],extensions:steps.length?{}:{sequence_review_required:true}};
}
export function expandWorkflowRequirements(workflow:ProcessWorkflow,sourceSteps:Record<string,string>[]):ProcessWorkflow{
 return {...workflow,steps:workflow.steps.map(step=>{
  const source=sourceSteps.find(s=>s.route_id===workflow.route_id&&s.step_order===step.source_step_order),req=source?stepRequirements(source):null;
  if(!req)return step;
  const remaining=[...step.slots];
  const slots=requirementSlots(req).map(wanted=>{
   const cid=wanted.allowed_category_ids[0];
   let index=remaining.findIndex(old=>cid?old.instrument?.category_refs.includes(cid):old.extensions.requirement_role==='unclassified');
   if(index<0)index=remaining.findIndex(old=>!old.instrument&&(cid?old.allowed_category_ids.includes(cid):old.extensions.requirement_role==='unclassified'));
   if(index<0)return wanted;
   const old=remaining.splice(index,1)[0];return {...old,allowed_category_ids:cid?wanted.allowed_category_ids:old.allowed_category_ids,label:old.label==='Instrument slot'?wanted.label:old.label,extensions:{...old.extensions,...wanted.extensions}};
  });
  // Retire only untouched, empty system placeholders once their required M classes are curated.
  const kept=remaining.filter(old=>req.unresolved_required_equipment||old.instrument||old.allowed_category_ids.length||old.label!=='Unclassified required apparatus'||old.extensions.requirement_role!=='unclassified'||Object.keys(old.extensions).some(k=>k!=='requirement_role'));
  const requirementsChanged=JSON.stringify(step.extensions.requirements)!==JSON.stringify(req);
  return {...step,slots:[...slots,...kept],extensions:{...step.extensions,requirements:req as unknown as JsonValue,...(requirementsChanged&&step.extensions.requirements_reviewed===true?{requirements_reviewed:false}:{})}};
 })};
}
export function workflowReadiness(workflow:ProcessWorkflow,sourceSteps:Record<string,string>[]=[]){
 const expected=sourceSteps.filter(s=>s.route_id===workflow.route_id),orders=workflow.steps.map(s=>s.source_step_order).filter(Boolean);
 const missingSteps=expected.filter(s=>!orders.includes(s.step_order)).length;
 const dependencyIssues=processDependencyGraph(workflow).errors;
 const wrongOrder=workflow.extensions.dependency_schema!=='process-dependencies/v1'&&orders.some((o,i)=>i>0&&Number(o)<=Number(orders[i-1]));
 const reviewItems:{step_id:string;label:string;notes:string}[]=[];
 if(workflow.extensions.sequence_review_required===true&&workflow.extensions.sequence_reviewed!==true)reviewItems.push({step_id:'',label:'Process sequence',notes:'This capability-only sequence needs review for the intended process and operating configuration.'});
 let readySteps=0,unresolved=0,invalidAssignments=0,missingSlots=0;
 for(const step of workflow.steps){
  const pending=Array.isArray(step.extensions.unclassified_equipment_slots)?step.extensions.unclassified_equipment_slots.length:0;
  if(pending)unresolved+=pending;
  const source=expected.find(s=>s.step_order===step.source_step_order);
  const req=source?stepRequirements(source):null;
  const assigned=step.slots.filter(s=>s.instrument&&slotAccepts(s,s.instrument.equipment_snapshot));
  invalidAssignments+=step.slots.filter(s=>s.instrument&&!slotAccepts(s,s.instrument.equipment_snapshot)).length;
  const matches=(branch:string[])=>{const used=new Set<string>();return branch.every(cid=>{const s=assigned.find(s=>!used.has(unitId(s.instrument!))&&s.instrument!.category_refs.includes(cid));if(!s)return false;used.add(unitId(s.instrument!));return true;});};
  const extra=step.slots.filter(s=>s.extensions.requirement_role===undefined);
  const absentExtra=extra.filter(s=>!s.instrument).length;
  if(req){
   if(req.readiness_review_required&&step.extensions.requirements_reviewed!==true)reviewItems.push({step_id:step.step_id,label:step.label,notes:req.notes});
   const unknown=req.unresolved_required_equipment&&!assigned.some(s=>s.extensions.requirement_role==='unclassified'&&s.allowed_category_ids.length);
   if(unknown)unresolved++;
   const optionalComplete=(req.optional_branches||[]).filter(b=>b.some(cid=>assigned.some(s=>s.instrument!.category_refs.includes(cid)))).every(matches);
   const covered=(!req.required_branches.length||req.required_branches.some(matches))&&optionalComplete;
   if(covered&&!unknown&&!absentExtra&&!pending)readySteps++;else missingSlots+=Math.max(1,absentExtra);
  }else{
   if(step.source_step_order&&expected.length)reviewItems.push({step_id:step.step_id,label:step.label,notes:'Review this source stage: structured branch and configuration requirements are not available.'});
   const empty=step.slots.filter(s=>!s.instrument).length;missingSlots+=empty;
   if(!empty&&step.slots.length&&!pending)readySteps++;else if(!step.slots.length)unresolved++;
  }
 }
 // Completion means declared equipment coverage in order. Configuration review is a separate advisory, not a hidden completion gate.
 const complete=workflow.steps.length>0&&readySteps===workflow.steps.length&&!missingSteps&&!wrongOrder&&!dependencyIssues.length&&!unresolved&&!invalidAssignments;
 return {complete,readySteps,totalSteps:workflow.steps.length,missingSlots,missingSteps,wrongOrder,dependencyIssues,unresolved,invalidAssignments,review:reviewItems.length,reviewItems};
}
export function workflowReadinessMessage(r:ReturnType<typeof workflowReadiness>):string{
 if(r.complete)return 'Equipment plan complete · expected output shown';
 if(r.wrongOrder)return 'Restore the source step order';
 if(r.dependencyIssues.length)return r.dependencyIssues[0];
 if(r.missingSteps)return r.missingSteps+' source '+(r.missingSteps===1?'step missing':'steps missing');
 if(r.unresolved)return r.unresolved+' apparatus '+(r.unresolved===1?'requirement needs':'requirements need')+' an equipment class and instrument';
 if(r.invalidAssignments)return 'Replace instruments that do not match their slot class or operation';
 return r.readySteps+' of '+r.totalSteps+' stages covered · complete a required equipment branch in each stage';
}
export function priceSnapshot(r:Equipment):PriceSnapshot{return usdPrice(sourcePriceSnapshot(r)) as PriceSnapshot;}
function sourcePriceSnapshot(r:Equipment):PriceSnapshot{
 const number=(s:string)=>s?.trim()!==''&&Number.isFinite(Number(s))&&Number(s)>=0?Number(s):null;
 const exact=number(r.msrp_value),published=number(r.manufacturer_price_value),low=number(r.estimated_msrp_low),high=number(r.estimated_msrp_high);
 if(exact!==null&&/^[A-Z]{3}$/.test(r.msrp_currency))return {kind:'msrp',currency:r.msrp_currency,low:exact,high:exact,source_url:safeUrl(r.price_source_url),checked_date:r.price_checked_date||'',scope:'Recorded model MSRP'};
 if(published!==null&&!validateManufacturerPrice(r))return {kind:'manufacturer',currency:r.manufacturer_price_currency,low:published,high:published,source_url:safeUrl(r.manufacturer_price_source_url),checked_date:r.manufacturer_price_checked_date,scope:r.manufacturer_price_kind+': '+r.manufacturer_price_scope};
 const seller=sellerPrice(r);
 if(seller)return {kind:'seller',currency:seller.currency,low:Number(seller.price_value),high:Number(seller.price_value),source_url:seller.source_url,checked_date:seller.checked_date,scope:seller.seller_name+' · new · '+seller.price_kind+': '+seller.scope};
 if(['older_model_plus_20','category_120_80'].includes(r.estimate_method)&&r.estimate_status==='calculated'&&low!==null&&high!==null&&high>=low)return {kind:'estimate',currency:r.estimate_currency,low,high,source_url:safeUrl((r.estimate_source_urls||'').split(';')[0]),checked_date:r.estimate_checked_date||'',scope:r.estimate_basis};
 if(low!==null&&high!==null&&high>=low&&/^[A-Z]{3}$/.test(r.estimate_currency))return {kind:'estimate',currency:r.estimate_currency,low,high,source_url:safeUrl(r.estimate_source_url),checked_date:r.estimate_checked_date||'',scope:r.estimate_subject||r.category_name};
 return {kind:'unpriced',currency:'',low:0,high:0,source_url:'',checked_date:'',scope:'Price not recorded'};
}
export function instrumentFor(r:Equipment):ProcessInstrument{return {
 instance_id:newProcessId(r.category_id),equipment_id:r.equipment_id,category_id:r.category_id,
 category_refs:[...new Set([r.category_id,...splitIds(r.legacy_category_ids)])],equipment_snapshot:{...r},quantity:1,
 configuration:{},operating_parameters:{},operation_sequence:[],signals:{},inputs:{},outputs:{},extensions:{},price_snapshot:priceSnapshot(r),
};}
export function unitId(i:ProcessInstrument){return typeof i.extensions.physical_unit_id==='string'?i.extensions.physical_unit_id:i.instance_id;}
export function reuseInstrument(workflow:ProcessWorkflow,slotId:string,fromSlotId:string):ProcessWorkflow{
 const slots=workflow.steps.flatMap(s=>s.slots),from=slots.find(s=>s.slot_id===fromSlotId),to=slots.find(s=>s.slot_id===slotId);
 if(!from?.instrument||!to||!slotAccepts(to,from.instrument.equipment_snapshot))throw new Error('Choose an existing unit that matches this slot.');
 const i=from.instrument,reused=structuredClone(i);reused.instance_id=newProcessId(i.category_id);reused.extensions.physical_unit_id=unitId(i);
 return {...workflow,steps:workflow.steps.map(s=>({...s,slots:s.slots.map(v=>v.slot_id===slotId?{...v,instrument:reused}:v)}))};
}
export function slotAccepts(slot:ProcessSlot,r:Equipment){
 const subtypes=slot.extensions.allowed_equipment_subtypes;
 return !!slot.allowed_category_ids.length&&slot.allowed_category_ids.some(id=>[r.category_id,...splitIds(r.legacy_category_ids)].includes(id))&&
  (subtypes===undefined||Array.isArray(subtypes)&&subtypes.some(s=>typeof s==='string'&&splitIds(r.equipment_subtype).includes(s)));
}
export function routeCandidates(records:Equipment[],route:Route,slot:ProcessSlot|null,steps?:ProcessStep[]){
 // The current plan's classified steps define relevance, including user-added slots.
 // A route tag alone does not establish that a model fits any equipment step.
 const classes=new Set(steps===undefined?splitIds(route.equipment_category_ids):steps.flatMap(s=>s.slots.flatMap(v=>v.allowed_category_ids)));
 if(slot?.extensions.requirement_role==='unclassified'&&!slot.allowed_category_ids.length)return [];
 return records.filter(r=>[r.category_id,...splitIds(r.legacy_category_ids)].some(id=>classes.has(id))&&(slot?slotAccepts(slot,r):!steps||steps.some(s=>s.slots.some(v=>slotAccepts(v,r)))));
}
export function assignInstrument(workflow:ProcessWorkflow,slotId:string,r:Equipment):ProcessWorkflow{
 const slot=workflow.steps.flatMap(s=>s.slots).find(s=>s.slot_id===slotId);
 if(!slot||!slotAccepts(slot,r))throw new Error('This model does not match the slot’s equipment classes. Choose a matching model or edit the slot classes.');
 return {...workflow,steps:workflow.steps.map(s=>({...s,slots:s.slots.map(slot=>slot.slot_id===slotId?{...slot,instrument:instrumentFor(r)}:slot)}))};
}
export function fillMatchingInstrumentSlots(workflow:ProcessWorkflow,sourceSlotId:string){
 const sourceStep=workflow.steps.find(s=>s.slots.some(v=>v.slot_id===sourceSlotId));
 const instrument=sourceStep?.slots.find(v=>v.slot_id===sourceSlotId)?.instrument;
 if(!sourceStep||!instrument)throw new Error('Choose an assigned instrument before filling matching slots.');
 const filledSlotIds:string[]=[];let additionalUnits=0;
 if(!/^M\d{2,3}$/.test(instrument.category_id))return {workflow,filledSlotIds,additionalUnits};
 // Prefer the selected unit, then reuse additional units of this exact model if a stage needs more than one.
 const units=new Map<string,ProcessInstrument>([[unitId(instrument),instrument]]);
 for(const step of workflow.steps)for(const slot of step.slots){
  const i=slot.instrument;if(i&&i.equipment_id===instrument.equipment_id&&i.category_id===instrument.category_id&&!units.has(unitId(i)))units.set(unitId(i),i);
 }
 const steps=workflow.steps.map(step=>{
  if(step.step_id===sourceStep.step_id)return step;
  const used=new Set(step.slots.flatMap(s=>s.instrument?[unitId(s.instrument)]:[]));let changed=false;
  const slots=step.slots.map(slot=>{
   // A shared historical X alias or an unclassified slot is not an explicit match to this M class.
   if(slot.instrument||!slot.allowed_category_ids.includes(instrument.category_id)||!slotAccepts(slot,instrument.equipment_snapshot))return slot;
   const available=[...units.values()].find(i=>!used.has(unitId(i))),copy=structuredClone(available||instrument);
   copy.instance_id=newProcessId(copy.category_id);
   if(available)copy.extensions.physical_unit_id=unitId(available);
   else{delete copy.extensions.physical_unit_id;units.set(unitId(copy),copy);additionalUnits++;}
   used.add(unitId(copy));filledSlotIds.push(slot.slot_id);changed=true;
   return {...slot,instrument:copy};
  });
  return changed?{...step,slots}:step;
 });
 return {workflow:filledSlotIds.length?{...workflow,steps}:workflow,filledSlotIds,additionalUnits};
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
 const totals=new Map<string,{currency:string;low:number;high:number;estimated:boolean;manufacturer:boolean;quantity:number}>();let missing=0,assigned=0;const units=new Set<string>();
 for(const i of steps.flatMap(s=>s.slots).flatMap(s=>s.instrument?[s.instrument]:[])){
  if(units.has(unitId(i)))continue;units.add(unitId(i));
  assigned+=i.quantity;const p=usdPrice(i.price_snapshot);if(p.kind==='unpriced'){missing+=i.quantity;continue;}
  const t=totals.get(p.currency)||{currency:p.currency,low:0,high:0,estimated:false,manufacturer:false,quantity:0};
  t.low+=p.low*i.quantity;t.high+=p.high*i.quantity;t.quantity+=i.quantity;t.estimated||=p.kind==='estimate';t.manufacturer||=p.kind==='manufacturer'||p.kind==='seller';totals.set(p.currency,t);
 }
 return {totals:[...totals.values()].sort((a,b)=>a.currency.localeCompare(b.currency)),missing,assigned};
}
export function money(value:number,currency='USD'){try{return new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits:0,maximumFractionDigits:2}).format(value)}catch{return currency+' '+value.toLocaleString()}}
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
 if(w.extensions.material_plan!==undefined)validateMaterialPlan(w.extensions.material_plan,w.route_id);
 if(!Array.isArray(w.steps)||!w.steps.length||w.steps.length>100)throw new Error('Use between 1 and 100 steps.');
 const ids=new Set<string>(),known=new Map(records.map(r=>[r.equipment_id,r])),units=new Map<string,{equipment_id:string;quantity:number}>();let slotCount=0;
 const oldInstruments=new Map(existing?.steps.flatMap(s=>s.slots).flatMap(s=>s.instrument?[s.instrument]:[]).map(i=>[i.instance_id,i])||[]);
 const trustedUnits=new Map([...oldInstruments.values()].map(i=>[unitId(i),i]));
 function id(value:unknown,prefix:string){if(typeof value!=='string'||!new RegExp('^'+prefix+'-'+uuid+'$','i').test(value)||ids.has(value))throw new Error('Workflow component IDs must be unique system IDs.');ids.add(value);}
 for(const step of w.steps){
  if(!isObject(step))throw new Error('Invalid step.');id(step.step_id,'STEP');text(step.label,200,'step name',true);text(step.notes,12000,'step notes');text(step.source_sequence,12000,'source sequence');text(step.source_step_order,30,'source step');jsonObject(step.extensions,'Step extensions');
  if(!Array.isArray(step.slots)||step.slots.length>50||(slotCount+=step.slots.length)>250)throw new Error('Use at most 50 slots per step and 250 per workflow.');
  const pending=step.extensions.unclassified_equipment_slots;
  if(pending!==undefined){
   if(!Array.isArray(pending)||pending.length>50||(slotCount+=pending.length)>250)throw new Error('Too many pending equipment requests.');
   for(const request of pending){
    if(!isObject(request)||request.instrument!==null)throw new Error('Invalid pending equipment request.');
    id(request.slot_id,'SLOT');text(request.label,200,'pending slot label',true);jsonObject(request.extensions,'Pending slot extensions');
    if(!Array.isArray(request.allowed_category_ids)||request.allowed_category_ids.length>100||request.allowed_category_ids.some(c=>typeof c!=='string'||!/^M\d{2,3}$|^X-[A-Z0-9-]+$/.test(c)))throw new Error('Invalid pending class references.');
   }
  }

  for(const slot of step.slots){
   if(!isObject(slot))throw new Error('Invalid slot.');id(slot.slot_id,'SLOT');text(slot.label,200,'slot label',true);jsonObject(slot.extensions,'Slot extensions');
   if(!Array.isArray(slot.allowed_category_ids)||!slot.allowed_category_ids.length||slot.allowed_category_ids.length>100||slot.allowed_category_ids.some(c=>typeof c!=='string'||!/^M\d{2,3}$/.test(c)))throw new Error('Choose an M-class for every equipment slot before saving.');
   if(slot.instrument===null)continue;const i=slot.instrument;if(!isObject(i))throw new Error('Invalid instrument assignment.');
   const old=oldInstruments.get(i.instance_id);const r=old?.equipment_snapshot||known.get(i.equipment_id);if(!r)throw new Error('This equipment is no longer in your ontology. Re-select a model.');
   id(i.instance_id,r.category_id);if(old&&old.equipment_id!==i.equipment_id)throw new Error('An instrument instance cannot change model. Replace the instrument to create a new instance.');
   if(!slotAccepts(slot,r))throw new Error('An assigned instrument does not match its slot classes.');
   if(!Number.isSafeInteger(i.quantity)||i.quantity<1||i.quantity>1000)throw new Error('Equipment quantity must be a whole number between 1 and 1000.');
   for(const key of ['configuration','operating_parameters','signals','inputs','outputs','extensions'] as const)jsonObject(i[key],key);
   if(i.configuration[SEQUENCE_KEY]!==undefined)i.configuration[SEQUENCE_KEY]=validateControlSequence(i.configuration[SEQUENCE_KEY]) as unknown as JsonValue;
   const unit=unitId(i),prior=units.get(unit);if(prior&&(prior.equipment_id!==i.equipment_id||prior.quantity!==i.quantity))throw new Error('A reused physical unit keeps the same model and quantity across steps.');units.set(unit,{equipment_id:i.equipment_id,quantity:i.quantity});
   if(!Array.isArray(i.operation_sequence)||i.operation_sequence.length>200||i.operation_sequence.some(v=>typeof v!=='string'||v.length>6000))throw new Error('Invalid operation sequence.');
   // Identity, ontology evidence and prices are server-owned snapshots; custom configuration stays separate.
   const linked=trustedUnits.get(unit);if(linked&&linked.equipment_id!==i.equipment_id)throw new Error('A physical unit cannot change model.');
   const identity=old||linked||instrumentFor(r);i.equipment_id=identity.equipment_id;i.category_id=identity.category_id;i.category_refs=identity.category_refs;i.equipment_snapshot=identity.equipment_snapshot;i.price_snapshot=identity.price_snapshot;trustedUnits.set(unit,i);
  }
 }
 const dependencyIssues=processDependencyGraph(w).errors;if(dependencyIssues.length)throw new Error(dependencyIssues[0]);
 return w;
}
