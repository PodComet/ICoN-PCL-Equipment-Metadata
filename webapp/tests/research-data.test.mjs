import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {blankResearch,newResearchId,validateResearch,validOrcid,fairReadiness,researchUrn} from '../app/research-lib.ts';
import {extractInstrumentMetadata,instrumentFile,digestBytes,INGEST_LIMIT} from '../app/instrument-ingest-lib.ts';
import {researchCrate,dataCiteDraft,crateFilePath} from '../app/research-export-lib.ts';
import {researchMayRead,normalizedGrantEmail} from '../app/research-access-lib.ts';
import {researchZip,crc32} from '../app/research-zip-lib.ts';
import {ingestFolder} from '../scripts/ingest-instrument-folder.mjs';
const bytes=s=>new TextEncoder().encode(s),equipment=[{equipment_id:'M13-01',model_name:'Synthetic centrifuge',category_id:'M13'}],routes=[{route_id:'P03'},{route_id:'N01'}];
function record(kind,code,parent=''){return {...blankResearch(kind),record_id:newResearchId(),code,name:code,container_id:parent};}
const space=record('space','LAB'),project=record('project','STUDY',space.record_id),collection=record('collection','SERIES',project.record_id);
const sample={...record('object','SAMPLE_1',collection.record_id),status:'completed'},step={...record('object','STEP_1',collection.record_id),type_code:'EXPERIMENTAL_STEP',status:'completed',relations:[{relation:'used',target_id:sample.record_id}]};
const existing=[space,project,collection,sample,step],validate=(r,all=existing,previous)=>validateResearch(r,all,equipment,routes,previous);
const saved=r=>({record:r,revision:1,created_at:'2026-10-17T00:00:00Z',updated_at:'2026-10-17T00:00:00Z',can_edit:true,space_id:space.record_id});

test('RO-Crate unit fields use standard URL or prefixed UCUM codes and retain source units',async()=>{
 const f=await instrumentFile('units.csv',bytes('mass [mg],flow [mL/min],unknown [furlongs]\n2,1,3'));
 const graph=researchCrate(saved({...record('dataset','UNITS',sample.record_id),files:[f]}),[],'https://example.org')['@graph'];
 const variables=graph.filter(n=>n['@type']==='PropertyValue');
 assert.equal(variables[0].unitCode,'http://qudt.org/vocab/unit/MilliGM');
 assert.equal(variables[1].unitCode,'UCUM:mL/min');
 assert.equal(variables[2].unitCode,undefined);
 assert.deepEqual(variables.map(v=>v.unitText),['mg','mL/min','furlongs']);
 assert.ok(variables.every(v=>!('unitID' in v)));
 assert.equal(variables[0]['icon:ucumCode'],'mg');
});
test('openBIS-style containers and canonical model/category links are validated',()=>{
 assert.equal(validate(project).container_id,space.record_id);assert.throws(()=>validate({...project,container_id:collection.record_id}),/compatible/);
 assert.throws(()=>validate({...record('dataset','BAD',space.record_id)}),/compatible/);
 const r=validate({...sample,equipment_ids:['M13-01','M13-01'],category_ids:['FORGED'],process_ids:['P03'],material_ids:['N01']});assert.deepEqual(r.category_ids,['M13']);assert.deepEqual(r.equipment_ids,['M13-01']);
 assert.throws(()=>validate({...sample,process_ids:['P999']}),/ontology/);assert.throws(()=>validate({...sample,owner_id:'forged'}),/Unknown/);
 assert.throws(()=>validate({...sample,code:'CHANGED'},existing,sample),/stable/);assert.throws(()=>validate({...sample,type_code:'INSTRUMENT'},existing,sample),/stable/);
});
test('ORCID checksum, ROR syntax, timezone and JSON limits protect metadata quality',()=>{
 assert.ok(validOrcid('0000-0002-1825-0097'));assert.ok(!validOrcid('0000-0002-1825-0098'));
 assert.throws(()=>validate({...sample,creators:[{name:'A',orcid:'0000-0002-1825-0098',affiliation:'',ror:''}]}),/ORCID/);
 assert.throws(()=>validate({...sample,acquisition_time:'2026-10-17T10:00:00'}),/timezone/);
 assert.throws(()=>validate({...sample,properties:JSON.parse('{"__proto__":{"admin":true}}')}),/Reserved/);
});
test('planned results cannot assert actual generation; qualified lineage rejects cycles and wrong entity types',()=>{
 const output={...record('object','OUTPUT',collection.record_id),status:'completed',relations:[{relation:'wasGeneratedBy',target_id:step.record_id}]};assert.equal(validate(output).relations.length,1);
 assert.throws(()=>validate({...output,status:'planned'}),/Planned outputs/);assert.throws(()=>validate({...output},existing.map(r=>r===step?{...r,status:'planned'}:r)),/completed experimental/);
 assert.throws(()=>validate({...sample,relations:[{relation:'used',target_id:step.record_id}]}),/used describes/);
 assert.throws(()=>validate({...step,relations:[{relation:'wasDerivedFrom',target_id:sample.record_id}]}),/entities/);
 const a={...sample,relations:[{relation:'wasDerivedFrom',target_id:output.record_id}]},b={...output,relations:[{relation:'wasDerivedFrom',target_id:sample.record_id}]};assert.throws(()=>validate(a,[space,project,collection,a,b]),/cycle/);
});
test('withdrawal retains historical lineage while preventing reactivation or reversion of cited completed steps',()=>{
 const output={...record('object','OUTPUT',collection.record_id),status:'completed',relations:[{relation:'wasGeneratedBy',target_id:step.record_id}]};
 assert.throws(()=>validate({...step,status:'planned'},[...existing,output],step),/Withdraw/);
 const withdrawn=validate({...output,status:'withdrawn'},existing,output);assert.equal(withdrawn.relations[0].target_id,step.record_id);assert.throws(()=>validate({...withdrawn,status:'completed'},existing,withdrawn),/remain withdrawn/);
});
test('CSV extraction preserves source units, multiline cells, source metadata and exact row count',async()=>{
 const source='# model: synthetic detector\r\n# acquisition_time: 2026-10-17T10:00:00Z\r\ntime [s],signal [a.u.],temperature [°C],note\r\n0,1.25,25,"line1\n# operator: not metadata"\r\n1,1.50,26,"a,b"\r\n';
 const f=await instrumentFile('test.csv',bytes(source));assert.equal(f.extraction.row_count,2);assert.equal(f.extraction.reported_metadata.model,'synthetic detector');assert.ok(!f.extraction.reported_metadata.operator);
 assert.equal(f.extraction.variables[0].unit_code,'s');assert.equal(f.extraction.variables[2].unit_code,'Cel');assert.equal(f.extraction.variables[1].unit_status,'unmapped');assert.equal(f.sha256,await digestBytes(bytes(source)));
 assert.equal(await digestBytes(bytes('abc')),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('TSV quoted commas/tabs and JSON arrays are parsed without unit guessing',()=>{
 const t=extractInstrumentMetadata('run.tsv',bytes('time [s]\tnote\n1\t"a,b\tinside"\n'));assert.equal(t.extraction.row_count,1);assert.equal(t.extraction.variables.length,2);
 const j=extractInstrumentMetadata('run.json',bytes(JSON.stringify({metadata:{model:'X'},data:[{'mass [mg]':2,'temperature [C]':3},{'mass [mg]':4,'temperature [C]':5}]})));assert.equal(j.extraction.row_count,2);assert.equal(j.extraction.variables[0].unit_code,'mg');assert.equal(j.extraction.variables[1].unit_status,'unmapped');assert.ok(j.extraction.warnings.some(w=>w.includes('not measurement times')));
 const more=extractInstrumentMetadata('large.csv',bytes('time [s],value\n'+Array.from({length:1200},(_,i)=>i+',1').join('\n')));assert.equal(more.extraction.row_count,1200);
});
test('malformed, binary, oversize and unsafe instrument exports are rejected',async()=>{
 for(const source of ['a,a\n1,2','a,b\n1','a,b\n"not closed'])assert.throws(()=>extractInstrumentMetadata('bad.csv',bytes(source)));
 assert.throws(()=>extractInstrumentMetadata('bad.csv',new Uint8Array([0xff,0xfe])),/UTF-8/);assert.throws(()=>extractInstrumentMetadata('bad.exe',bytes('a')),/supports/);assert.throws(()=>extractInstrumentMetadata('bad.txt',new Uint8Array(INGEST_LIMIT+1)),/2 MiB/);
 await assert.rejects(instrumentFile('../secret.csv',bytes('a\n1')),/filename/);assert.throws(()=>extractInstrumentMetadata('bad.json',bytes('[{"":1}]')),/nonempty/);
});
test('access grants never imply editing, public access, or access to other private records',()=>{
 for(const scope of ['private','space'])assert.equal(researchMayRead('owner','owner','dataset',scope,false),true);
 assert.equal(researchMayRead('owner','viewer','dataset','private',true),false);assert.equal(researchMayRead('owner','viewer','dataset','space',false),false);assert.equal(researchMayRead('owner','viewer','dataset','space',true),true);assert.equal(researchMayRead('owner','viewer','space','private',true),true);
 assert.equal(normalizedGrantEmail('A@example.org'),'a@example.org');assert.throws(()=>normalizedGrantEmail('bad'),/valid/);
});
test('RO-Crate graph has unique identifiers and measured variables attach to their File',async()=>{
 const f=await instrumentFile('synthetic.csv',bytes('time [s],mass [mg],value\n1,2,3\n')),r={...record('dataset','DATA',sample.record_id),files:[f],creators:[{name:'A',orcid:'',affiliation:'Research Lab',ror:'https://ror.org/05dxps055'},{name:'B',orcid:'',affiliation:'Research Lab',ror:'https://ror.org/05dxps055'}]};
 const crate=researchCrate(saved(r),[],'https://example.org',true),graph=crate['@graph'],ids=graph.map(n=>n['@id']);assert.equal(new Set(ids).size,ids.length);
 const root=graph.find(n=>n['@id']==='./'),file=graph.find(n=>n['@id']===crateFilePath(f));assert.equal(root['@type'],'Dataset');assert.equal(root.license['@id'],'#permission-required');assert.equal(file.variableMeasured.length,3);assert.ok(file.variableMeasured.every(v=>graph.some(n=>n['@id']===v['@id']&&n['@type']==='PropertyValue')));
 assert.ok(!file['prov:wasGeneratedBy']);const ingestion=graph.find(n=>n['@id']==='#metadata-ingestion-'+f.file_id);assert.equal(ingestion['prov:used']['@id'],crateFilePath(f));assert.notEqual(ingestion['prov:generated']['@id'],crateFilePath(f));assert.ok(!graph.find(n=>n['@id']===researchUrn(r.record_id))['prov:wasGeneratedBy']);
 const draft=dataCiteDraft(saved(r));assert.equal(draft.registration_ready,false);assert.equal(draft.schema_version,'4.7');assert.ok(!draft.attributes.doi);assert.ok(draft.missing_required.some(s=>s.includes('DOI')));
 assert.equal(fairReadiness(r).find(c=>c.principle==='R1.1').status,'missing');
});
test('DataCite draft keeps PROV semantics as qualified Other when no exact controlled equivalent exists',()=>{
 const r={...sample,relations:[{relation:'wasGeneratedBy',target_id:step.record_id}]},related=dataCiteDraft(saved(r)).attributes.relatedIdentifiers[0];assert.equal(related.relationType,'Other');assert.equal(related.relationTypeInformation,'http://www.w3.org/ns/prov#wasGeneratedBy');
});
test('ZIP preserves exact bytes, CRC and safe filenames',()=>{
 const source=bytes('abc'),zip=researchZip([{name:'data/raw.csv',bytes:source}]),view=new DataView(zip.buffer);assert.equal(view.getUint32(0,true),0x04034b50);assert.equal(view.getUint32(14,true),crc32(source));assert.deepEqual(zip.slice(30+bytes('data/raw.csv').length,30+bytes('data/raw.csv').length+3),source);
 assert.throws(()=>researchZip([{name:'../secret',bytes:source}]),/Unsafe/);assert.throws(()=>researchZip([{name:'a',bytes:source},{name:'a',bytes:source}]),/duplicate/);
});
test('drop-folder adapter is idempotent, preserves originals and labels automatic packages for review',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'iconpcl-ingest-')),input=join(temp,'input'),output=join(temp,'packages');await mkdir(input);await writeFile(join(input,'run.csv'),'time [s],mass [mg]\n0,2\n');
 try{const options={input,output,quiet:true,context:{name:'Synthetic export',status:'completed'}};assert.equal((await ingestFolder(options)).imported,1);assert.equal((await ingestFolder(options)).imported,0);assert.equal(await readFile(join(input,'run.csv'),'utf8'),'time [s],mass [mg]\n0,2\n');assert.equal((await readdir(output)).length,1);const zip=await readFile(join(output,(await readdir(output))[0]));assert.ok(zip.includes(bytes('"status": "planned"')));assert.ok(zip.includes(bytes('"review_required": true')));
  await assert.rejects(ingestFolder({...options,output:join(input,'nested')}),/outside/);
 }finally{assert.ok(resolve(temp).startsWith(resolve(tmpdir())+sep));await rm(temp,{recursive:true,force:true});}
});
