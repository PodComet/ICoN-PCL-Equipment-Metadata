import type {ComponentData,ComponentOffer} from './component-lib.ts';

export type MarketProcess={route_id:string;route_name:string;sources:{formulation_id:string;label:string;source_url:string;scope:string;roles:string[]}[]};
export type MarketPack={offer:ComponentOffer;component_ids:string[];processes:MarketProcess[]};
const packKey=(o:ComponentOffer)=>[o.seller,o.sku||o.component_id,o.grade,o.form,o.pack_quantity,o.pack_unit].join('|');

/** Purchase identity and literature relevance are separate from approved costing matches. */
export function marketPacks(data:ComponentData,routes:Record<string,string>[]):MarketPack[]{
 const grouped=new Map<string,ComponentOffer[]>();
 for(const offer of data.offers){const key=packKey(offer);grouped.set(key,[...(grouped.get(key)||[]),offer]);}
 return [...grouped.values()].map(aliases=>{
  const offer=[...aliases].sort((a,b)=>b.checked_date.localeCompare(a.checked_date)||a.offer_id.localeCompare(b.offer_id))[0];
  const component_ids=[...new Set(aliases.map(o=>o.component_id))],offerIds=new Set(aliases.map(o=>o.offer_id));
  const processes:MarketProcess[]=[];
  for(const f of data.formulations){
   const components=f.components.filter(c=>component_ids.includes(c.component_id)||c.eligible_offer_ids.some(id=>offerIds.has(id)));
   if(!components.length)continue;
   let process=processes.find(p=>p.route_id===f.route_id);
   if(!process){process={route_id:f.route_id,route_name:routes.find(r=>r.route_id===f.route_id)?.route_name||f.route_id,sources:[]};processes.push(process);}
   process.sources.push({formulation_id:f.formulation_id,label:f.label,source_url:f.source_url,scope:f.scope,roles:[...new Set(components.map(c=>c.role))]});
  }
  processes.sort((a,b)=>a.route_id.localeCompare(b.route_id,undefined,{numeric:true}));
  return {offer,component_ids,processes};
 }).sort((a,b)=>a.offer.name.localeCompare(b.offer.name));
}

export function filterMarketPacks(packs:MarketPack[],query:string,routeId=''){
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return packs.filter(({offer:o,component_ids,processes})=>(!routeId||processes.some(p=>p.route_id===routeId))&&terms.every(t=>[o.name,o.seller,o.manufacturer,o.sku,o.grade,o.form,o.cas_number,...component_ids,...processes.flatMap(p=>[p.route_id,p.route_name])].join(' ').toLowerCase().includes(t)));
}
