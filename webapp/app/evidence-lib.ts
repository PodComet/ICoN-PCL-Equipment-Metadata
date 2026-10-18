export type EvidenceLink={record_type:string;record_id:string;label:string};
export type EvidenceRecord={schema:'iconpcl-evidence-record/v1';evidence_id:string;record_kind:'source_claim'|'control_action'|'instrument_sequence'|'workflow_combination'|'planned_output'|'workflow_assessment'|'property_assessment';classification:string;title:string;claim:string;scope:string;recorded_at:string;sources:{title:string;url:string;locator:string;checked_date:string}[];related_records:EvidenceLink[];source_evidence_ids:string[];supersedes_id:string;context:Record<string,unknown>;content_sha256?:string};
export type EvidenceRegister={schema:'iconpcl-evidence-register/v1';scope:string;records:EvidenceRecord[]};
export const evidenceURL=(id:string)=>'/#evidence/'+encodeURIComponent(id);
export function canonicalJSON(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonicalJSON).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJSON((value as Record<string,unknown>)[k])).join(',')+'}';
 return JSON.stringify(value);
}
export async function evidenceDigest(value:unknown){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalJSON(value))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function sealEvidence(record:EvidenceRecord){const copy=structuredClone(record);delete copy.content_sha256;return {...copy,content_sha256:await evidenceDigest(copy)};}
export async function verifyEvidence(record:EvidenceRecord){if(!record.content_sha256)return false;const copy=structuredClone(record);delete copy.content_sha256;return await evidenceDigest(copy)===record.content_sha256;}
export function evidenceMatches(record:EvidenceRecord,query:string,kind='',route=''){
 const text=JSON.stringify(record).toLowerCase();return (!kind||record.record_kind===kind)&&(!route||record.related_records.some(r=>r.record_type==='process'&&r.record_id===route))&&query.trim().toLowerCase().split(/\s+/).filter(Boolean).every(t=>text.includes(t));
}
const md=(s:unknown)=>String(s??'').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('[','\\[').replaceAll(']','\\]');
function actionSummary(r:EvidenceRecord){
 const rows=Array.isArray(r.context.actions)?r.context.actions:r.record_kind==='control_action'?[r.context]:[];
 if(!rows.length)return '';
 return '\n### Ordered Position → Fiber → Direction actions\n\n'+rows.map((value,index)=>{const row=value as {evidence_id?:string;status?:string;action?:{position:string;fiber_id:string;direction:string;notes:string}};const a=row.action;return (index+1)+'. **'+[a?.position,a?.fiber_id,a?.direction].map(v=>md(v||'(unspecified)')).join(' → ')+'** — '+md(a?.notes||'No settings/notes recorded')+'; '+md(row.status||'')+'; '+md(row.evidence_id||r.evidence_id);}).join('\n')+'\n';
}
export function evidenceMarkdown(records:EvidenceRecord[]){return '# Evidence register\n\nSaved user records describe plans, not executed or experimentally validated operations. SHA-256 checks record integrity, not scientific truth.\n\n'+records.map(r=>'## '+md(r.evidence_id)+'\n\n'+md(r.title)+'\n\n'+md(r.claim)+'\n\n- Kind: '+r.record_kind+'\n- Classification: '+r.classification+'\n- Recorded: '+r.recorded_at+'\n- Scope: '+md(r.scope)+'\n'+(r.supersedes_id?'- Supersedes: '+r.supersedes_id+'\n':'')+(r.content_sha256?'- SHA-256: '+r.content_sha256+'\n':'')+'\n### Related records\n\n'+r.related_records.map(x=>'- '+md(x.record_id)+' ('+x.record_type+'): '+md(x.label)).join('\n')+'\n\n### Supporting sources\n\n'+r.sources.map(s=>'- '+md(s.title)+' — '+md(s.locator)+' — '+s.url).join('\n')+actionSummary(r)+'\n\n### Saved context\n\n'+JSON.stringify(r.context,null,2).split('\n').map(l=>'    '+l).join('\n')+'\n').join('\n');}
export function evidenceCSV(records:EvidenceRecord[]){const fields=['evidence_id','record_kind','classification','title','claim','scope','recorded_at','supersedes_id','content_sha256','source_evidence_ids','sources','related_records','context'] as const;const cell=(v:unknown)=>{let s=typeof v==='object'?JSON.stringify(v):String(v??'');if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};return '\ufeff'+[fields.join(','),...records.map(r=>fields.map(f=>cell(r[f])).join(','))].join('\r\n')+'\r\n';}
