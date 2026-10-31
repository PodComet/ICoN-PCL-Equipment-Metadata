import type {Equipment} from './catalog-lib';
import {safeUrl} from './catalog-lib';

const fields=[['inputs_and_states','Input'],['outputs_and_states','Output'],['units_of_measure','Measuring units']] as const;

export default function InstrumentIO({record,compact=false}:{record:Equipment;compact?:boolean}){
 const matched=!!record.equipment_io_source_row;
 return <section className={'instrument-io'+(compact?' instrument-io-compact':'')} aria-label={'Input, output and measuring units for '+record.model_name} data-card-control>
  <div className="instrument-io-boxes">{fields.map(([field,label])=><section className="instrument-io-box" key={field} aria-label={label+' for '+record.model_name}>
   <h4>{label}</h4><div className="instrument-io-value" tabIndex={0}>{record[field]||(!matched?'Not recorded in the latest spreadsheet for this exact model.':'Not recorded in the spreadsheet.')}</div>
  </section>)}</div>
  {!compact&&<p className="instrument-io-source">{matched?<><span>Spreadsheet: {record.equipment_io_source_workbook} · {record.equipment_io_source_sheet}, row {record.equipment_io_source_row} · Imported {record.equipment_io_imported_date}</span>{safeUrl(record.equipment_io_manual_url)&&<a href={safeUrl(record.equipment_io_manual_url)} target="_blank" rel="noopener noreferrer">H · Manual / document</a>}{safeUrl(record.equipment_io_spec_url)&&<a href={safeUrl(record.equipment_io_spec_url)} target="_blank" rel="noopener noreferrer">I · Specifications / reference</a>}</>:<span>No exact model match in the latest spreadsheet.</span>}</p>}
 </section>;
}
