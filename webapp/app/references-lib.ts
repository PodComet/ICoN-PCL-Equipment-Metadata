import type {Equipment} from './catalog-lib.ts';

export type AcademicReference=Record<string,string> & {reference_id:string;title:string;publication_year:string;authors_json:string};
export type ReferenceLink=Record<string,string> & {link_id:string;reference_id:string;target_type:string;target_id:string};
export type ReferenceFile=Record<string,string> & {file_id:string;reference_id:string;source_filename:string};
export type ReferenceAffiliation=Record<string,string> & {affiliation_id:string;reference_id:string;author_index:string;author_name:string;institution:string;source_url:string;source_kind:string};
export type ReferenceClass={reference_id:string;class_type:string;class_id:string;class_name:string;basis:string;via_class_ids:string;source_link_ids:string;scope:string};
export type ClassDefinition={class_type:string;class_id:string;class_name:string};
export type ReferenceFacets={P:string[];M:string[];N:string[]};
export type Literature={references:AcademicReference[];reference_links:ReferenceLink[];reference_files:ReferenceFile[];reference_affiliations?:ReferenceAffiliation[];reference_classes?:ReferenceClass[];class_definitions?:ClassDefinition[];reference_classification?:{reference_id:string;status:string;note:string}[];coverage:Record<string,number|string>};
export type Author={family?:string;given?:string;suffix?:string;literal?:string};
export function referenceAuthors(r:AcademicReference):Author[]{try{return JSON.parse(r.authors_json)}catch{return []}}
export function authorNames(r:AcademicReference){return referenceAuthors(r).map(a=>a.literal||[a.given,a.family,a.suffix].filter(Boolean).join(' '))}
export function authorsWithAffiliations(r:AcademicReference,literature:Literature){
 return authorNames(r).map((name,index)=>({name,index,affiliations:(literature.reference_affiliations||[]).filter(a=>a.reference_id===r.reference_id&&a.author_index===String(index)&&a.author_name===name)}));
}
export function sortReferences(records:AcademicReference[],newest=false){
 return [...records].sort((a,b)=>{
  if(!a.publication_year||!b.publication_year)return a.publication_year?-1:b.publication_year?1:a.reference_id.localeCompare(b.reference_id);
  const date=(Number(a.publication_year)-Number(b.publication_year))||((a.publication_date||a.publication_year).localeCompare(b.publication_date||b.publication_year));
  return (newest?-date:date)||(referenceAuthors(a)[0]?.family||'').localeCompare(referenceAuthors(b)[0]?.family||'')||a.title.localeCompare(b.title)||a.reference_id.localeCompare(b.reference_id);
 });
}
export function referenceCitation(r:AcademicReference){
 const vol=r.volume+(r.issue?'('+r.issue+')':'');
 return [authorNames(r).join('; '),'('+(r.publication_year||'n.d.')+')',r.title,[r.container_title,vol,r.pages||r.article_number].filter(Boolean).join(', '),r.url].filter(Boolean).join('. ');
}
export function articleClasses(literature:Literature,referenceId:string){
 const rank:Record<string,number>={checked_claim:0,equipment_class:1,background:2,process_inferred:3};
 const grouped=new Map<string,ReferenceClass[]>();
 for(const row of literature.reference_classes||[])if(row.reference_id===referenceId)grouped.set(row.class_id,[...(grouped.get(row.class_id)||[]),row]);
 return [...grouped.values()].map(rows=>({...[...rows].sort((a,b)=>(rank[a.basis]??9)-(rank[b.basis]??9))[0],provenance:rows})).sort((a,b)=>a.class_id.localeCompare(b.class_id,undefined,{numeric:true}));
}
export function filterReferences(literature:Literature,query:string,topic='',kind='',facets:ReferenceFacets={P:[],M:[],N:[]}){
 const files=new Map<string,string[]>();for(const f of literature.reference_files)files.set(f.reference_id,[...(files.get(f.reference_id)||[]),f.source_filename]);
 const terms=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 return literature.references.filter(r=>{
  const classes=articleClasses(literature,r.reference_id);
  return (['P','M','N'] as const).every(type=>!facets[type].length||classes.some(c=>c.class_type===type&&facets[type].includes(c.class_id)))&&(!topic||r.topics.split(';').includes(topic))&&(!kind||r.reference_type===kind)&&terms.every(term=>[r.title,authorNames(r).join(' '),authorsWithAffiliations(r,literature).flatMap(a=>a.affiliations.map(f=>f.institution)).join(' '),r.publication_year,r.container_title,r.doi,r.topics,r.notes,...classes.map(c=>c.class_id+' '+c.class_name),...(files.get(r.reference_id)||[])].join(' ').toLocaleLowerCase().includes(term));
 });
}
/** Each facet counts articles after applying all OTHER filters; OR within, AND across facets. */
export function referenceFacetOptions(literature:Literature,query:string,topic:string,kind:string,facets:ReferenceFacets,type:keyof ReferenceFacets){
 const records=filterReferences(literature,query,topic,kind,{...facets,[type]:[]}),counts=new Map<string,number>();
 for(const r of records)for(const c of articleClasses(literature,r.reference_id))if(c.class_type===type)counts.set(c.class_id,(counts.get(c.class_id)||0)+1);
 return (literature.class_definitions||[]).filter(c=>c.class_type===type).map(c=>({value:c.class_id,label:c.class_id+' · '+c.class_name,count:counts.get(c.class_id)||0})).sort((a,b)=>a.value.localeCompare(b.value,undefined,{numeric:true}));
}
/** Background links never become exact-model support through a shared category/material. */
export function instrumentReferenceLinks(record:Equipment,links:ReferenceLink[]){
 return links.filter(link=>link.target_type==='equipment'?link.target_id===record.equipment_id:
  link.target_type==='category'?link.target_id===record.category_id&&link.relation==='background':
  link.target_type==='route'?((record.related_material_ids||'').split(';').includes(link.target_id)||(record.related_process_ids||'').split(';').includes(link.target_id))&&link.relation==='background':false);
}

/** Category evidence is displayed separately and never becomes model-level support. */
export function categoryEvidenceLinks(record:Equipment,links:ReferenceLink[]){
 return links.filter(link=>link.target_type==='category'&&link.target_id===record.category_id&&link.relation==='supports_claim'&&link.review_status==='claim_checked');
}

export function metadataCheckLabel(status:string){
 return ({pdf_checked:'PDF checked · registry unresolved',needs_review:'Metadata needs review',full_text_and_registry_checked:'Full text + registry checked',full_text_and_repository_checked:'Full text + repository checked',pdf_and_registry_checked:'PDF + registry checked',pdf_and_repository_checked:'PDF + repository checked'} as Record<string,string>)[status]||'Metadata needs review';
}
