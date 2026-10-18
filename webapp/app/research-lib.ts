import type {Equipment,Route} from './catalog-lib.ts';
export const RESEARCH_KINDS={space:'Space',project:'Project',collection:'Collection',object:'Object',dataset:'Data set'} as const;
export type ResearchKind=keyof typeof RESEARCH_KINDS;
export const RESEARCH_TYPES={space:['SPACE'],project:['PROJECT'],collection:['EXPERIMENT','STUDY'],object:['SAMPLE','MATERIAL','PROTOCOL','INSTRUMENT','EXPERIMENTAL_STEP'],dataset:['RAW_DATA','PROCESSED_DATA','ATTACHMENT']} as const;
export const RESEARCH_STATUSES=['planned','in_progress','completed','failed','withdrawn'] as const;
export const RESEARCH_LICENSES=[{value:'',label:'Not specified · permission required'},{value:'https://creativecommons.org/licenses/by/4.0/',label:'CC BY 4.0'},{value:'https://creativecommons.org/publicdomain/zero/1.0/',label:'CC0 1.0'},{value:'https://opensource.org/license/mit/',label:'MIT'}];
export type Creator={name:string;orcid:string;affiliation:string;ror:string};
export type ResearchRelation={relation:'used'|'wasDerivedFrom'|'wasGeneratedBy';target_id:string};
export type Variable={name:string;source_header:string;unit_text:string;unit_code:string;unit_uri:string;unit_status:'recognized'|'not_stated'|'unmapped';value_type:string;description:string};
export type FileExtraction={extractor:string;format:string;row_count:number|null;variables:Variable[];reported_metadata:Record<string,string>;warnings:string[]};
export type ResearchFile={file_id:string;filename:string;size_bytes:number;sha256:string;media_type:string;extraction:FileExtraction};
export type ResearchRecord={schema:'iconpcl-research/v1';record_id:string;kind:ResearchKind;code:string;name:string;description:string;container_id:string;type_code:string;status:typeof RESEARCH_STATUSES[number];creators:Creator[];license_uri:string;access_scope:'private'|'space';process_ids:string[];material_ids:string[];equipment_ids:string[];category_ids:string[];relations:ResearchRelation[];workflow_id:string;workflow_revision:number|null;acquisition_time:string;properties:Record<string,unknown>;notes:string;files:ResearchFile[]};
export type SavedResearch={record:ResearchRecord;revision:number;created_at:string;updated_at:string;can_edit:boolean;space_id:string};
export const newResearchId=()=> 'RSR-'+crypto.randomUUID();
export const researchUrn=(id:string)=>'urn:uuid:'+id.slice(4);
export const recordIdPattern=/^RSR-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const ancestors:Record<ResearchKind,ResearchKind[]>={space:[],project:['space'],collection:['project'],object:['space','project','collection'],dataset:['collection','object']};
export function blankResearch(kind:ResearchKind='space'):ResearchRecord{return {schema:'iconpcl-research/v1',record_id:'',kind,code:'',name:'',description:'',container_id:'',type_code:RESEARCH_TYPES[kind][0],status:'planned',creators:[{name:'',orcid:'',affiliation:'',ror:''}],license_uri:'',access_scope:'private',process_ids:[],material_ids:[],equipment_ids:[],category_ids:[],relations:[],workflow_id:'',workflow_revision:null,acquisition_time:'',properties:{},notes:'',files:[]};}
function text(value:unknown,max:number,label:string,required=false):asserts value is string{if(typeof value!=='string'||value.length>max||required&&!value.trim())throw new Error('Enter '+label+' (up to '+max+' characters).');}
function cleanJson(value:unknown,depth=0):void{
 if(depth>8)throw new Error('Structured properties exceed eight levels.');
 if(value===null||typeof value==='boolean'||typeof value==='string')return;
 if(typeof value==='number'&&Number.isFinite(value))return;
 if(typeof value!=='object')throw new Error('Properties must contain JSON values.');
 for(const [key,item] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw new Error('Reserved property name.');cleanJson(item,depth+1);}
}
export function validOrcid(value:string){
 const raw=value.replace(/^https:\/\/orcid\.org\//,'');if(!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(raw))return false;
 let total=0;for(const char of raw.replaceAll('-','').slice(0,15))total=(total+Number(char))*2;
 const check=(12-total%11)%11;return raw.at(-1)===(check===10?'X':String(check));
}
export function validateResearch(value:unknown,available:ResearchRecord[],equipment:Equipment[],routes:Route[],previous?:ResearchRecord):ResearchRecord{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid research record.');
 const r=structuredClone(value) as ResearchRecord;
 if(Object.keys(r).some(key=>!Object.hasOwn(blankResearch(),key)))throw new Error('Unknown research record field.');
 if(r.schema!=='iconpcl-research/v1'||!Object.hasOwn(RESEARCH_KINDS,r.kind))throw new Error('Choose a supported record kind.');
 if(r.record_id&&!recordIdPattern.test(r.record_id))throw new Error('Invalid system identifier.');
 text(r.code,80,'a code',true);if(!/^[A-Z][A-Z0-9_-]*$/.test(r.code))throw new Error('Codes start with a letter and use uppercase letters, numbers, underscores or hyphens.');
 text(r.name,240,'a name',true);text(r.description,6000,'a description');text(r.notes,20000,'ELN notes');text(r.container_id,100,'a container');
 if(!RESEARCH_TYPES[r.kind].some(t=>t===r.type_code)||!RESEARCH_STATUSES.includes(r.status))throw new Error('Invalid type or status.');
 if(previous&&(r.record_id!==previous.record_id||r.kind!==previous.kind||r.container_id!==previous.container_id||r.code!==previous.code||r.type_code!==previous.type_code))throw new Error('System identity, code, type, kind and container remain stable; create a linked record to reorganize.');
 if(previous?.status==='withdrawn'&&r.status!=='withdrawn')throw new Error('Withdrawn records remain withdrawn. Create a linked replacement record.');
 if(previous?.status==='completed'&&r.status!=='completed'&&r.status!=='withdrawn'&&available.some(x=>x.relations.some(edge=>edge.target_id===r.record_id&&edge.relation!=='used')))throw new Error('Observed outputs reference this completed source. Withdraw it rather than reverting its experimental status.');
 if(r.kind==='space'){if(r.container_id)throw new Error('A Space is top level.');}
 else{const parent=available.find(x=>x.record_id===r.container_id);if(!parent||!ancestors[r.kind].includes(parent.kind))throw new Error('Choose a compatible container.');}
 if(available.some(x=>x.record_id!==r.record_id&&x.container_id===r.container_id&&x.kind===r.kind&&x.code===r.code))throw new Error('This code already exists in this container.');
 if(!['private','space'].includes(r.access_scope)||!RESEARCH_LICENSES.some(l=>l.value===r.license_uri))throw new Error('Choose access and reuse rights.');
 if(!Array.isArray(r.creators)||r.creators.length>20)throw new Error('Use up to twenty creators.');
 for(const c of r.creators){text(c.name,180,'creator name');text(c.orcid,80,'ORCID');text(c.affiliation,300,'affiliation');text(c.ror,100,'ROR');if(c.orcid&&!validOrcid(c.orcid))throw new Error('ORCID checksum or format is invalid.');if(c.ror&&!/^https:\/\/ror\.org\/[0-9a-z]{9}$/.test(c.ror))throw new Error('Use an https://ror.org/ organization identifier.');}
 const known=new Map(equipment.map(e=>[e.equipment_id,e]));
 for(const [key,allowed] of [['equipment_ids',new Set(known.keys())],['process_ids',new Set(routes.filter(x=>x.route_id.startsWith('P')).map(x=>x.route_id))],['material_ids',new Set(routes.filter(x=>x.route_id.startsWith('N')).map(x=>x.route_id))]] as const){if(!Array.isArray(r[key])||r[key].length>100||r[key].some(x=>!allowed.has(x)))throw new Error('Unresolved ontology '+key+'.');r[key]=[...new Set(r[key])];}
 r.category_ids=[...new Set(r.equipment_ids.map(id=>known.get(id)!.category_id))];
 if(!Array.isArray(r.relations)||r.relations.length>100)throw new Error('Use up to 100 qualified relationships.');
 const edges=new Map(available.map(x=>[x.record_id,x.relations]));edges.set(r.record_id,r.relations);
 const relationKeys=new Set<string>();
 const historicalWithdrawal=(previous?.status==='completed'||previous?.status==='withdrawn')&&r.status==='withdrawn'&&JSON.stringify(r.relations)===JSON.stringify(previous.relations);
 for(const relation of r.relations){
  const target=available.find(x=>x.record_id===relation.target_id);if(!target||target.record_id===r.record_id||!['used','wasDerivedFrom','wasGeneratedBy'].includes(relation.relation))throw new Error('Unresolved or self-referencing relationship.');
  const key=relation.relation+relation.target_id;if(relationKeys.has(key))throw new Error('Duplicate relationship.');relationKeys.add(key);
  const observedTarget=target.status==='completed'||target.status==='withdrawn'&&previous?.relations.some(edge=>edge.relation===relation.relation&&edge.target_id===relation.target_id);
  if(relation.relation==='wasGeneratedBy'&&(r.type_code==='EXPERIMENTAL_STEP'||!['object','dataset'].includes(r.kind)||target.type_code!=='EXPERIMENTAL_STEP'||!historicalWithdrawal&&(!observedTarget||r.status!=='completed')))throw new Error('wasGeneratedBy requires a completed experimental step and an observed/completed output. Planned outputs are not experimental results.');
  if(relation.relation==='used'&&(r.type_code!=='EXPERIMENTAL_STEP'||!['object','dataset'].includes(target.kind)||target.type_code==='EXPERIMENTAL_STEP'||r.status!=='completed'&&!historicalWithdrawal))throw new Error('used describes an entity used by a completed experimental step; keep planned inputs in the protocol notes.');
  if(relation.relation==='wasDerivedFrom'&&(r.type_code==='EXPERIMENTAL_STEP'||target.type_code==='EXPERIMENTAL_STEP'||!['object','dataset'].includes(r.kind)||!['object','dataset'].includes(target.kind)||!historicalWithdrawal&&(r.status!=='completed'||!observedTarget)))throw new Error('wasDerivedFrom requires observed/completed source and result entities.');
 }
 const path=new Set<string>(),visited=new Set<string>();function visit(id:string){if(path.has(id))throw new Error('Lineage must not contain a cycle.');if(visited.has(id))return;if(path.size>100)throw new Error('Lineage exceeds 100 levels.');path.add(id);for(const edge of edges.get(id)||[])visit(edge.target_id);path.delete(id);visited.add(id);}visit(r.record_id);
 text(r.workflow_id,150,'a workflow reference');if(r.workflow_id&&!/^PROC-P\d{2,3}-[0-9a-f-]{36}$/i.test(r.workflow_id))throw new Error('Choose a saved protocol plan.');
 if(r.workflow_revision!==null&&(!Number.isSafeInteger(r.workflow_revision)||r.workflow_revision<1))throw new Error('Invalid saved workflow revision.');
 text(r.acquisition_time,50,'an acquisition timestamp');if(r.acquisition_time&&(!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(r.acquisition_time)||!Number.isFinite(Date.parse(r.acquisition_time))))throw new Error('Acquisition time needs an ISO 8601 timezone.');
 if(!r.properties||typeof r.properties!=='object'||Array.isArray(r.properties)||JSON.stringify(r.properties).length>24000)throw new Error('Structured properties must be a JSON object under 24 KB.');cleanJson(r.properties);
 if(!Array.isArray(r.files)||r.files.length>20)throw new Error('Invalid file manifest.');
 return r;
}
export function rootSpace(record:ResearchRecord,all:ResearchRecord[]){let current=record;const seen=new Set<string>();while(current.kind!=='space'){if(seen.has(current.record_id))throw new Error('Container cycle.');seen.add(current.record_id);const parent=all.find(r=>r.record_id===current.container_id);if(!parent)throw new Error('Missing containing Space.');current=parent;}return current.record_id;}
export function fairReadiness(r:ResearchRecord){return [
 {principle:'F1',label:'Identifier',status:'partial',detail:'Stable UUID and authenticated landing link. No registered DOI/Handle or external persistence guarantee.'},
 {principle:'F2',label:'Rich metadata',status:r.description&&r.creators.some(c=>c.name)?'supported':'missing',detail:'Title, description, creator, context and ontology links.'},
 {principle:'F3 / F4',label:'Linked and searchable',status:'supported',detail:'Identifier is included in metadata and indexed in the authorized research catalog.'},
 {principle:'A1 / A1.2',label:'Controlled access',status:'supported',detail:'HTTPS retrieval with sign-in; explicit Space sharing for selected records.'},
 {principle:'A2',label:'Retained metadata',status:'partial',detail:'Withdrawing data retains metadata and history within the same access rules. Long-term repository preservation is not configured.'},
 {principle:'I1 / I3',label:'Interoperable provenance',status:'supported',detail:'JSON-LD, RO-Crate and typed PROV relationships; planned and executed steps remain distinct.'},
 {principle:'I2',label:'Controlled terms and units',status:r.files.some(f=>f.extraction.variables.some(v=>v.unit_status==='unmapped'))?'partial':'supported',detail:'P/M/N references and recognized UCUM units; unrecognized source units remain explicit.'},
 {principle:'R1.1',label:'Reuse rights',status:r.license_uri?'supported':'missing',detail:r.license_uri||'No reuse license selected. Permission is required; export does not grant rights.'},
 {principle:'R1.2',label:'Provenance',status:r.files.length||r.relations.length?'supported':'partial',detail:'File digests, extractor versions, creator declarations, qualified lineage and saved revisions.'},
 {principle:'R1.3',label:'Community conventions',status:'partial',detail:'openBIS-style terms, RO-Crate 1.3 and DataCite 4.7-aligned drafts; no formal FAIR certification or live openBIS connection.'},
 ] as {principle:string;label:string;status:string;detail:string}[];}
