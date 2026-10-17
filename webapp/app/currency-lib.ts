import reference from './data/currency-rates.json' with {type:'json'};
export type CurrencyReference={date:string;source_url:string;units_per_eur:Record<string,number>};
export const currencyReference=reference as CurrencyReference;
export function usdConversion(value:number|string,currency='USD',rates:CurrencyReference=currencyReference){
 if(value===''||!Number.isFinite(Number(value))||Number(value)<0)return null;
 const code=currency.toUpperCase(),foreign=rates.units_per_eur[code],usd=rates.units_per_eur.USD;
 if(code!=='USD'&&(!(foreign>0)||!(usd>0)))return null;
 const rate=code==='USD'?1:usd/foreign;
 return {value:Number(value)*rate,currency:'USD' as const,original_value:Number(value),original_currency:code,rate,rate_date:code==='USD'?'':rates.date,rate_source_url:code==='USD'?'':rates.source_url,converted:code!=='USD'};
}
export function usdText(value:number|string,currency='USD'){const quote=usdConversion(value,currency);return quote?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:2}).format(quote.value):'USD conversion unavailable';}
export function originalMoney(value:number|string,currency:string){try{return new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits:0,maximumFractionDigits:2}).format(Number(value))+' '+currency;}catch{return value+' '+currency;}}
export function usdPrice<T extends {kind:string;currency:string;low:number;high:number;scope:string}>(quote:T){
 if(quote.currency==='USD'||quote.kind==='unpriced')return quote;
 const low=usdConversion(quote.low,quote.currency),high=usdConversion(quote.high,quote.currency);
 if(!low||!high)return {...quote,kind:'unpriced' as const,currency:'USD',low:0,high:0,scope:quote.scope+' · USD conversion unavailable',original_quote:{currency:quote.currency,low:quote.low,high:quote.high}};
 return {...quote,currency:'USD',low:low.value,high:high.value,original_quote:{currency:quote.currency,low:quote.low,high:quote.high},fx_rate:low.rate,fx_rate_date:low.rate_date,fx_source_url:low.rate_source_url};
}
