'use client';
import {useState} from 'react';
import ControlSequenceEditor from './control-sequence-editor';
import {sequenceTemplate,sequenceTemplateJSON,SEQUENCE_FIELD,type SequenceContext} from './control-sequence-lib';
import type {PositionLibrary} from './position-lib';
import type {CatalogRow} from './catalog-lib';

export default function InstrumentSequence({row,library,canSave,onSaved,context,onDirty}:{row:CatalogRow;library:PositionLibrary;canSave:boolean;onSaved:(row:CatalogRow)=>void;context?:SequenceContext;onDirty?:(dirty:boolean)=>void}){
 const [sequence,setSequence]=useState(()=>sequenceTemplate(row.record)),[revision,setRevision]=useState(row.revision),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 async function save(){setBusy(true);setError('');try{const response=await fetch('/api/catalog',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({equipment_id:row.record.equipment_id,expected_revision:revision,fields:{[SEQUENCE_FIELD]:sequenceTemplateJSON(row.record,sequence)}})}),body=await response.json() as CatalogRow&{error?:string};if(!response.ok)throw new Error(body.error||'Could not save sequence.');setRevision(body.revision);setDirty(false);onDirty?.(false);setNotice('Sequence saved to your catalog. Existing process occurrences keep their own sequences.');onSaved(body);}catch(e){setError(e instanceof Error?e.message:'Could not save sequence.')}finally{setBusy(false)}}
 return <section className="instrument-sequence-panel" data-card-control>
  <h3>{context?'Sequence for this process occurrence':'Instrument operation sequence'}</h3><p>{context?context.label:'Build a reusable sequence for this exact model. Save it to your catalog, then copy it into a process occurrence when needed.'}</p>
  <ControlSequenceEditor record={row.record} sequence={context?.sequence||sequence} library={library} onChange={next=>{if(context)context.onChange(next);else{setSequence(next);setDirty(true);onDirty?.(true);setNotice('')}}}/>
  {context?<p className="sequence-save-note" role="status">Changes are in the process draft. Use “Save workflow” to save them.</p>:<><button type="button" className="primary-button" disabled={!canSave||!dirty||busy} onClick={save}>{busy?'Saving…':'Save instrument sequence'}</button>{!canSave&&<p>Sign in to save this model’s sequence. You can still compose and export it.</p>}{dirty&&<p className="sequence-save-note" role="status">Unsaved instrument sequence</p>}</>}
  {notice&&<p role="status">{notice}</p>}{error&&<p className="error-box" role="alert">{error} Your sequence remains open; export it before reloading.</p>}
 </section>;
}
