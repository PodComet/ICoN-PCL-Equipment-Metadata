import {componentFor,componentOffers,materialCost,type ComponentOffer} from './component-lib';
import {componentData} from './process-budget';
import {processMoney} from './process-budget-lib';
import {usdText} from './currency-lib';
import type {MaterialPlan,StartingMaterial} from './process-materials-lib';
import MaterialPhoto from './material-photo';
export function ComponentPhoto({material,plan,compact=false}:{material:StartingMaterial;plan:MaterialPlan;compact?:boolean}){
 const quote=materialCost(material,plan,componentData).offer;
 const image=quote?.image_url?{image_id:quote.offer_id,name:quote.name,image_url:quote.image_url,source_url:quote.image_source_url||quote.source_url,author:quote.seller,license:'Supplier image · rights reserved',license_url:quote.image_source_url||quote.source_url,scope:quote.image_scope,material_names:[material.name],output_tags:[],kind:/micrograph|microscopy/i.test(quote.image_scope)&&!quote.image_scope.includes('Product illustration')?'supplier_microscopy':'supplier_product'}:undefined;
 return <MaterialPhoto name={material.name} image={image} compact={compact}/>;
}
export default function ComponentDetails({material,plan,onOffer}:{material:StartingMaterial;plan:MaterialPlan;onOffer?:(id:string)=>void}){
 const line=materialCost(material,plan,componentData),component=componentFor(material,plan,componentData);
 const offers=componentOffers(component,componentData);
 const pack=(o:ComponentOffer)=>usdText(o.price_value,o.currency)+' / '+(o.pack_quantity??'')+' '+o.pack_unit;
 return <div className="component-details">{component?.line_id.startsWith('MARKET-')&&<small><b>Market material option</b> · user-selected amount; process suitability requires review.</small>}<strong>{line.cost_usd===null?'Amount cost not established':processMoney(line.cost_usd)+' estimated material use*'}</strong>{line.offer&&<><a href={line.offer.source_url} target="_blank" rel="noopener noreferrer">{line.offer.seller} · {pack(line.offer)}</a><small>{line.offer.name} · {line.offer.checked_date}</small></>}{offers.length>1&&onOffer&&<label>Market quote<select aria-label={'Market quote for '+material.name} value={line.offer?.offer_id||''} onChange={e=>onOffer(e.target.value)}>{offers.map(o=><option key={o.offer_id} value={o.offer_id}>{o.seller} · {pack(o)}{!component?.eligible_offer_ids.includes(o.offer_id)?' · reference only':''}</option>)}</select></label>}<details><summary>{component?'Amount & price evidence':'Price match needed'}</summary><p>{line.reason}</p>{component&&'source_url' in component&&<p><a href={String(component.source_url)} target="_blank" rel="noopener noreferrer">Material identity &amp; source</a></p>}{component&&<><p><b>Source role:</b> {component.source_role}. <b>Reported amount:</b> {component.amount}. {component.concentration}</p><p>{component.scope} {component.offer_match_notes}</p></>}{line.offer&&<p>{line.offer.grade} · {line.offer.form}. {line.offer.notes}</p>}</details></div>;
}
