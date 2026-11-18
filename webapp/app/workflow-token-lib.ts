import {canonicalJSON,evidenceDigest} from './evidence-lib.ts';
import {readControlSequence,SEQUENCE_KEY} from './control-sequence-lib.ts';
import {materialPlanFor} from './process-materials-lib.ts';
import {stepDependencies} from './process-dependencies.ts';
import {stepConditions} from './process-condition-lib.ts';
import type {ProcessWorkflow,JsonValue,ProcessInstrument} from './process-lib.ts';
import type {EvidenceRecord} from './evidence-lib.ts';
import type {ResearchRecord} from './research-lib.ts';

export const RUN_LINKS_KEY='ontology_run_tokens';
export const MACHINE_TOKEN=/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const RECIPE_TOKEN=/^sha256:[0-9a-f]{64}$/;
export type MachineUnit={machine_token:string;catalog_equipment_id:string;label:string;manufacturer:string;model_name:string;category_id:string;created_at:string;registration_status:'user_registered_physical_unit'};
export type RecipeGeometry={schema:'iconpcl-geometry/v1';shape:string;design_url:string;design_sha256:string;format:string;coordinate_frame:string;build_orientation:string;dimensions:{name:string;value:number;unit:string}[];tolerance:string};
export type RecipeRole={role_id:string;catalog_equipment_ids:string[];category_ids:string[];required_capabilities:string[];quantity:number;label:string;placement_ids:string[]};
export type RecipeManifest={profile:'iconpcl-recipe-manifest/v1';recipe_id:string;revision:string;label:string;workflow_kind:string;scope:'planning_draft';process_ids:string[];machine_roles:RecipeRole[];input_roles:{role_id:string;kind:string;required:boolean;description:string}[];material_requirements:string[];steps:any[];preconditions:string[];completion_signals:string[];expected_outputs:any[];source_ids:string[];geometry?:any};
export type RecipeSnapshot={recipe_token:string;hash_profile:'sha256-exact-manifest-bytes/v1';manifest_text:string;manifest:RecipeManifest};
export type RecipeInfo={recipe_token:string;hash_profile:string;download_url:string;legacy_derived:boolean};
export type MaterialBinding={binding_id:string;input_role:string;name:string;batch_id:string;amount:string;record_id:string;record_revision:number|null;record_snapshot?:{name:string;type_code:string;status:string}};
export type SpecimenBinding={specimen_id:string;label:string;kind:'expected'|'reported';record_id:string;record_revision:number|null;notes:string;record_snapshot?:{name:string;type_code:string;status:string}};
export type RunLinks={schema:'iconpcl-run-links/v1';run_token:string;recipe_token:string;machine_bindings:{machine_role:string;machine_token:string}[];material_bindings:MaterialBinding[];specimen_bindings:SpecimenBinding[]};
export const isExperiment=(r:ResearchRecord)=>r.kind==='collection'&&r.type_code==='EXPERIMENT';
export const runToken=(recordId:string)=>/^RSR-[0-9a-f-]{36}$/i.test(recordId)?'urn:uuid:'+recordId.slice(4):'';
export function readRunLinks(r:ResearchRecord):RunLinks|null {const value=r.properties?.[RUN_LINKS_KEY] as RunLinks|undefined;return value?.schema==='iconpcl-run-links/v1'?value:null;}
export const blankRunLinks=():RunLinks=>({schema:'iconpcl-run-links/v1',run_token:'',recipe_token:'',machine_bindings:[],material_bindings:[],specimen_bindings:[]});
const text=(v:unknown,max:number,label:string)=>{if(typeof v!=='string'||v.length>max)throw new Error('Invalid '+label+'.');return v;};

export function validateGeometry(value:unknown):RecipeGeometry|null {
 if(value===undefined||value===null)return null;
 if(typeof value!=='object'||Array.isArray(value))throw new Error('Invalid 3D recipe.');
 const g=structuredClone(value) as RecipeGeometry;
 if(g.schema!=='iconpcl-geometry/v1')throw new Error('Unsupported 3D recipe version.');
 for(const [k,n] of [['shape',240],['design_url',2083],['design_sha256',64],['format',80],['coordinate_frame',500],['build_orientation',500],['tolerance',1000]] as const)text(g[k],n,'3D '+k);
 if(g.design_url){try{const url=new URL(g.design_url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw 0;}catch{throw new Error('Use a complete HTTPS or HTTP design-file URL without embedded credentials.');}}
 if(g.design_sha256&&!/^[0-9a-f]{64}$/i.test(g.design_sha256))throw new Error('Design SHA-256 must contain 64 hexadecimal characters.');
 g.design_sha256=g.design_sha256.toLowerCase();
 if(!Array.isArray(g.dimensions)||g.dimensions.length>20)throw new Error('Use up to twenty dimensions.');
 const names=new Set<string>();for(const d of g.dimensions){text(d.name,80,'dimension name');text(d.unit,30,'dimension unit');if(!d.name.trim()||!d.unit.trim()||names.has(d.name)||!Number.isFinite(d.value)||d.value<=0)throw new Error('Dimensions need unique names, positive values and units.');names.add(d.name);}
 return g;
}

function parameter(id:string,value:unknown){return {parameter_id:id,value:typeof value==='number'||typeof value==='boolean'||typeof value==='string'?value:canonicalJSON(value??null),unit_uri:null,unit_text:typeof value==='number'?'not stated':null,status:'specified',source_ids:[]};}
function grouping(i:ProcessInstrument){return typeof i.extensions.physical_unit_id==='string'?i.extensions.physical_unit_id:i.instance_id;}
export function workflowMachineBindingIssues(w:ProcessWorkflow,units:MachineUnit[]){
 const groups=new Map<string,string>(),issues:string[]=[];
 for(const step of w.steps)for(const slot of step.slots){const i=slot.instrument;if(!i)continue;const token=i.extensions.machine_token;
  if(token!==undefined&&token!==''){const unit=units.find(u=>u.machine_token===token);if(!unit||unit.catalog_equipment_id!==i.equipment_id)issues.push('Choose a registered physical machine for this model.');if(i.quantity!==1)issues.push('A registered machine token represents one physical unit. Use separate slots for multiple units.');}
  const key=grouping(i),value=String(token||'');if(groups.has(key)&&groups.get(key)!==value)issues.push('Reused occurrences of one physical unit must use the same machine token.');groups.set(key,value);
 }return [...new Set(issues)];
}
const unitUris:Record<string,string>={mm:'MilliM',m:'M','µm':'MicroM',um:'MicroM',nm:'NanoM',cm:'CentiM'};

/** Freeze execution-relevant declarations. Evidence UUIDs/timestamps, prices and run bindings are excluded. */
export function recipeManifest(w:ProcessWorkflow,evidence:EvidenceRecord[]=[]):RecipeManifest {
 const materialMode=w.extensions.recipe_materials_mode==='per_run'?'per_run':'include';
 const materials=materialPlanFor(w),geometry=validateGeometry(w.extensions.recipe_geometry);
 const roles:RecipeRole[]=[],roleByUnit=new Map<string,string>();
 const controls=new Map<string,any>();
 for(const e of evidence)if(e.record_kind==='instrument_sequence')controls.set(String((e.context.workflow as any)?.slot_id||''),e.context);
 for(const s of w.steps)for(const slot of s.slots)if(slot.instrument){const i=slot.instrument,key=grouping(i);let role=roleByUnit.get(key);if(!role){role='machine-'+(roles.length+1);roleByUnit.set(key,role);roles.push({role_id:role,catalog_equipment_ids:[i.equipment_id],category_ids:[i.category_id],required_capabilities:[i.equipment_snapshot.category_name],quantity:i.quantity,label:i.equipment_snapshot.model_name,placement_ids:[]});}roles.find(r=>r.role_id===role)!.placement_ids.push(slot.slot_id);}
 const steps=w.steps.map((s,si)=>({step_id:s.step_id,label:s.label,prerequisite_step_ids:stepDependencies(w,s),
  instruction_sequences:s.slots.flatMap(slot=>{if(!slot.instrument)return [];const i=slot.instrument,sequence=readControlSequence(i.configuration[SEQUENCE_KEY],i.configuration.ontology_control_selection),frozen=controls.get(slot.slot_id);
   return [{sequence_id:slot.slot_id,machine_role:roleByUnit.get(grouping(i))!,actions:sequence.steps.length?sequence.steps.map((a,ai)=>{const source=frozen?.actions?.[ai];return {action_id:slot.slot_id+'-action-'+(ai+1),position:a.position||'undocumented',fiber:a.fiber_id||'undocumented',direction:a.direction||'undocumented',definition_status:source?.operation_definition?'documented_model_bound':'illustrative_unverified',operation_reference:source?.operation_definition?.command?.reference||source?.operation_definition?.command_reference||null,parameters:Object.entries(a.parameter_values||{}).map(([key,v])=>({...parameter(key,v),unit_text:a.parameter_units?.[key]||source?.operation_definition?.parameters?.find((p:any)=>p.id===key)?.unit||null})),source_ids:source?.source_evidence_ids||[],operation_definition:source?.operation_definition||null,notes:a.notes||''};}):[{action_id:slot.slot_id+'-undocumented',position:'undocumented',fiber:'undocumented',direction:'No model-bound instruction sequence supplied',definition_status:'illustrative_unverified',operation_reference:null,parameters:[],source_ids:[],operation_definition:null,notes:''}]}];}),
  parameters:[parameter('step_notes',s.notes),parameter('step_conditions',stepConditions(s)),parameter('step_requirements',s.extensions.requirements||null),parameter('source_sequence',s.source_sequence),parameter('required_slots',s.slots.map(v=>({slot_id:v.slot_id,allowed_category_ids:v.allowed_category_ids,assigned:!!v.instrument,requirement_role:v.extensions.requirement_role||'custom'}))),...s.slots.flatMap(slot=>{const i=slot.instrument;if(!i)return [];const configuration=structuredClone(i.configuration);delete configuration[SEQUENCE_KEY];delete configuration.ontology_control_selection;return [parameter(slot.slot_id+'.configuration',configuration),parameter(slot.slot_id+'.operating_parameters',i.operating_parameters),parameter(slot.slot_id+'.operation_sequence',i.operation_sequence),parameter(slot.slot_id+'.signals',i.signals),parameter(slot.slot_id+'.inputs',i.inputs),parameter(slot.slot_id+'.outputs',i.outputs)];})]}));
 const completeGeometry=geometry&&geometry.design_url&&geometry.design_sha256&&geometry.dimensions.length;
 const computational=w.extensions.workflow_kind==='computational_workflow';
 const manifest:RecipeManifest={profile:'iconpcl-recipe-manifest/v1',recipe_id:w.workflow_id||w.route_id,revision:'content-addressed',label:w.name,workflow_kind:computational?'computational':completeGeometry?'manufacturing_3d':'manufacturing',scope:'planning_draft',process_ids:[w.route_id],machine_roles:roles,
  input_roles:materialMode==='include'&&materials.inputs.length?materials.inputs.map((m,index)=>({role_id:'material-'+(index+1),kind:'material',required:true,description:[m.name,m.role,m.amount].filter(Boolean).join(' · ')})):computational?[]:[{role_id:'feedstock',kind:'material',required:true,description:'Bind starting materials and amounts for this run.'}],
  material_requirements:materialMode==='include'?materials.inputs.map(m=>canonicalJSON({name:m.name,role:m.role,amount:m.amount,component_id:m.component_id||'',offer_id:m.offer_id||''})):[],
  steps,preconditions:['Planning metadata only. Resolve model-bound operations, settings, resource/interlock checks and device adapters before autonomous execution.'],completion_signals:['Record actual completion and any errors from the instrument controller.'],
  expected_outputs:[{output_role:'process_output',description:materials.expected_output||w.route_name,geometry_ref:completeGeometry?'#/geometry':null,acceptance_criteria:geometry?.tolerance?[geometry.tolerance]:[]}],source_ids:[]};
 if(completeGeometry)manifest.geometry={design:{uri:geometry.design_url,sha256:geometry.design_sha256,media_type:geometry.format||'application/octet-stream',description:'User-declared design reference and checksum; remote bytes have not been independently verified.'},shape:geometry.shape||'User-defined shape',coordinate_frame:geometry.coordinate_frame||'Not stated',dimensions:Object.fromEntries(geometry.dimensions.map(d=>[d.name,{value:d.value,unit_text:d.unit,unit_uri:unitUris[d.unit]?'http://qudt.org/vocab/unit/'+unitUris[d.unit]:'urn:iconpcl:unmapped-unit:'+encodeURIComponent(d.unit)}])),tolerances:[],build_orientation:geometry.build_orientation||'Not stated'};
 else if(geometry)manifest.steps[0]?.parameters.push(parameter('draft_3d_geometry',geometry));
 // Preserve nominal material/output declarations without transient local material UUIDs.
 manifest.steps[0]?.parameters.push(parameter('recipe_notes',w.notes));
 if(materialMode==='include')manifest.steps[0]?.parameters.push(parameter('material_output_target',materials.expected_output));
 return manifest;
}
export async function freezeRecipe(w:ProcessWorkflow,records:EvidenceRecord[]=[]):Promise<RecipeSnapshot>{const manifest=recipeManifest(w,records),manifest_text=canonicalJSON(manifest),recipe_token='sha256:'+await evidenceDigest(manifest);return {recipe_token,hash_profile:'sha256-exact-manifest-bytes/v1',manifest_text,manifest};}
export async function verifyRecipeBytes(token:string,bytes:string){return RECIPE_TOKEN.test(token)&&token==='sha256:'+[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(bytes)))].map(x=>x.toString(16).padStart(2,'0')).join('');}

export function validateRunLinks(value:unknown,record:ResearchRecord,previous?:ResearchRecord):RunLinks {
 const links=structuredClone(value||blankRunLinks()) as RunLinks;
 if(links.schema!=='iconpcl-run-links/v1'||Object.keys(links).some(k=>!['schema','run_token','recipe_token','machine_bindings','material_bindings','specimen_bindings'].includes(k)))throw new Error('Invalid experiment token links.');
 if(links.run_token&&links.run_token!==runToken(record.record_id))throw new Error('The run token is assigned by the server and remains stable.');
 if(links.recipe_token&&!RECIPE_TOKEN.test(links.recipe_token))throw new Error('Invalid recipe token.');
 const old=previous?readRunLinks(previous):null;
 if(old?.recipe_token&&(previous?.workflow_id!==record.workflow_id||previous.workflow_revision!==record.workflow_revision||links.recipe_token&&links.recipe_token!==old.recipe_token))throw new Error('This run is pinned to its original recipe revision. Create a new experiment for a different recipe.');
 for(const [key,max] of [['machine_bindings',100],['material_bindings',30],['specimen_bindings',30]] as const)if(!Array.isArray(links[key])||links[key].length>max)throw new Error('Too many '+key+'.');
 const roles=new Set<string>();for(const b of links.machine_bindings){text(b.machine_role,160,'machine role');if(!MACHINE_TOKEN.test(b.machine_token)||roles.has(b.machine_role))throw new Error('Bind each machine role once, using a registered machine token.');roles.add(b.machine_role);}
 const ids=new Set<string>();for(const b of links.material_bindings){for(const k of ['binding_id','input_role','name','batch_id','amount','record_id'] as const)text(b[k],k==='amount'?100:240,'material '+k);if(!b.binding_id||!b.name.trim()||ids.has(b.binding_id))throw new Error('Materials need unique binding IDs and names.');ids.add(b.binding_id);if(b.record_revision!==null&&(!Number.isSafeInteger(b.record_revision)||b.record_revision<1))throw new Error('Invalid material record revision.');delete b.record_snapshot;}
 ids.clear();for(const b of links.specimen_bindings){for(const k of ['specimen_id','label','record_id','notes'] as const)text(b[k],k==='notes'?2000:240,'specimen '+k);if(!/^SPC-[0-9a-f-]{36}$/i.test(b.specimen_id)||ids.has(b.specimen_id)||!['expected','reported'].includes(b.kind)||!b.label.trim())throw new Error('Specimens need unique system IDs, a label and an expected/reported status.');ids.add(b.specimen_id);if(b.record_revision!==null&&(!Number.isSafeInteger(b.record_revision)||b.record_revision<1))throw new Error('Invalid specimen revision.');delete b.record_snapshot;}
 links.run_token=runToken(record.record_id);return links;
}

export function runBindingIssues(links:RunLinks,manifest:RecipeManifest,units:MachineUnit[]){
 const issues:string[]=[],byToken=new Map(units.map(u=>[u.machine_token,u]));
 for(const b of links.machine_bindings){const role=manifest.machine_roles.find(r=>r.role_id===b.machine_role),unit=byToken.get(b.machine_token);if(!role||!unit||!role.catalog_equipment_ids.includes(unit.catalog_equipment_id))issues.push('A machine binding does not match its saved recipe model.');}
 for(const role of manifest.machine_roles){if(role.quantity!==1)issues.push(role.label+': split quantity '+role.quantity+' into individual machine slots before recording a bound run.');if(!links.machine_bindings.some(b=>b.machine_role===role.role_id))issues.push('Choose a registered physical unit for '+role.label+'.');}
 const materialRequired=manifest.input_roles.some(r=>r.kind==='material'&&r.required);
 if(materialRequired&&(manifest.input_roles.filter(r=>r.kind==='material'&&r.required).some(r=>!links.material_bindings.some(b=>b.input_role===r.role_id))||links.material_bindings.some(b=>!b.batch_id.trim()||!b.amount.trim())))issues.push('Bind every required material role, with batches and amounts for this experiment.');
 if(!links.specimen_bindings.length&&manifest.workflow_kind!=='computational')issues.push('Add at least one expected or reported specimen.');
 return [...new Set(issues)];
}

/** Add explicit token relationships without converting planned bindings into observed PROV usage. */
export function addRunTokenGraph(graph:Record<string,unknown>[],entity:Record<string,unknown>,record:ResearchRecord,origin:string){
 if(!isExperiment(record)||!record.record_id)return;
 entity['icon:runToken']=runToken(record.record_id);
 const links=readRunLinks(record);if(!links)return;
 if(links.recipe_token){const id=origin+'/api/recipes?run_id='+encodeURIComponent(record.record_id),checksum='#recipe-checksum-'+links.recipe_token.slice(7);
  entity['icon:recipe']={'@id':id};graph.push({'@id':id,'@type':['CreativeWork','prov:Plan'],'dct:identifier':links.recipe_token,'spdx:checksum':{'@id':checksum},'icon:executionEvidence':false},{'@id':checksum,'@type':'spdx:Checksum','spdx:algorithm':{'@id':'http://spdx.org/rdf/terms#checksumAlgorithm_sha256'},'spdx:checksumValue':links.recipe_token.slice(7)});
 }
 entity['icon:machineBindings']=links.machine_bindings.map((b,i)=>{const id='#run-machine-binding-'+i;graph.push({'@id':b.machine_token,'@type':'saref:Device',identifier:b.machine_token},{'@id':id,'@type':'prov:Entity','icon:machineRole':b.machine_role,'icon:machine':{'@id':b.machine_token},'icon:bindingScope':'Assigned unit, not evidence of observed device execution.'});return {'@id':id};});
 entity['icon:materialBindings']=links.material_bindings.map(b=>{const id='#'+encodeURIComponent(b.binding_id);graph.push({'@id':id,'@type':'prov:Entity',name:b.name,'icon:batchId':b.batch_id,'icon:declaredAmount':b.amount,'icon:inputRole':b.input_role,...(b.record_id?{'dct:references':{'@id':runToken(b.record_id)},'icon:sourceRecordRevision':b.record_revision}:{}),'icon:bindingScope':'Run-specific declaration; not an automatically observed consumption event.'});return {'@id':id};});
 entity['icon:specimenBindings']=links.specimen_bindings.map(b=>{const id='#'+b.specimen_id;graph.push({'@id':id,'@type':'prov:Entity',identifier:b.specimen_id,name:b.label,description:b.notes,'icon:specimenStatus':b.kind,...(b.record_id?{'dct:references':{'@id':runToken(b.record_id)},'icon:sourceRecordRevision':b.record_revision}:{}),'icon:bindingScope':b.kind==='expected'?'Expected specimen; not a manufactured result.':'User-linked completed sample/material record. Consult its measured data and provenance.'});return {'@id':id};});
}
