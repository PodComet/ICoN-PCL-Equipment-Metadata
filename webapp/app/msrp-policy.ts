import type {Equipment} from './catalog-lib.ts';
export type MsrpPolicy={benchmark_policy:string;older_model_multiplier:number;minimum_multiplier:number;maximum_multiplier:number;checked_date:string};
type Benchmark={record:Equipment;amount:number;currency:string;source:string;date:string;kind:string};
type Review=Record<string,string>;
const identity=(maker:string,name:string)=>{const normalize=(v:string)=>(v||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g,'');const m=normalize(maker),n=normalize(name);return m+':'+(m&&n.startsWith(m)?n.slice(m.length):n)};
const number=(s:string|undefined)=>s?.trim()!==''&&s!==undefined&&Number.isFinite(Number(s))&&Number(s)>=0?Number(s):null;
const url=(s:string)=>{try{return ['http:','https:'].includes(new URL(s).protocol)}catch{return false}};
const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const rounded=(n:number)=>String(Math.round((n+Number.EPSILON)*100)/100);
function benchmark(record:Equipment,p:MsrpPolicy):Benchmark|null{
 const exact=number(record.msrp_value);
 if(exact!==null&&/^[A-Z]{3}$/.test(record.msrp_currency)&&url(record.price_source_url)&&date(record.price_checked_date))return {record,amount:exact,currency:record.msrp_currency,source:record.price_source_url,date:record.price_checked_date,kind:'MSRP'};
 const list=number(record.manufacturer_price_value);
 if(p.benchmark_policy==='msrp_and_official_list'&&record.manufacturer_price_kind==='list_price'&&list!==null&&/^[A-Z]{3}$/.test(record.manufacturer_price_currency)&&url(record.manufacturer_price_source_url)&&date(record.manufacturer_price_checked_date)&&record.manufacturer_price_scope)return {record,amount:list,currency:record.manufacturer_price_currency,source:record.manufacturer_price_source_url,date:record.manufacturer_price_checked_date,kind:'manufacturer list price'};
 return null;
}
export function withMsrpEstimates(records:Equipment[],reviews:Review[],policy:MsrpPolicy):Equipment[]{
 const benchmarks=records.map(r=>benchmark(r,policy)).filter((b):b is Benchmark=>!!b),byIdentity=new Map<string,Benchmark[]>(),byClass=new Map<string,Benchmark[]>(),older=new Map<string,string[]>();
 for(const b of benchmarks){const key=identity(b.record.manufacturer,b.record.model_name);byIdentity.set(key,[...(byIdentity.get(key)||[]),b]);byClass.set(b.record.category_id,[...(byClass.get(b.record.category_id)||[]),b])}
 for(const review of reviews){
  const source=records.find(r=>r.equipment_id===review.equipment_id);
  if(!source||identity(source.manufacturer,source.model_name)!==identity(review.manufacturer,review.model_name)||review.lifecycle_status!=='newer_model_confirmed'||!['direct_successor','newer_generation'].includes(review.successor_relationship)||!url(review.successor_evidence_url)||!url(review.successor_product_url))continue;
  const target=identity(review.manufacturer,review.successor_model_name),key=identity(review.manufacturer,review.model_name);older.set(target,[...(older.get(target)||[]),key]);
 }
 return records.map(r=>{
  const result={...r,estimated_msrp_low:'',estimated_msrp_high:'',estimate_currency:'',estimate_method:'',estimate_status:'no_benchmarks',estimate_confidence:'not_estimated',estimate_subject:r.equipment_subtype||r.category_name,estimate_basis:'No qualifying MSRP/list-price benchmark found for this category or a documented older model.',estimate_source_urls:'',estimate_checked_date:policy.checked_date,estimate_benchmark_ids:''};
  if(number(r.msrp_value)!==null){result.estimate_status='explicit_msrp';result.estimate_basis='Explicit model MSRP is recorded; no inferred MSRP needed.';return result}
  const preferred=r.manufacturer_price_currency||'USD';
  const choose=(values:Benchmark[])=>{const currencies=[...new Set(values.map(v=>v.currency))];const currency=currencies.includes(preferred)?preferred:currencies.includes('USD')?'USD':currencies.length===1?currencies[0]:'';return values.filter(v=>v.currency===currency)};
  const finish=(low:number,high:number,values:Benchmark[],method:string,basis:string)=>{
   result.estimated_msrp_low=rounded(low);result.estimated_msrp_high=rounded(high);result.estimate_currency=values[0].currency;result.estimate_method=method;result.estimate_status='calculated';result.estimate_confidence='formula_based';result.estimate_basis=basis+' Source labels remain MSRP or manufacturer list price; this result is an estimate, not an explicit model MSRP.';result.estimate_source_urls=[...new Set(values.map(v=>v.source))].join(';');result.estimate_benchmark_ids=[...new Set(values.map(v=>v.record.equipment_id))].join(';');
  };
  let frontier=older.get(identity(r.manufacturer,r.model_name))||[];const seen=new Set<string>();
  while(frontier.length){
   const level=frontier.filter(k=>!seen.has(k));if(!level.length)break;level.forEach(k=>seen.add(k));
   const choices=choose(level.flatMap(k=>byIdentity.get(k)||[]));
   if(choices.length){
    choices.sort((a,b)=>Number(b.kind==='MSRP')-Number(a.kind==='MSRP')||b.date.localeCompare(a.date)||a.record.equipment_id.localeCompare(b.record.equipment_id));const b=choices[0];
    finish(b.amount*policy.older_model_multiplier,b.amount*policy.older_model_multiplier,[b],'older_model_plus_20',`Closest documented older model: ${b.record.model_name}; ${b.kind} ${b.currency} ${rounded(b.amount)} × ${policy.older_model_multiplier}.`);return result;
   }
   frontier=level.flatMap(k=>older.get(k)||[]);
  }
  const values=choose(byClass.get(r.category_id)||[]);
  if(!values.length)return result;
  // One dated value per make/model/currency; mirrored category records cannot multiply a benchmark.
  values.sort((a,b)=>Number(b.kind==='MSRP')-Number(a.kind==='MSRP')||b.date.localeCompare(a.date)||a.record.equipment_id.localeCompare(b.record.equipment_id));
  const unique=[...new Map(values.map(v=>[identity(v.record.manufacturer,v.record.model_name),v] as const).reverse()).values()];
  const low=Math.min(...unique.map(v=>v.amount)),high=Math.max(...unique.map(v=>v.amount)),a=unique.find(v=>v.amount===low)!,b=unique.find(v=>v.amount===high)!;
  const lower=low*policy.minimum_multiplier,upper=high*policy.maximum_multiplier;
  if(lower>upper){result.estimate_status='inverted_range';result.estimate_currency=a.currency;result.estimate_source_urls=[...new Set([a.source,b.source])].join(';');result.estimate_benchmark_ids=[...new Set([a.record.equipment_id,b.record.equipment_id])].join(';');result.estimate_basis=`Category rule would yield ${a.currency} ${rounded(lower)}–${rounded(upper)} (lower exceeds upper). No interval is published; add a qualifying older-model price or a valid category spread.`;return result}
  finish(lower,upper,[a,b],'category_120_80',`Category ${r.category_id}: ${policy.minimum_multiplier} × lowest benchmark ${a.currency} ${rounded(low)} (${a.record.model_name}) through ${policy.maximum_multiplier} × highest benchmark ${b.currency} ${rounded(high)} (${b.record.model_name}).`);return result;
 });
}
