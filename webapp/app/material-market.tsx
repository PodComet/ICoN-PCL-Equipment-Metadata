'use client';
import {useMemo,useState} from 'react';
import {Search,ArrowUpRight} from 'lucide-react';
import {componentData} from './process-budget';
import {usdConversion} from './currency-lib';
import {componentQuantity} from './component-lib';
import {safeUrl} from './catalog-lib';
const dollars=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
export default function MaterialMarket(){
 const [query,setQuery]=useState('');
 const offers=useMemo(()=>{
  const latest=new Map<string,(typeof componentData.offers)[number]>();
  for(const offer of componentData.offers){const key=[offer.seller,offer.sku||offer.component_id,offer.grade,offer.form,offer.pack_quantity,offer.pack_unit].join('|');const previous=latest.get(key);if(!previous||offer.checked_date>previous.checked_date)latest.set(key,offer)}
  return [...latest.values()].sort((a,b)=>a.name.localeCompare(b.name));
 },[]);
 const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean),shown=offers.filter(o=>terms.every(t=>[o.name,o.seller,o.manufacturer,o.sku,o.grade,o.form,o.cas_number].join(' ').toLowerCase().includes(t)));
 return <section className="material-market" aria-label="Input materials and components market prices"><header><div><p className="eyebrow">MATERIALS & COMPONENTS</p><h2>Market prices by pack amount</h2><p>Latest verified quote per seller, SKU and pack. Weekly refresh scheduled for Mondays. Each row retains its own date checked; unavailable prices keep their previous dated quote.</p></div><label><Search size={17}/><input aria-label="Search material market prices" type="search" placeholder="Find material, seller, CAS or SKU…" value={query} onChange={e=>setQuery(e.target.value)}/></label></header><p className="material-market-count">{shown.length} of {offers.length} quoted packs · USD equivalents use the project’s dated exchange rates. Pack prices exclude shipping and tax unless the source says otherwise.</p><div className="material-market-table"><table><thead><tr><th>Material / component</th><th>Pack amount</th><th>Pack price (USD)</th><th>Comparison unit</th><th>Seller & source</th><th>Checked</th></tr></thead><tbody>{shown.map(o=>{
  const usd=usdConversion(o.price_value,o.currency),quantity=componentQuantity(o.pack_quantity,o.pack_unit),unit=quantity?.dimension==='mass'?'g':quantity?.dimension==='volume'?'mL':quantity?.dimension==='moles'?'mol':null;
  return <tr key={o.offer_id}><th>{o.name}<small>{[o.grade,o.form,o.cas_number?'CAS '+o.cas_number:''].filter(Boolean).join(' · ')}</small></th><td>{o.pack_quantity} {o.pack_unit}</td><td><b>{usd?dollars(usd.value):'Conversion pending'}</b><small>{o.price_kind.replaceAll('_',' ')}{o.currency!=='USD'?' · original '+o.price_value+' '+o.currency:''}</small></td><td>{usd&&quantity&&quantity.value>0&&unit?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:6}).format(usd.value/quantity.value)+' / '+unit:'—'}</td><td>{safeUrl(o.source_url)?<a href={safeUrl(o.source_url)} target="_blank" rel="noopener noreferrer">{o.seller}<ArrowUpRight size={12}/></a>:o.seller}<small>{o.sku}</small></td><td>{o.checked_date}</td></tr>;
 })}</tbody></table></div>{!shown.length&&<p>No priced packs match this search.</p>}</section>;
}
