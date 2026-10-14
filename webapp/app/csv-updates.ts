import {safeUrl,applyManufacturerAudit,type Equipment} from "./catalog-lib.ts";

export const UPDATE_FIELDS=["model_name","manufacturer","product_family","variant_label","capacity_ml","manual_url","manual_scope","product_page_url","technical_spec_url","image_url","image_source_url","image_scope","msrp_value","msrp_currency","price_source_url","price_checked_date","related_material_ids","related_material_types","related_process_ids","related_process_types","notes"];
export const CSV_COLUMNS=["operation","equipment_id","parent_equipment_id","category_id",...UPDATE_FIELDS];
export type Change={line:number;operation:string;equipment_id:string;name:string;fields:string[];before:Equipment|null;after:Equipment};
export type Plan={changes:Change[];errors:{line:number;message:string}[];warnings:{line:number;message:string}[];unchanged:number;rowCount:number};

export function parseCSV(text:string):string[][] {
 if(text.length>3_000_000)throw new Error("CSV must be under 3 MB.");
 text=text.replace(/^\uFEFF/,"");
 const rows:string[][]=[];let row:string[]=[],cell="",quoted=false,closed=false;
 const push=()=>{row.push(cell);cell="";closed=false};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=c;continue}
  if(closed&&c!==','&&c!=='\r'&&c!=='\n')throw new Error("Unexpected text after a closing quote.");
  if(c==='"'){if(cell)throw new Error("A quoted field must start with a quote.");quoted=true}
  else if(c===',')push();
  else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;push();if(row.some(v=>v.trim()))rows.push(row);row=[]}
  else cell+=c;
 }
 if(quoted)throw new Error("An opening quote has no closing quote.");
 if(cell||row.length||closed){push();if(row.some(v=>v.trim()))rows.push(row)}
 if(rows.length>1001)throw new Error("Use at most 1,000 data rows per file.");
 return rows;
}
export function csvUpdateText(rows:Record<string,string>[]) {
 const cell=(value:string)=>{let text=String(value??"");if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'};
 return '\ufeff'+[CSV_COLUMNS,...rows.map(r=>CSV_COLUMNS.map(k=>r[k]||""))].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';
}
export function buildPlan(text:string,records:Equipment[],categories:Record<string,string>[],routes:Record<string,string>[],brands:Record<string,string>[]):Plan {
 const plan:Plan={changes:[],errors:[],warnings:[],unchanged:0,rowCount:0};
 let rows:string[][];try{rows=parseCSV(text)}catch(e){plan.errors.push({line:1,message:(e as Error).message});return plan}
 if(!rows.length){plan.errors.push({line:1,message:"CSV is empty."});return plan}
 const headers=rows.shift()!.map(s=>s.trim());
 if(new Set(headers).size!==headers.length||headers.some(h=>!CSV_COLUMNS.includes(h))){plan.errors.push({line:1,message:"Duplicate or unsupported columns. Use the update template; audit stars and verification fields cannot be imported."});return plan}
 if(!headers.includes('equipment_id')||!headers.includes('operation')){plan.errors.push({line:1,message:"operation and equipment_id columns are required."});return plan}
 const byId=new Map(records.map(r=>[r.equipment_id,r])),seen=new Set<string>();
 const categoryMap=new Map(categories.map(c=>[c.category_id,c.category_name]));
 for(const r of records)categoryMap.set(r.category_id,r.category_name);
 const validMaterial=new Set(routes.filter(r=>r.route_kind==='material_family').map(r=>r.route_id));
 const validProcess=new Set(routes.filter(r=>r.route_kind==='manufacturing_process').map(r=>r.route_id));
 rows.forEach((values,index)=>{
  const line=index+2;plan.rowCount++;
  try{
   if(values.length!==headers.length)throw new Error("Column count differs from the header. Quote values containing commas or line breaks.");
   const input=Object.fromEntries(headers.map((h,i)=>[h,values[i].trim().replace(/^'(?=[=+@-])/,"")]));
   const id=input.equipment_id,op=input.operation;
   if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(id))throw new Error("Provide a stable equipment_id using letters, digits, hyphens, underscores or dots.");
   if(seen.has(id))throw new Error("Duplicate equipment_id in this file.");seen.add(id);
   if(!['update','add_equipment','add_variant'].includes(op))throw new Error("operation must be update, add_equipment or add_variant.");
   const before=byId.get(id)||null;
   if(op==='update'&&!before)throw new Error("equipment_id was not found in the shared catalog.");
   if(op!=='update'&&before)throw new Error("New equipment_id already exists. Use update or choose a new ID.");
   const parent=op==='add_variant'?byId.get(input.parent_equipment_id):null;
   if(op==='add_variant'&&!parent)throw new Error("parent_equipment_id must identify an existing shared instrument.");
   if(op==='update'&&input.category_id&&input.category_id!==before!.category_id)throw new Error("Category reassignment needs a separate review; omit category_id for updates.");
   const category=before?.category_id||parent?.category_id||input.category_id;
   if(!categoryMap.has(category))throw new Error("Choose a known category_id from the category reference.");
   const record:Equipment={...(before||parent||Object.fromEntries(Object.keys(records[0]||{}).map(k=>[k,""]))),equipment_id:id,model_name:before?.model_name||"",category_id:category,category_name:categoryMap.get(category)!} as Equipment;
   if(op!=='update'){
    for(const k of ['model_name','variant_label','capacity_ml','manual_url','manual_scope','msrp_value','msrp_currency','price_source_url','price_checked_date','product_page_url','technical_spec_url','image_url','image_source_url','image_scope','notes','source_pdf','source_page','source_sha256','model_evidence_url','manual_lookup_url','documentation_url','requested_ids','institution_label','institution_basis','institution_logo_url','manufacturer_official_website_url','manufacturer_research_evidence_url'])record[k]='';
    record.highlight_requested='false';record.purdue_list='false';record.ownership_status='not_independently_verified';record.access_evidence_url='';
    record.catalog_scope='admin_supplement';record.record_kind=op==='add_variant'?'user_variant':'model_candidate';record.model_status='user_entered';record.model_evidence_status='candidate_needs_review';record.manual_match_status='not_verified';record.manual_status='not_found';
    if(op==='add_equipment'){record.product_family_id='PF-'+id;record.product_family='';for(const k of Object.keys(record))if(k.startsWith('estimate'))record[k]='';const comparator=records.find(r=>r.category_id===category);if(comparator)for(const k of Object.keys(comparator))if(k.startsWith('estimate'))record[k]=comparator[k]}
   }
   const changed:string[]=[];
   for(const field of UPDATE_FIELDS){const value=input[field];if(value){if(value.length>6000)throw new Error(field+" exceeds 6,000 characters.");const next=value==='[CLEAR]'?'':value;if(String(record[field]||"").trim()!==next){record[field]=next;changed.push(field)}}}
   if(op!=='update'&&!input.model_name)throw new Error("New records require model_name.");
   if(!record.variant_label&&op!=='update')record.variant_label=record.model_name;
   if(!record.product_family&&op!=='update')record.product_family=record.model_name;
   if(!record.manufacturer||!record.model_name||!record.product_family||!record.variant_label)throw new Error("Manufacturer, model name, product family and variant label cannot be empty.");
   for(const field of UPDATE_FIELDS.filter(f=>f.endsWith('_url')))if(record[field]&&!safeUrl(record[field]))throw new Error(field+" must use http or https.");
   if(changed.includes("image_url")&&record.image_url&&(!input.image_source_url||!input.image_scope))throw new Error("Changing a photo requires its source page and scope in the CSV.");
   if(record.image_url&&(!record.image_source_url||!record.image_scope))throw new Error("A photo requires image_source_url and image_scope.");
   if(record.capacity_ml&&(!Number.isFinite(Number(record.capacity_ml))||Number(record.capacity_ml)<=0))throw new Error("capacity_ml must be positive.");
   if(record.msrp_value){if(!Number.isFinite(Number(record.msrp_value))||Number(record.msrp_value)<0||!/^[A-Z]{3}$/.test(record.msrp_currency)||!safeUrl(record.price_source_url)||!/^\d{4}-\d{2}-\d{2}$/.test(record.price_checked_date)||Number.isNaN(Date.parse(record.price_checked_date))||new Date(record.price_checked_date).toISOString().slice(0,10)!==record.price_checked_date)throw new Error("Exact MSRP needs a nonnegative amount, ISO currency, source URL and YYYY-MM-DD date.");record.price_status='admin_entered_msrp'}
   else if(changed.includes('msrp_value')||op!=='update'){record.price_status='not_researched';record.msrp_currency='';record.price_source_url='';record.price_checked_date=''}
   for(const [field,valid] of [['related_material_ids',validMaterial],['related_process_ids',validProcess]] as const){if((record[field]||'').split(';').filter(Boolean).some(id=>!valid.has(id)))throw new Error("Unknown IDs in "+field)}
   for(const [idField,typeField] of [['related_material_ids','related_material_types'],['related_process_ids','related_process_types']])if(changed.includes(idField)&&!input[typeField])record[typeField]=record[idField].split(';').filter(Boolean).map(id=>routes.find(r=>r.route_id===id)?.route_name||id).join(';');
   if(op!=='update'||changed.includes('manual_url')||changed.includes('manual_scope')){record.manual_match_status='not_verified';record.manual_status=record.manual_url?'user_entered_unverified':'not_found'}
   const after=applyManufacturerAudit(record,brands);
   if(!brands.some(b=>b.manufacturer===record.manufacturer))plan.warnings.push({line,message:"Manufacturer not in the reviewed registry; no green star will be awarded."});
   if(op!=='update')plan.warnings.push({line,message:"New record starts without Purdue ownership/list markers or verified manual/model status."});
   if(op==='update'&&!changed.length){plan.unchanged++;return}
   plan.changes.push({line,operation:op,equipment_id:id,name:record.model_name,fields:before?Object.keys(after).filter(k=>after[k]!==before[k]&&!k.startsWith("_")):changed,before,after});
  }catch(e){plan.errors.push({line,message:(e as Error).message})}
 });
 if(plan.changes.length>100)plan.errors.push({line:1,message:"Split the file into batches of at most 100 changed records."});
 if(JSON.stringify(plan.changes).length>1_500_000)plan.errors.push({line:1,message:"Change payload is too large. Split this import into smaller files."});
 return plan;
}
