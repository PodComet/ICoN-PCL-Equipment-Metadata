import type {ProcessWorkflow} from './process-lib.ts';
export const OUTPUT_EVIDENCE_KEY='output_evidence_namespace';
const namespace=/^OUT-EV-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function outputNamespace(w:ProcessWorkflow){
 const saved=w.extensions[OUTPUT_EVIDENCE_KEY];if(typeof saved==='string'&&namespace.test(saved))return saved;
 const fallback='OUT-EV-'+w.steps[0]?.step_id.slice(5);if(namespace.test(fallback))return fallback;
 throw new Error('Output evidence requires a stable process-step identity.');
}
export function withOutputEvidence(w:ProcessWorkflow):ProcessWorkflow{
 if(w.extensions[OUTPUT_EVIDENCE_KEY]!==undefined&&(typeof w.extensions[OUTPUT_EVIDENCE_KEY]!=='string'||!namespace.test(w.extensions[OUTPUT_EVIDENCE_KEY] as string)))throw new Error('Invalid output evidence namespace.');
 return {...w,extensions:{...w.extensions,[OUTPUT_EVIDENCE_KEY]:outputNamespace(w)}};
}
export function productEvidence(w:ProcessWorkflow,index:number){
 const id=outputNamespace(w)+'-OUTPUT-'+(index+1);return {output_id:id,evidence_id:id,evidence_status:'planned_output',validation_status:'experimental_validation_roadmap',workflow_id:w.workflow_id};
}
export function propertyEvidenceId(w:ProcessWorkflow,outputIndex:number,anchorId:string){
 return productEvidence(w,outputIndex).evidence_id+'-'+anchorId;
}
