import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterReferences,instrumentReferenceLinks,categoryEvidenceLinks,sortReferences,referenceCitation,metadataCheckLabel,authorsWithAffiliations} from '../app/references-lib.ts';
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
 assert.equal(filterReferences(data,'unmatched-reference-query-93817').length,0);
});

test('publication-specific institutions stay with their exact author and are searchable',()=>{
 const r=data.references.find(r=>r.doi==='10.48550/arxiv.2609.01740');
 const authors=authorsWithAffiliations(r,data);
 assert.equal(authors.length,10);
 assert.deepEqual(authors[0].affiliations.map(a=>a.institution),['Zhejiang University']);
 assert.deepEqual(authors[7].affiliations.map(a=>a.institution),['Monash University']);
 assert.deepEqual(authors[8].affiliations.map(a=>a.institution),['University of Adelaide']);
 assert.ok(filterReferences(data,'Zhejiang University').some(x=>x.reference_id===r.reference_id));
 assert.equal(filterReferences(data,'Monash University','does-not-match').length,0);
 const injected={...data,reference_affiliations:[...data.reference_affiliations,{...authors[0].affiliations[0],affiliation_id:'INVALID',author_index:'7',institution:'Incorrect Institution'}]};
 assert.ok(!authorsWithAffiliations(r,injected)[7].affiliations.some(a=>a.institution==='Incorrect Institution'));
 assert.deepEqual(authorsWithAffiliations({...r,reference_id:'OTHER-VERSION'},data).flatMap(a=>a.affiliations),[]);
 assert.deepEqual(authorsWithAffiliations(r,{...data,reference_affiliations:undefined}).flatMap(a=>a.affiliations),[],'Older API payloads remain readable');
});

test('multiple institutions and explicit not-stated cases retain their sources without changing citation names',()=>{
 const r=data.references.find(r=>r.doi==='10.1103/physrevb.95.195404');
 const author=authorsWithAffiliations(r,data)[9];assert.equal(author.affiliations.length,3);
 assert.ok(author.affiliations.every(a=>a.source_url&&a.source_locator));
 const absent=data.references.find(r=>r.doi==='10.5334/dsj-2019-012');
 assert.equal(authorsWithAffiliations(absent,data)[1].affiliations[0].affiliation_status,'not_stated');
 assert.equal(authorsWithAffiliations(absent,data)[1].affiliations[0].institution,'');
 const ghiringhelli=data.references.find(r=>r.doi==='10.1038/s41597-023-02501-8');
 assert.equal(authorsWithAffiliations(ghiringhelli,data)[0].affiliations.length,2,'Present address is excluded');
 assert.ok(!referenceCitation(r).includes('Paul Scherrer Institut'));
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

test('checked category evidence is available separately without granting model support',()=>{
 const record={equipment_id:'MY-MODEL',category_id:'M13'};
 const links=[
  {link_id:'category',target_type:'category',target_id:'M13',relation:'supports_claim',review_status:'claim_checked'},
  {link_id:'unchecked',target_type:'category',target_id:'M13',relation:'supports_claim',review_status:'needs_review'},
  {link_id:'other',target_type:'category',target_id:'M14',relation:'supports_claim',review_status:'claim_checked'},
  {link_id:'model',target_type:'equipment',target_id:'OTHER-MODEL',relation:'supports_claim',review_status:'claim_checked'},
 ];
 assert.deepEqual(categoryEvidenceLinks(record,links).map(l=>l.link_id),['category']);
 assert.deepEqual(instrumentReferenceLinks(record,links),[]);
 assert.deepEqual(categoryEvidenceLinks({...record,category_id:'M01'},links),[]);
});
test('expanded library stays academic-only and preserves scoped model evidence',()=>{
 assert.equal(data.references.length,52);assert.equal(data.reference_files.length,42);
 assert.equal(data.reference_links.filter(l=>l.relation==='supports_claim').length,146);
 assert.ok(data.references.every(r=>['journal_article','conference_paper','preprint'].includes(r.reference_type)));
 assert.ok(data.references.every(r=>referenceCitation(r).includes(r.title)));
 assert.equal(JSON.parse(data.exports.csl_json).length,52);
 assert.ok(data.references.every(r=>!JSON.stringify(r).includes('C:\\')));
});

test('online full-text checks are not mislabeled as PDF checks',()=>{assert.equal(metadataCheckLabel('full_text_and_registry_checked'),'Full text + registry checked');assert.equal(metadataCheckLabel('unknown'),'Metadata needs review');});
