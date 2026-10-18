import type {CatalogRow,Route} from './catalog-lib.ts';
import {createWorkflow,splitIds,type ProcessWorkflow,type SavedWorkflow} from './process-lib.ts';
import {processDependencyGraph} from './process-dependencies.ts';
import {materialPlanFor,withMaterialPlan} from './process-materials-lib.ts';
import {formulationPlan,type ComponentData,type ComponentFormulation} from './component-lib.ts';
import {CONDITION_DEFINITIONS,conditionText,stepConditions,type ConditionLibrary} from './process-condition-lib.ts';
import {productEvidence} from './output-evidence-lib.ts';

export const VISUAL_PAPER={title:'Digitalizing Material Knowledge: A Practical Framework for Ontology-Driven Knowledge Graphs in Process Chains',doi:'https://doi.org/10.3390/app142411683',reference_id:'REF-8508E2857729',year:2024};
const BASE='https://github.com/PodComet/ICoN-PCL-Equipment-Metadata/';
export const V=BASE+'ontology#';
export type VisualItem={label:string;detail:string;url?:string;equipment_id?:string;evidence_id?:string;quantity?:{value:number|null;upper_value:number|null;unit:string;operator:string;quantity_kind:string;text_value:string}};
export type VisualNode={id:string;key:string;kind:'process'|'material'|'equipment'|'parameter'|'data'|'context';title:string;subtitle:string;pattern:string;scope:string;items:VisualItem[];missing:boolean;x:number;y:number;width:number;height:number;step_id?:string};
export type VisualEdge={id:string;source:string;target:string;label:string;predicate:string;basis:string;tentative:boolean};
export type VisualGraph={schema:'iconpcl-visual-graph/v1';kind:'process_context'|'process_chain';title:string;route_id:string;source_kind:'source_template'|'saved_plan';workflow_id:string;revision:number|null;paper:typeof VISUAL_PAPER;nodes:VisualNode[];edges:VisualEdge[];width:number;height:number;warnings:string[]};
export type VisualInput={route:Route;workflow:ProcessWorkflow;sourceSteps:Record<string,string>[];rows:CatalogRow[];categories:Record<string,string>[];science:ConditionLibrary;formulation?:ComponentFormulation;saved?:SavedWorkflow|null;stepId?:string};
const rid=(input:VisualInput)=>BASE+'id/visual/'+(input.saved?'workflow/'+encodeURIComponent(input.workflow.workflow_id)+'/revision/'+input.saved.revision:'template/'+input.route.route_id);
const clean=(s:unknown)=>String(s??'');
export function sourceVisualWorkflow(route:Route,steps:Record<string,string>[],components:ComponentData){
 const workflow=createWorkflow(route,steps),formulation=components.formulations.find(f=>f.route_id===route.route_id&&f.completeness!=='not_applicable');
 return {workflow:formulation?withMaterialPlan(workflow,formulationPlan(formulation)):workflow,formulation};
}
function graph(input:VisualInput,kind:VisualGraph['kind']):VisualGraph{return {schema:'iconpcl-visual-graph/v1',kind,title:kind==='process_context'?'Process context graph':'Process chain & material states',route_id:input.route.route_id,source_kind:input.saved?'saved_plan':'source_template',workflow_id:input.workflow.workflow_id,revision:input.saved?.revision??null,paper:VISUAL_PAPER,nodes:[],edges:[],width:1060,height:680,warnings:[]};}
function addNode(g:VisualGraph,id:string,key:string,kind:VisualNode['kind'],title:string,pattern:string,items:VisualItem[],scope:string,x:number,y:number,width=236,height=88,step_id?:string){
 const n:VisualNode={id:id+'/'+key,key,kind,title,pattern,items,scope,subtitle:items.length?items.length+' '+(items.length===1?'record':'records'):'Not recorded',missing:items.length===0,x,y,width,height,...(step_id?{step_id}:{})};g.nodes.push(n);return n;
}
function edge(g:VisualGraph,from:VisualNode,to:VisualNode,label:string,predicate:string,basis:string,tentative=false){g.edges.push({id:'edge-'+g.edges.length,source:from.id,target:to.id,label,predicate:V+predicate,basis,tentative});}
function evidenceItem(input:VisualInput,id:string,label:string,detail:string):VisualItem{
 const e=input.science.evidence.find(e=>e.evidence_id===id);return {label,detail:detail+(e?' · '+e.source_locator:''),...(e?{url:e.source_url}:{}),...(id?{evidence_id:id}:{})};
}
export function processContextGraph(input:VisualInput):VisualGraph{
 const g=graph(input,'process_context'),selected=input.workflow.steps.find(s=>s.step_id===input.stepId),id=rid(input)+'/context/'+(selected?'step/'+encodeURIComponent(input.saved?selected.step_id:selected.source_step_order||selected.step_id):'whole'),steps=selected?[selected]:input.workflow.steps;
 const plan=materialPlanFor(input.workflow);
 const materials=plan.inputs.map(m=>({label:m.name,detail:[m.amount,m.role,input.saved?m.material_id:m.component_line_id||'Source formulation component'].filter(Boolean).join(' · ')}));
 const sourceScope=input.saved?'Saved workflow declaration; this is a plan, not an execution record.':'Representative literature example, where recorded. Not applied to a saved plan.';
 const routeItem={label:input.route.route_id+' · '+input.route.route_name,detail:sourceScope};
 const center=addNode(g,id,'process','process',selected?selected.label:input.route.route_id+' · '+input.route.route_name,'Process',[routeItem],sourceScope,412,292,236,112,selected?.step_id);
 const candidateIds=[...new Set(steps.flatMap(s=>s.slots.flatMap(slot=>slot.allowed_category_ids)))];
 const equipment:VisualItem[]=steps.flatMap(s=>s.slots.flatMap(slot=>slot.instrument?[{label:slot.instrument.category_id+' · '+slot.instrument.equipment_snapshot.model_name,detail:'Planned assignment · '+s.label+' · occurrence '+slot.instrument.instance_id,equipment_id:slot.instrument.equipment_id}]:[]));
 if(!input.saved)for(const cid of candidateIds){const candidates=input.rows.filter(r=>r.record.category_id===cid),example=candidates.find(r=>r.record.image_url)||candidates[0];equipment.push({label:cid+' · '+(input.categories.find(c=>c.category_id===cid)?.category_name||'Equipment class'),detail:candidates.length+' catalog model records · class candidate, not an exact-model use claim'+(example?' · Example: '+example.record.model_name:''),...(example?{equipment_id:example.record.equipment_id}:{})});}
 const conditions:VisualItem[]=input.saved?steps.flatMap(s=>stepConditions(s).map(c=>{
  const template=input.science.conditions.find(t=>t.template_id===c.reference_condition_id);
  const item=evidenceItem(input,template?.evidence_id||'',c.label||c.parameter,'Saved setting · '+conditionText(c)+' · '+s.label);
  return {...item,...(c.citation_url?{url:c.citation_url}:{}),quantity:{value:c.value,upper_value:c.upper_value,unit:c.unit,operator:c.operator,quantity_kind:c.parameter,text_value:c.text_value},detail:item.detail+(c.citation_locator?' · '+c.citation_locator:'')};
 })):input.science.conditions.filter(c=>c.route_id===input.route.route_id&&(!input.formulation||c.formulation_id===input.formulation.formulation_id)&&(!selected||c.source_step_order===selected.source_step_order)).map(c=>({...evidenceItem(input,c.evidence_id,c.label,'Literature setting · '+conditionText(c)+' · '+c.scope),quantity:{value:c.value,upper_value:c.upper_value,unit:c.unit,operator:c.operator,quantity_kind:c.parameter,text_value:c.text_value}}));
 const results=input.science.properties.filter(p=>p.route_id===input.route.route_id&&(!input.formulation||p.formulation_id===input.formulation.formulation_id)).map(p=>({...evidenceItem(input,p.evidence_id,p.label,'Literature result · '+conditionText({...p,parameter:p.property})+' · '+p.material_scope+' · '+p.scope),quantity:{value:p.value,upper_value:p.upper_value,unit:p.unit,operator:p.operator,quantity_kind:p.property,text_value:p.text_value}}));
 const procedures:VisualItem[]=input.formulation?[{label:input.formulation.label,detail:input.formulation.source_locator+' · '+input.formulation.scope,url:input.formulation.source_url}]:[];
 if(input.saved&&plan.formulation_id){const e=input.science.evidence.filter(e=>e.reference_ids.length&&input.science.conditions.some(c=>c.formulation_id===plan.formulation_id&&c.evidence_id===e.evidence_id));for(const item of e.slice(0,4))procedures.push({label:item.source_title,detail:item.source_locator,url:item.source_url,evidence_id:item.evidence_id});}
 const times=input.saved?[{label:'Metadata revision '+input.saved.revision,detail:'Saved '+input.saved.updated_at+' · experiment start/end times not recorded'}]:[];
 const hasSequence=input.saved||input.sourceSteps.some(s=>s.route_id===input.route.route_id);
 const stepItems=hasSequence?steps.map(s=>({label:s.label,detail:'Step '+(input.workflow.steps.indexOf(s)+1)+' · '+(input.saved?s.step_id:s.source_step_order)})):[];
 const output=plan.expected_output?[{label:plan.expected_output,detail:(input.saved?'User-selected target · '+productEvidence(input.workflow,0).evidence_id:'Literature example output · '+rid(input)+'/target')}]:[];
 const left:[string,VisualNode['kind'],string,string,VisualItem[],string][]=[
  ['inputs','material','Input materials','Object before process',materials,sourceScope],
  ['input-data','data','Input data sets','DataSet',[], 'Raw input files are not attached to this equipment plan.'],
  ['setup','equipment','Process setup','ProcessSetup',equipment,input.saved?'Exact planned instrument occurrences.':'Current catalog candidates for the process classes.'],
  ['infrastructure','context','Infrastructure','InfrastructureEquipmentSet',[],'Cooling, utilities and environmental services are not structured in this plan.'],
  ['software','context','Software','SoftwareArchitecture',[],'No process software declaration is recorded.'],
  ['operator','context','Operator','Operator',[],'A signed-in owner is not assumed to be the experimental operator.']
 ];
 const right:[string,VisualNode['kind'],string,string,VisualItem[],string][]=[
  ['parameters','parameter','Control parameters','ProcessParameterSet',conditions,input.saved?'Saved setpoints retain their units and citations.':'Source-reported settings for the selected representative formulation.'],
  ['procedure','context','Procedure & evidence','Procedure',procedures,'Cited methods; no claim that the saved plan executed them.'],
  ['subprocesses','process','Subprocesses','SubprocessSet',stepItems,'Ordered source actions or explicitly saved prerequisites.'],
  ['output','material','Output material target','Object after process',output,'Planned or source-reported output; no measured batch identity is asserted.'],
  ['results','data','Related result data','ProcessDataSet',results,'Literature-reported properties; these are not results measured from this plan.'],
  ['time','context','Time information','TemporalDataSet',times,'Metadata-save time is distinct from experimental acquisition time.']
 ];
 for(const [side,list] of [[0,left],[1,right]] as const)list.forEach(([key,kind,title,pattern,items,scope],i)=>{
  const n=addNode(g,id,key,kind,title,pattern,items,scope,side?800:24,18+i*110);
  const incoming=['inputs','input-data'].includes(key),label=incoming?'planned input':key==='output'?'planned output':key==='results'?'literature context':key==='setup'?'planned setup':key==='parameters'?'control information':'context';
  edge(g,incoming?n:center,incoming?center:n,label,incoming?'hasPlannedInputFor':key==='output'?'hasPlannedOutput':'hasContext',scope,n.missing);
 });
 return g;
}
export function processChainGraph(input:VisualInput):VisualGraph{
 const g=graph(input,'process_chain'),id=rid(input)+'/chain',dag=processDependencyGraph(input.workflow);g.warnings=[...dag.errors];
 const explicit=input.workflow.extensions.dependency_schema==='process-dependencies/v1';
 const missingSequence=!input.saved&&!input.sourceSteps.some(s=>s.route_id===input.route.route_id);
 if(missingSequence)g.warnings.push('No curated source sequence is recorded for this class. The placeholder is a planning prompt, not a documented process step.');
 if(!explicit)g.warnings.push('Default source order is shown. It is not an experimentally validated prerequisite or material-transfer model.');
 const plan=materialPlanFor(input.workflow),inputs=plan.inputs.map(m=>({label:m.name,detail:[m.amount,m.role,input.saved?m.material_id:m.component_line_id||'Source formulation component'].filter(Boolean).join(' · ')}));
 const maxRows=Math.max(1,...dag.levels.map(l=>l.length)),height=Math.max(330,maxRows*242+90),rowY=(index:number,count:number)=>(height-count*242)/2+index*242;
 g.height=height;g.width=Math.max(1060,260+dag.levels.length*300+255);
 const initial=addNode(g,id,'input','material','Starting materials','Planned material input',inputs,'Selected inputs or the representative source formulation.',24,height/2-44,210);
 const processNodes=new Map<string,VisualNode>(),stateNodes=new Map<string,VisualNode>();
 dag.levels.forEach((level,li)=>level.forEach((step,ri)=>{
  const x=280+li*300,y=rowY(ri,level.length),number=input.workflow.steps.indexOf(step)+1;
  const assigned=step.slots.filter(s=>s.instrument).map(s=>({label:s.instrument!.category_id+' · '+s.instrument!.equipment_snapshot.model_name,detail:'Planned occurrence '+s.instrument!.instance_id,equipment_id:s.instrument!.equipment_id}));
  const required=step.slots.filter(s=>!s.instrument).map(s=>({label:s.allowed_category_ids.join(' / ')||'Classification needed',detail:'Vacant · '+clean(s.extensions.requirement_role||'required')}));
  const p=addNode(g,id,'step-'+number,'process',number+'. '+step.label,'Planned process step',[...assigned,...required],'A process-step occurrence; repeated uses of a model remain separate.',x,y,218,94,step.step_id);
  p.missing=missingSequence;if(missingSequence)p.title=input.route.route_id+' · Sequence not documented';const classes=[...new Set(step.slots.flatMap(s=>s.allowed_category_ids))];p.subtitle=classes.slice(0,2).join('/')+(classes.length>2?' +'+(classes.length-2):'')+' · '+assigned.length+'/'+step.slots.length+' filled';processNodes.set(step.step_id,p);
  const state=addNode(g,id,'state-'+number,'material','Boundary after step '+number,'Unspecified material state',[], 'Planning boundary only. Identity, composition, amount and transformation at this boundary have not been established.',x+12,y+132,192,82,step.step_id);
  state.subtitle='Composition not recorded';stateNodes.set(step.step_id,state);
  edge(g,p,state,'output boundary','hasPlannedOutputBoundary',state.scope,true);
 }));
 if(!dag.errors.length)for(const step of input.workflow.steps){const p=processNodes.get(step.step_id)!;
  const parents=dag.dependencies.get(step.step_id)||[];
  if(!parents.length)edge(g,initial,p,'planned input','hasPlannedInputFor','Conceptual input link; per-step allocations are not recorded.',true);
  for(const parent of parents)edge(g,stateNodes.get(parent)!,p,explicit?'prerequisite':'source order',explicit?'planningPrerequisiteFor':'sourceOrderPredecessorFor',explicit?'User-declared dependency; material transfer remains unverified.':'Default source ordering only; no physical material-transfer claim.',true);
 }
 const final=addNode(g,id,'target','material',plan.expected_output||'Output target not specified','Planned output target',plan.expected_output?[{label:plan.expected_output,detail:input.saved?productEvidence(input.workflow,0).evidence_id:rid(input)+'/target'}]:[],'The requested output of this planning sequence, not a validated manufactured product.',g.width-230,height/2-44,210);
 const used=new Set([...dag.dependencies.values()].flat());
 if(!dag.errors.length)for(const step of input.workflow.steps.filter(s=>!used.has(s.step_id)))edge(g,stateNodes.get(step.step_id)!,final,'planned target','hasPlannedTarget','Planning target only; no mass balance, yield or execution is inferred.',true);
 return g;
}
export function graphJson(g:VisualGraph){return JSON.stringify(g,null,2)+'\n';}
const lit=(s:unknown)=>JSON.stringify(String(s));
export function graphTurtle(g:VisualGraph){
 const lines=['@prefix icon: <'+V+'> .','@prefix dct: <http://purl.org/dc/terms/> .','@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .','@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',''];
 lines.push('@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .');
 lines.push('<'+g.nodes[0].id+'/graph> a icon:PlanningGraph ; rdfs:label '+lit(g.title)+' ; icon:sourceKind '+lit(g.source_kind)+' ; icon:workflowId '+lit(g.workflow_id)+' ; icon:savedRevision '+lit(g.revision??'not saved')+' ; dct:references <'+VISUAL_PAPER.doi+'> .');
 for(const n of g.nodes){lines.push('<'+n.id+'> a icon:'+(n.kind==='process'&&n.pattern!=='SubprocessSet'?'PlannedProcess':n.kind==='material'?'PlannedMaterialState':'VisualContextGroup')+' ; rdfs:label '+lit(n.title)+' ; icon:scope '+lit(n.scope)+' ; icon:patternRole '+lit(n.pattern)+' ; dct:references <'+VISUAL_PAPER.doi+'> .');for(const item of n.items){lines.push('<'+n.id+'> icon:displayRecord '+lit(item.label+' · '+item.detail)+' .');if(item.url&&/^https?:\/\//.test(item.url))lines.push('<'+n.id+'> dct:source <'+item.url.replaceAll('>','%3E').replaceAll('<','%3C')+'> .');}}
 for(const n of g.nodes)for(const [i,item] of n.items.entries()){
  const id=n.id+'/record/'+(i+1);lines.push('<'+n.id+'> icon:hasRecord <'+id+'> .','<'+id+'> rdfs:label '+lit(item.label)+' ; icon:scope '+lit(item.detail)+' .');
  if(item.evidence_id)lines.push('<'+id+'> icon:supportedBy <'+BASE+'id/evidence/'+encodeURIComponent(item.evidence_id)+'> .');
  if(item.equipment_id)lines.push('<'+id+'> icon:catalogModel <'+BASE+'id/equipment/'+encodeURIComponent(item.equipment_id)+'> .');
  if(item.quantity){const q=item.quantity,definition=CONDITION_DEFINITIONS[q.quantity_kind],quantityKind=definition?BASE+'id/quantity-kind/'+encodeURIComponent(q.quantity_kind):id+'/quantity-kind';lines.push('<'+id+'> icon:operator '+lit(q.operator)+' ; icon:reportedUnit '+lit(q.unit)+' ; icon:quantityKind <'+quantityKind+'> .');if(!definition)lines.push('<'+quantityKind+'> a icon:QuantityKind ; rdfs:label '+lit(q.quantity_kind)+' .');for(const [key,value] of [['reportedValue',q.value],['reportedUpperValue',q.upper_value]] as const)if(value!==null)lines.push('<'+id+'> icon:'+key+' '+lit(value)+'^^xsd:double .');if(q.text_value)lines.push('<'+id+'> icon:reportedText '+lit(q.text_value)+' .');}
 }
 for(const e of g.edges){lines.push('<'+e.source+'> <'+e.predicate+'> <'+e.target+'> .');lines.push('<'+g.nodes[0].id+'/relationship/'+e.id+'> a rdf:Statement ; rdf:subject <'+e.source+'> ; rdf:predicate <'+e.predicate+'> ; rdf:object <'+e.target+'> ; rdfs:label '+lit(e.label)+' ; icon:scope '+lit(e.basis)+' ; icon:requiresReview '+(e.tentative?'true':'false')+' .');}
 return lines.join('\n')+'\n';
}
export function graphIssues(g:VisualGraph){const ids=new Set(g.nodes.map(n=>n.id));return [...(ids.size===g.nodes.length?[]:['Duplicate node ID']),...g.edges.filter(e=>!ids.has(e.source)||!ids.has(e.target)).map(e=>'Unresolved relationship '+e.id)];}
export function wrapGraphLabel(text:string,limit=28,lines=2){const words=text.split(/\s+/).flatMap(w=>w.match(new RegExp('.{1,'+Math.max(1,limit)+'}','gu'))||[]),result:string[]=[];let current='';for(const word of words){if(current&&(current+' '+word).length>limit){result.push(current);current=word;}else current+=(current?' ':'')+word;}if(current)result.push(current);return result.length>lines?[...result.slice(0,lines-1),result.slice(lines-1).join(' ').slice(0,limit-1)+'…']:result;}
