import {componentQuantity} from './component-lib.ts';
export const METRIC_SCALES={mass:['µg','mg','g','kg'],volume:['µL','mL','L'],moles:['µmol','mmol','mol'],count:['piece','wafer','target','grid']} as const;
export function metricAmount(text:string){
 const match=text.trim().match(/^((?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-zµμ]+)$/i);
 if(!match)return null;
 const quantity=componentQuantity(Number(match[1]),match[2]);if(!quantity)return null;
 const unit=METRIC_SCALES[quantity.dimension].find(u=>u.toLowerCase().replace(/[µμ]/g,'u')===match[2].toLowerCase().replace(/[µμ]/g,'u'));
 return unit?{number:match[1],unit,quantity}:null;
}
export function changeMetricScale(text:string,unit:string){
 const parsed=metricAmount(text),one=componentQuantity(1,unit);
 return parsed&&one&&parsed.quantity.dimension===one.dimension?Number((parsed.quantity.value/one.value).toPrecision(10))+' '+unit:null;
}
export function formatMetric(value:number,dimension:'mass'|'volume'){
 const unit=dimension==='mass'?(value<.001?'µg':value<1?'mg':value<1000?'g':'kg'):(value<1?'µL':value<1000?'mL':'L');
 const one=componentQuantity(1,unit)!;
 return new Intl.NumberFormat('en-US',{maximumSignificantDigits:4}).format(value/one.value)+' '+unit;
}
