import type {Equipment} from './catalog-lib';
import {safeUrl} from './catalog-lib';
import {equipmentIOText,equipmentIOFragments} from './equipment-io';

const fields=[['inputs_and_states','Input'],['outputs_and_states','Output'],['units_of_measure','Measuring units']] as const;

export default function InstrumentIO({record,compact=false}:{record:Equipment;compact?:boolean}){
 const matched=!!record.equipment_io_source_row;
 const manual=safeUrl(record.equipment_io_manual_url),spec=safeUrl(record.equipment_io_spec_url);
 return <section className={'instrument-io'+(compact?' instrument-io-compact':'')} aria-label={'Input, output and measuring units for '+record.model_name} data-card-control>
  <div className="instrument-io-boxes">{fields.map(([field,label])=><section className="instrument-io-box" key={field} aria-label={label+' for '+record.model_name}>
   <h4>{label}</h4><div className="instrument-io-value" tabIndex={0}>{equipmentIOFragments(equipmentIOText(record[field])||'No documented value recorded for this model.').map((part,i)=>part.url&&safeUrl(part.url)?<a key={i} href={safeUrl(part.url)} target="_blank" rel="noopener noreferrer" title="Open web reference in a new tab or window">{part.text}</a>:part.text)}</div>
  </section>)}</div>
  {!compact&&(matched||manual||spec)&&<p className="instrument-io-source">
   {matched&&<span>Spreadsheet: {record.equipment_io_source_workbook} · {record.equipment_io_source_sheet}, row {record.equipment_io_source_row} · Imported {record.equipment_io_imported_date}</span>}
   {manual&&<a href={manual} target="_blank" rel="noopener noreferrer">Manual / document</a>}
   {spec&&spec!==manual&&<a href={spec} target="_blank" rel="noopener noreferrer">Specifications / reference</a>}
  </p>}
 </section>;
}
