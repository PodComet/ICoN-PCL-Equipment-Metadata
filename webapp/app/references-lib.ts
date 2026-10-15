import type {Equipment} from './catalog-lib.ts';

export type AcademicReference=Record<string,string> & {reference_id:string;title:string;publication_year:string;authors_json:string};
export type ReferenceLink=Record<string,string> & {link_id:string;reference_id:string;target_type:string;target_id:string};
export type ReferenceFile=Record<string,string> & {file_id:string;reference_id:string;source_filename:string};
export type Literature={references:AcademicReference[];reference_links:ReferenceLink[];reference_files:ReferenceFile[];coverage:Record<string,number|string>};
export type Author={family?:string;given?:string;suffix?:string;literal?:string};
export function referenceAuthors(r:AcademicReference):Author[]{try{return JSON.parse(r.authors_json)}catch{return []}}
export function authorNames(r:AcademicReference){return referenceAuthors(r).map(a=>a.literal||[a.given,a.family,a.suffix].filter(Boolean).join(' '))}
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
export function filterReferences(literature:Literature,query:string,topic='',kind=''){
 const files=new Map<string,string[]>();for(const f of literature.reference_files)files.set(f.reference_id,[...(files.get(f.reference_id)||[]),f.source_filename]);
 const terms=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 return literature.references.filter(r=>(!topic||r.topics.split(';').includes(topic))&&(!kind||r.reference_type===kind)&&terms.every(term=>[r.title,authorNames(r).join(' '),r.publication_year,r.container_title,r.doi,r.topics,r.notes,...(files.get(r.reference_id)||[])].join(' ').toLocaleLowerCase().includes(term)));
}
/** Background links never become exact-model support through a shared category/material. */
export function instrumentReferenceLinks(record:Equipment,links:ReferenceLink[]){
 return links.filter(link=>link.target_type==='equipment'?link.target_id===record.equipment_id:
  link.target_type==='category'?link.target_id===record.category_id&&link.relation==='background':
  link.target_type==='route'?((record.related_material_ids||'').split(';').includes(link.target_id)||(record.related_process_ids||'').split(';').includes(link.target_id))&&link.relation==='background':false);
}
