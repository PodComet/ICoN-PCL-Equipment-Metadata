import dataset from './data/seller-offers.json' with {type:'json'};
import {usdConversion,usdText} from './currency-lib.ts';
import type {Equipment} from './catalog-lib.ts';

export type SellerOffer={offer_id:string;equipment_id:string;manufacturer:string;model_name:string;seller_name:string;price_value:string;currency:string;price_kind:string;condition:string;source_url:string;checked_date:string;scope:string};
const identity=(s:string)=>(s||'').normalize('NFKC').trim().toLowerCase();
const validUrl=(s:string)=>{try{return ['http:','https:'].includes(new URL(s).protocol)}catch{return false}};
const labels:Record<string,string>={list_price:'Seller list price',sale_price:'Seller sale price',asking_price:'Seller asking price',starting_price:'Seller starting price',published_price:'Published seller price'};
export function validateSellerOffer(o:SellerOffer){
 if(!o.offer_id||!o.equipment_id||!o.model_name||!o.manufacturer||!o.seller_name||!o.scope||!validUrl(o.source_url)||!o.price_value?.trim()||!Number.isFinite(Number(o.price_value))||Number(o.price_value)<=0||!/^[A-Z]{3}$/.test(o.currency)||!labels[o.price_kind]||!['new','used','refurbished','unspecified'].includes(o.condition)||!/^\d{4}-\d{2}-\d{2}$/.test(o.checked_date)||Number.isNaN(Date.parse(o.checked_date))||new Date(o.checked_date).toISOString().slice(0,10)!==o.checked_date)return 'Seller offer requires exact model identity, amount/currency, seller, price kind, condition, source, valid date and configuration scope.';
 return '';
}
/** Bind evidence to the reviewed model, never a copied or renamed profile. */
export function sellerOffers(r:Equipment,offers:SellerOffer[]=dataset.offers as SellerOffer[]){
 return offers.filter(o=>!validateSellerOffer(o)&&o.equipment_id===r.equipment_id&&identity(o.manufacturer)===identity(r.manufacturer)&&identity(o.model_name)===identity(r.model_name)).map(o=>({
  ...o,source:o.source_url,label:labels[o.price_kind]+(o.currency==='USD'?'':' (USD equivalent)'),value:usdText(o.price_value,o.currency),conditionLabel:o.condition==='unspecified'?'Condition not stated':o.condition==='new'?'New':o.condition==='used'?'Used':'Refurbished',
 })).sort((a,b)=>Number(b.condition==='new')-Number(a.condition==='new')||b.checked_date.localeCompare(a.checked_date)||a.offer_id.localeCompare(b.offer_id));
}
export function sellerPrice(r:Equipment,newOnly=true,offers?:SellerOffer[]){
 return sellerOffers(r,offers).find(o=>(!newOnly||o.condition==='new')&&usdConversion(o.price_value,o.currency))||null;
}
