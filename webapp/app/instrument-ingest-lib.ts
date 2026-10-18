import {parseCSV} from './csv-updates.ts';
import type {FileExtraction,ResearchFile,Variable} from './research-lib.ts';
export const INGEST_LIMIT=2*1024*1024;
export const EXTRACTOR_VERSION='iconpcl-tabular-metadata/1.0.0';
const unitMappings:Record<string,[string,string]>={g:['g','GM'],mg:['mg','MilliGM'],kg:['kg','KiloGM'],'µg':['ug','MicroGM'],ug:['ug','MicroGM'],mL:['mL','MilliL'],ml:['mL','MilliL'],L:['L','L'],'µL':['uL','MicroL'],uL:['uL','MicroL'],s:['s','SEC'],min:['min','MIN'],h:['h','HR'],K:['K','K'],'°C':['Cel','DEG_C'],degC:['Cel','DEG_C'],Pa:['Pa','PA'],kPa:['kPa','KiloPA'],MPa:['MPa','MegaPA'],nm:['nm','NanoM'],mm:['mm','MilliM'],m:['m','M'],Hz:['Hz','HZ'],'mL/min':['mL/min',''],'mg/mL':['mg/mL',''],rpm:['1/min','']};
export function sourceVariable(header:string,values:unknown[]=[]):Variable{
 const match=header.match(/^(.*?)\s*(?:\[([^\]]+)\]|\(([^)]+)\))\s*$/),unit=(match?.[2]||match?.[3]||'').trim(),mapped=unitMappings[unit];
 const nonempty=values.filter(v=>v!==''&&v!==null&&v!==undefined),numeric=nonempty.length>0&&nonempty.every(v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v)));
 return {name:match?.[1]?.trim()||header,source_header:header,unit_text:unit,unit_code:mapped?.[0]||'',unit_uri:mapped?.[1]?'http://qudt.org/vocab/unit/'+mapped[1]:'',unit_status:!unit?'not_stated':mapped?'recognized':'unmapped',value_type:numeric?'number':'string',description:''};
}
function tabRows(text:string,delimiter:string){
 if(delimiter===',')return parseCSV(text,50001);
 // Apply the same quoted-cell rules to TSV without treating commas inside fields as separators.
 let quoted=false,out='';for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){out+=c;if(quoted&&text[i+1]==='"'){out+='"';i++;}else quoted=!quoted;}else out+=c===','?'\u001f':c==='\t'&&!quoted?',':c;}
 return parseCSV(out,50001).map(row=>row.map(cell=>cell.replaceAll('\u001f',',')));
}
export function extractInstrumentMetadata(filename:string,bytes:Uint8Array):{media_type:string;extraction:FileExtraction}{
 if(!bytes.length||bytes.length>INGEST_LIMIT)throw new Error('Use a nonempty instrument file up to 2 MiB.');
 const extension=filename.split('.').at(-1)?.toLowerCase();if(!['csv','tsv','json','txt'].includes(extension||''))throw new Error('This parser supports CSV, TSV, JSON and text exports. Native binary formats need an instrument-specific adapter.');
 let source:string;try{source=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'')}catch{throw new Error('Export the instrument file as UTF-8 text; raw binary is not parsed by this adapter.');}
 if(/[\u0000\u001f]/.test(source))throw new Error('Instrument text contains unsupported control characters.');
 const result:FileExtraction={extractor:EXTRACTOR_VERSION,format:extension||'txt',row_count:null,variables:[],reported_metadata:{},warnings:[]};
 let rows:unknown[]=[];
 if(extension==='json'){
  let value:unknown;try{value=JSON.parse(source)}catch{throw new Error('Instrument JSON is not valid JSON.');}
  if(Array.isArray(value))rows=value;
  else if(value&&typeof value==='object'){
   const object=value as Record<string,unknown>;if(Array.isArray(object.data))rows=object.data;
   const metadata=object.metadata&&typeof object.metadata==='object'&&!Array.isArray(object.metadata)?object.metadata as Record<string,unknown>:object;
   for(const key of ['instrument','manufacturer','model','serial_number','acquisition_time','operator','sample_id','software_version'])if(['string','number'].includes(typeof metadata[key]))result.reported_metadata[key]=String(metadata[key]).slice(0,500);
  }
  if(rows.length>50000)throw new Error('Use up to 50,000 instrument data rows.');
  if(rows.length){
   if(rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw new Error('JSON data rows must be objects.');
   const headers=[...new Set(rows.flatMap(r=>Object.keys(r as object)))];if(headers.length>100||headers.some(h=>!h.trim()||h.length>180||/[\x00-\x1f]/.test(h)))throw new Error('Use up to 100 nonempty measured columns with simple names.');
   result.row_count=rows.length;result.variables=headers.map(h=>sourceVariable(h,rows.map(r=>(r as Record<string,unknown>)[h])));
  }else result.warnings.push('No data-row array found; only recognized declared metadata was extracted.');
 }else{
  const lines=source.split(/\r?\n/),data:string[]=[];
  let tableStarted=false;for(const line of lines){const comment=!tableStarted&&line.match(/^\s*#\s*([A-Za-z_][A-Za-z0-9_ -]*):\s*(.*)$/);if(comment){if(Object.keys(result.reported_metadata).length<30)result.reported_metadata[comment[1].trim()]=comment[2].slice(0,500);}else {data.push(line);if(line.trim())tableStarted=true;}}
  if(extension==='txt'&&!data.join('').trim())result.warnings.push('The file contains metadata comments but no measurement table.');
  else{
   const delimiter=extension==='tsv'||extension==='txt'&&data.find(l=>l.trim())?.includes('\t')?'\t':',';
   const table=tabRows(data.join('\n'),delimiter).filter(row=>row.some(v=>v.trim()));const headers=table.shift()||[];
   if(!headers.length||headers.length>100||headers.some(h=>!h.trim()||h.length>180)||new Set(headers).size!==headers.length)throw new Error('Use unique nonempty column headers (up to 100).');
   if(table.some(row=>row.length!==headers.length))throw new Error('Instrument table rows have inconsistent widths.');
   result.row_count=table.length;result.variables=headers.map((h,i)=>sourceVariable(h,table.map(row=>row[i])));
  }
 }
 if(result.variables.some(v=>v.unit_status==='unmapped'))result.warnings.push('Some source units are unmapped. Values and original units are preserved; no conversion or meaning is guessed.');
 if(!result.reported_metadata.acquisition_time)result.warnings.push('Acquisition time was not extracted. File modification and upload times are not measurement times.');
 result.warnings.push('Instrument, sample and operator text is source-reported, not verified against an installed asset. Review before sharing.');
 return {media_type:extension==='json'?'application/json':extension==='csv'?'text/csv':extension==='tsv'?'text/tab-separated-values':'text/plain',extraction:result};
}
export async function digestBytes(bytes:Uint8Array){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as BufferSource)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function instrumentFile(filename:string,bytes:Uint8Array):Promise<ResearchFile>{
 if(!filename||filename.length>180||/[\/\\\x00-\x1f]/.test(filename)||filename==='.'||filename==='..')throw new Error('Use a simple source filename without directory paths.');
 const parsed=extractInstrumentMetadata(filename,bytes);
 return {file_id:'RF-'+crypto.randomUUID(),filename,size_bytes:bytes.length,sha256:await digestBytes(bytes),...parsed};
}
