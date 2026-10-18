import {env} from 'cloudflare:workers';
import type {EvidenceRecord} from './evidence-lib';
/** Joined to the originating save's D1 batch, so failed/concurrent saves leave no evidence. */
export function evidenceStatements(records:EvidenceRecord[],ownerId:string){
 const chunks:EvidenceRecord[][]=[];let chunk:EvidenceRecord[]=[],bytes=0;
 for(const record of records){const size=new TextEncoder().encode(JSON.stringify(record)).length;if(bytes+size>350000&&chunk.length){chunks.push(chunk);chunk=[];bytes=0;}chunk.push(record);bytes+=size;}if(chunk.length)chunks.push(chunk);
 return chunks.map(items=>env.DB!.prepare("INSERT INTO evidence_records(evidence_id,owner_id,record_kind,subject_id,revision,payload,created_at) SELECT json_extract(value,'$.evidence_id'),?,json_extract(value,'$.record_kind'),coalesce(json_extract(value,'$.context.workflow.workflow_id'),json_extract(value,'$.context.workflow_id'),json_extract(value,'$.context.subject.equipment_id'),json_extract(value,'$.context.sequence_evidence_id'),''),coalesce(json_extract(value,'$.context.revision'),json_extract(value,'$.context.workflow_revision'),0),value,json_extract(value,'$.recorded_at') FROM json_each(?)").bind(ownerId,JSON.stringify(items)));
}
