import type {Equipment} from './catalog-lib.ts';

export type LinkReplacement={old_url:string;replacement_url:string;field_replacements?:Partial<Record<string,string>>;product_page_scope?:string};
function linkKey(value:string){
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.host.toLowerCase()+url.pathname.replace(/\/$/,''):''}catch{return ''}
}

/** Replace only reviewed retired URLs; never guess another model's destination. */
export function repairRetiredLinks(record:Equipment,replacements:LinkReplacement[]):Equipment{
 const result={...record};
 for(const [field,value] of Object.entries(record)){
  if(!value||(!field.endsWith('_url')&&!field.endsWith('_urls')))continue;
  const parts=field.endsWith('_urls')?value.split(';'):[value];
  result[field]=parts.map(part=>{
   const key=linkKey(part),rule=key?replacements.find(item=>linkKey(item.old_url)===key):undefined;
   if(!rule)return part;
   const next=rule.field_replacements?.[field]??rule.replacement_url;
   if(field==='product_page_url'&&rule.product_page_scope)result.product_page_scope=rule.product_page_scope;
   if(field==='technical_spec_url'&&!next&&!record.brochure_url)result.brochure_url=rule.replacement_url;
   if(field==='manual_url'&&!next){result.manual_status='not_found';result.manual_match_status='not_verified';if(!record.brochure_url)result.brochure_url=rule.replacement_url}
   return next;
  }).filter(Boolean).join(';');
 }
 return result;
}
