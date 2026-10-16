import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterReferences,instrumentReferenceLinks,sortReferences,referenceCitation,metadataCheckLabel} from '../app/references-lib.ts';
const data=JSON.parse(readFileSync(new URL('../app/data/references.json',import.meta.url),'utf8'));

test('reference order is chronological, reversible and stable with undated records last',()=>{
 const original=data.references.map(r=>r.reference_id),unknown={...data.references[0],reference_id:'UNDATED',publication_year:'',publication_date:''};
 for(const newest of [false,true]){
  const sorted=sortReferences([unknown,...data.references],newest);
  assert.equal(sorted.at(-1).reference_id,'UNDATED');
  const years=sorted.slice(0,-1).map(r=>Number(r.publication_year));
  assert.deepEqual(years,[...years].sort((a,b)=>newest?b-a:a-b));
 }
 assert.deepEqual(data.references.map(r=>r.reference_id),original);
});
test('library searches authors, DOI, filenames and topics and combines type filters',()=>{
 assert.equal(filterReferences(data,'Ghiringhelli').length,1);
 assert.equal(filterReferences(data,'10.3390/app142411683').length,1);
 const byFile=filterReferences(data,'Ontology 2026');assert.equal(byFile.length,1);assert.equal(byFile[0].publication_year,'2024');
 assert.equal(filterReferences(data,'','machine_learning','preprint').length,1);
 assert.equal(filterReferences(data,'no such article').length,0);
});
test('project and category context never imply inherited exact-model support',()=>{
 const base={equipment_id:'MODEL-A',model_name:'A',category_id:'M13',related_material_ids:'N02',related_process_ids:'P01'};
 const links=[
  {link_id:'a',target_type:'project',target_id:'ICoN-PCL',relation:'background'},
  {link_id:'b',target_type:'equipment',target_id:'MODEL-A',relation:'supports_claim'},
  {link_id:'c',target_type:'category',target_id:'M13',relation:'supports_claim'},
  {link_id:'d',target_type:'route',target_id:'N02',relation:'background'},
  {link_id:'e',target_type:'category',target_id:'M13',relation:'background'},
 ];
 assert.deepEqual(instrumentReferenceLinks(base,links).map(l=>l.link_id),['b','d','e']);
 assert.deepEqual(instrumentReferenceLinks({...base,equipment_id:'NEW-VARIANT'},links).map(l=>l.link_id),['d','e']);
 assert.deepEqual(instrumentReferenceLinks({...base,category_id:'M01',related_material_ids:''},links).map(l=>l.link_id),['b']);
});
test('expanded library stays academic-only and preserves scoped model evidence',()=>{
 assert.equal(data.references.length,28);assert.equal(data.reference_files.length,25);
 assert.equal(data.reference_links.filter(l=>l.relation==='supports_claim').length,33);
 assert.ok(data.references.every(r=>['journal_article','conference_paper','preprint'].includes(r.reference_type)));
 assert.ok(data.references.every(r=>referenceCitation(r).includes(r.title)));
 assert.equal(JSON.parse(data.exports.csl_json).length,28);
 assert.ok(data.references.every(r=>!JSON.stringify(r).includes('C:\\')));
});

test('online full-text checks are not mislabeled as PDF checks',()=>{assert.equal(metadataCheckLabel('full_text_and_registry_checked'),'Full text + registry checked');assert.equal(metadataCheckLabel('unknown'),'Metadata needs review');});
