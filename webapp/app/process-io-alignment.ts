import type {Equipment} from './catalog-lib.ts';
import {equipmentIOText} from './equipment-io.ts';
import {processDependencyGraph} from './process-dependencies.ts';
import {workflowReadiness,type Parameters,type ProcessInstrument,type ProcessWorkflow} from './process-lib.ts';

export type InterfaceMatch={label:string;output:string;input:string;basis:'description'|'configured_port'};
export type InstrumentConnection={fromStep:string;toStep:string;fromSlot:string;toSlot:string;fromModel:string;toModel:string;match:InterfaceMatch|null};
export type ProcessIOAlignment={connections:InstrumentConnection[];matched:InstrumentConnection[];allAligned:boolean;stageConnections:number;unmatchedStages:number;equipmentComplete:boolean};
type Port={name:string;text:string;unit:string};
type Interface={text:string;ports:Port[]};
const identity=(s:string|undefined)=>(s||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
const unknown=/\b(?:not established|not recorded|not specified|not supplied|unavailable|unreported|unknown|unverified|not verified|review required|awaiting|no source|not determined)\b/i;
const qualified=/^\s*(?:sources?\s*:|source-listed|other (?:input|output)|exact .*remain|full .*not|partial family reference|\[automatic extraction)/i;

function configuredPorts(parameters:Parameters):Port[]{
 return Object.entries(parameters).flatMap(([name,value])=>{
  if(value===null||/^(?:evidence_ids?|source|notes|description|schema)$/i.test(name))return [];
  const structured=typeof value==='object'&&!Array.isArray(value)?value:null;
  const scalar=structured?structured.value:value;
  if(!['string','number','boolean'].includes(typeof scalar))return [];
  const text=String(scalar);if(!text.trim()||unknown.test(text))return [];
  return [{name,text,unit:typeof structured?.unit==='string'?structured.unit.trim():''}];
 });
}

function instrumentInterface(instrument:ProcessInstrument,direction:'inputs'|'outputs',current?:Equipment):Interface{
 const ports=configuredPorts(instrument[direction]);
 // Explicit per-occurrence ports take precedence over generic model descriptions.
 if(Object.keys(instrument[direction]).length)return {ports,text:ports.filter(p=>/[a-z]/i.test(p.text)&&!/^(?:true|false|high|low|on|off|yes|no)$/i.test(p.text)).map(p=>p.name+': '+p.text).join('\n')};
 const snapshot=instrument.equipment_snapshot,field=direction==='inputs'?'inputs_and_states':'outputs_and_states';
 const exact=current&&current.equipment_id===snapshot.equipment_id&&identity(current.manufacturer)===identity(snapshot.manufacturer)&&identity(current.model_name)===identity(snapshot.model_name)&&identity(current.capacity_ml)===identity(snapshot.capacity_ml);
 const source=Object.hasOwn(snapshot,field)?snapshot:exact?current:undefined;
 return {ports:[],text:equipmentIOText(source?.[field])};
}

// Flow items and explicitly named data products only. Power, voltage, speed,
// channel counts, common units and generic operation words cannot create a match.
const concepts:[string,RegExp][]=[
 ['liquid / solution',/\b(?:liquids?|fluids?|solutions?|solvents?|suspensions?|dispersions?|emulsions?|slurr(?:y|ies)|inks?|supernatants?)\b/i],
 ['powder',/\b(?:powders?|dry particulates?)\b/i],
 ['solid material',/\bsolids?\b/i],
 ['substrate / wafer',/\b(?:substrates?|wafers?|coupons?|slides?)\b/i],
 ['workpiece',/\b(?:workpieces?|machined parts?|metal stock)\b/i],
 ['sample / specimen',/\b(?:samples?|specimens?|objects?|vessel contents|contents of (?:the |a )?vessel)\b/i],
 ['labware / container',/\b(?:labware|plates?|tubes?|vials?|vessels?|containers?)\b/i],
 ['nanoparticles',/\bnanoparticles?\b/i],
 ['nanofibers / fibers',/\b(?:nano)?fib(?:er|re)s?\b/i],
 ['film / coating',/\b(?:thin films?|nanofilms?|coated substrates?|coatings?)\b/i],
 ['pellet / sediment',/\b(?:pellets?|sediments?)\b/i],
 ['gas stream',/\b(?:gas(?:es)?|gaseous|argon|nitrogen|oxygen|hydrogen)\b/i],
 ['laser / optical beam',/\b(?:laser (?:beams?|pulses?)|optical beams?|excitation light)\b/i],
 ['image data',/\b(?:images?|image data|micrographs?)\b/i],
 ['spectral data',/\b(?:spectra|spectrum|spectral data)\b/i],
 ['measurement data',/\b(?:measurement data|recorded measurements?|measurement records?)\b/i],
];
const formRules:[string,RegExp][]=[
 ['liquid',concepts[0][1]],['powder',concepts[1][1]],['solid',concepts[2][1]],
 ['substrate',concepts[3][1]],['workpiece',concepts[4][1]],['fiber',concepts[8][1]],
 ['film',concepts[9][1]],['pellet',concepts[10][1]],['gas',concepts[11][1]],
];
const elements=new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '));
const namedSubstances:[string,RegExp][]=[['H2O',/\bwater\b/i],['ethanol',/\b(?:ethanol|ethyl alcohol|etoh)\b/i],['isopropanol',/\b(?:isopropanol|isopropyl alcohol)\b/i],['acetone',/\bacetone\b/i],['Ar',/\bargon\b/i],['N2',/\bnitrogen\b/i],['O2',/\boxygen\b/i],['H2',/\bhydrogen\b/i]];
function substances(text:string){
 const result=new Set(namedSubstances.filter(([,r])=>r.test(text)).map(([id])=>id));
 for(const m of text.matchAll(/\b(?:[A-Z][a-z]?\d*){2,}\b/g)){
  const symbols=[...m[0].matchAll(/([A-Z][a-z]?)(\d*)/g)];
  if(symbols.every(s=>elements.has(s[1])))result.add(m[0]);
 }
 return result;
}
function formsCompatible(output:string,input:string){
 const a=formRules.filter(([,r])=>r.test(output)).map(([id])=>id),b=formRules.filter(([,r])=>r.test(input)).map(([id])=>id);
 if(!a.length||!b.length)return true;
 if(a.some(v=>b.includes(v)))return true;
 const solids=['powder','substrate','workpiece','fiber','film','pellet'];
 return a.includes('solid')&&b.some(v=>solids.includes(v))||b.includes('solid')&&a.some(v=>solids.includes(v));
}
function clauses(text:string){
 return text.replace(/https?:\/\/\S+/g,'').split(/\n|;|\.\s+(?=[A-Z])/).map(s=>s.trim()).filter(s=>s&&!qualified.test(s)&&!unknown.test(s)&&!/^\s*(?:no|not|without)\b/i.test(s));
}

export function matchInstrumentIO(from:ProcessInstrument,to:ProcessInstrument,currentFrom?:Equipment,currentTo?:Equipment):InterfaceMatch|null{
 const output=instrumentInterface(from,'outputs',currentFrom),input=instrumentInterface(to,'inputs',currentTo);
 for(const a of output.ports)for(const b of input.ports){
  if(identity(a.name)===identity(b.name)&&identity(a.text)===identity(b.text)&&a.unit===b.unit)
   return {label:a.name,output:a.text+(a.unit?' '+a.unit:''),input:b.text+(b.unit?' '+b.unit:''),basis:'configured_port'};
 }
 for(const a of clauses(output.text))for(const b of clauses(input.text)){
  if(!formsCompatible(a,b))continue;
  const sa=substances(a),sb=substances(b);
  if(sa.size&&sb.size&&![...sa].some(s=>sb.has(s)))continue;
  const substance=[...sa].find(s=>sb.has(s));
  if(substance)return {label:substance,output:a,input:b,basis:'description'};
  const same=concepts.find(([,r])=>r.test(a)&&r.test(b));
  if(same)return {label:same[0],output:a,input:b,basis:'description'};
 }
 return null;
}

/** Compare only declared parent→child stages; peer slots have no invented order. */
export function processIOAlignment(workflow:ProcessWorkflow,records:Equipment[]=[],sourceSteps:Record<string,string>[]=[]):ProcessIOAlignment{
 const graph=processDependencyGraph(workflow),byId=new Map(records.map(r=>[r.equipment_id,r]));
 const connections:InstrumentConnection[]=[],stagePairs:{from:string;to:string}[]=[];
 for(const target of workflow.steps)for(const parentId of graph.dependencies.get(target.step_id)||[]){
  stagePairs.push({from:parentId,to:target.step_id});
  const parent=workflow.steps.find(s=>s.step_id===parentId);if(!parent)continue;
  for(const from of parent.slots)for(const to of target.slots){
   if(!from.instrument||!to.instrument)continue;
   connections.push({fromStep:parentId,toStep:target.step_id,fromSlot:from.slot_id,toSlot:to.slot_id,fromModel:from.instrument.equipment_snapshot.model_name,toModel:to.instrument.equipment_snapshot.model_name,match:matchInstrumentIO(from.instrument,to.instrument,byId.get(from.instrument.equipment_id),byId.get(to.instrument.equipment_id))});
  }
 }
 const matched=connections.filter(c=>c.match),unmatchedStages=stagePairs.filter(p=>!matched.some(c=>c.fromStep===p.from&&c.toStep===p.to)).length;
 const equipmentComplete=workflowReadiness(workflow,sourceSteps).complete;
 // The frame follows the visible stage-to-stage checks exactly. Ancillary
 // machines and equipment completeness are separate from handoff alignment.
 return {connections,matched,stageConnections:stagePairs.length,unmatchedStages,equipmentComplete,allAligned:!graph.errors.length&&stagePairs.length>0&&!unmatchedStages};
}

export function connectionLabel(connection:InstrumentConnection){
 const m=connection.match;
 return m?`${connection.fromModel} → ${connection.toModel}: ${m.label}. Output: ${m.output}. Input: ${m.input}. ${m.basis==='configured_port'?'Matching configured port and value.':'Matching I/O description; composition, quantities and operating limits are not checked.'}`:'';
}
