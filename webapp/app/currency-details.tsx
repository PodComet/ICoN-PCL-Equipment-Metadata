import {currencyReference,originalMoney,usdText} from './currency-lib';
import type {Equipment} from './catalog-lib';
export default function CurrencyDetails({record:r}:{record:Equipment}){
 const quotes=[{amount:r.msrp_value,currency:r.msrp_currency,label:'Source MSRP'},{amount:r.manufacturer_price_value,currency:r.manufacturer_price_currency,label:'Source manufacturer price'},{amount:r.estimated_msrp_low,currency:r.estimate_currency,label:'Source estimate lower bound'},{amount:r.estimated_msrp_high,currency:r.estimate_currency,label:'Source estimate upper bound'}].filter(q=>q.amount&&q.currency&&q.currency!=='USD');
 if(!quotes.length)return null;
 return <section className="currency-details"><h4>USD conversion</h4>{quotes.map(q=><p key={q.label}><strong>{q.label}:</strong> {originalMoney(q.amount,q.currency)} → {usdText(q.amount,q.currency)}</p>)}<p>Converted at <a href={currencyReference.source_url} target="_blank" rel="noopener noreferrer">ECB reference rates · {currencyReference.date}</a>. This is a USD equivalent of the source price; U.S. taxes, shipping, import duties and transaction fees are additional.</p></section>;
}
