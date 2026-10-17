import {env} from 'cloudflare:workers';
import seed from './data/positions.json';
import type {PositionLibrary,PositionProfile,PositionEvidence} from './position-lib';
export async function loadPositionLibrary(){
 const library=structuredClone(seed) as PositionLibrary;
 const rows=await env.DB!.prepare('SELECT payload FROM position_profile_edits').all<{payload:string}>();
 const profiles=new Map(library.profiles.map(p=>[p.equipment_id,p]));const seedIds=new Set(library.evidence.flatMap(g=>g.entries.map(e=>e.id))),extra=new Map<string,PositionEvidence['entries'][number]>();
 for(const row of rows.results){const saved=JSON.parse(row.payload) as {after:PositionProfile;evidence:PositionEvidence[]};profiles.set(saved.after.equipment_id,saved.after);for(const group of saved.evidence)for(const entry of group.entries)if(!seedIds.has(entry.id)&&!extra.has(entry.id))extra.set(entry.id,entry);}
 const revision=await env.DB!.prepare("SELECT revision FROM catalog_meta WHERE id='positions'").first<{revision:number}>();
 return {library:{profiles:[...profiles.values()],evidence:[...library.evidence,...(extra.size?[{schema:'poly-evidence/v1',namespace:'uploaded',subject:{scope:'Administrator-uploaded claims'},entries:[...extra.values()]}]:[])]} as PositionLibrary,revision:revision?.revision||0};
}
