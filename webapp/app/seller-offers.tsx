import {pricePresentation,type Equipment} from './catalog-lib';
import {sellerOffers} from './seller-prices';
import {originalMoney} from './currency-lib';

export default function SellerOffers({record,compact=false}:{record:Equipment;compact?:boolean}){
 const offers=sellerOffers(record);if(!offers.length)return null;
 const shown=compact?offers.slice(0,1):offers,primary=compact?pricePresentation(record):null;
 return <div className={compact?'seller-offer-summary':'seller-offers'}>{!compact&&<h4>Published seller offers</h4>}{shown.map(o=>{
  const repeated=!!primary&&primary.value===o.value&&primary.label.startsWith(o.label);
  return <div key={o.offer_id}><a href={o.source_url} target="_blank" rel="noopener noreferrer"><strong>{repeated?o.seller_name:o.label+': '+o.value}</strong></a><small>{repeated?'':o.seller_name+' · '}{o.conditionLabel}{compact?'':' · checked '+o.checked_date}</small>{!compact&&<><p>{o.scope}</p>{o.currency!=='USD'&&<p>Original source quote: {originalMoney(o.price_value,o.currency)}. The displayed amount uses the catalog’s dated USD conversion.</p>}</>}</div>;
 })}{!compact&&<p className="fine-print">These are dated asking/list prices for the stated configuration. Seller offers are separate from MSRP and its estimates. Only offers explicitly identifying new equipment are eligible for new-equipment planning totals.</p>}</div>;
}
