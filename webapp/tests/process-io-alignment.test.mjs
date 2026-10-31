import test from 'node:test';
import assert from 'node:assert/strict';
import {assignInstrument,newStep} from '../app/process-lib.ts';
import {matchInstrumentIO,processIOAlignment} from '../app/process-io-alignment.ts';

const record=(id,input,output)=>({equipment_id:id,manufacturer:'Test',model_name:id,category_id:'M02',inputs_and_states:input,outputs_and_states:output});
function plan(records){
 let w={schema_version:1,workflow_id:'',route_id:'PTEST',route_name:'Test',name:'Test',notes:'',extensions:{},steps:records.map(()=>newStep(['M02']))};
 for(let n=0;n<records.length;n++)if(records[n])w=assignInstrument(w,w.steps[n].slots[0].slot_id,records[n]);
 return w;
}
const assigned=w=>w.steps.map(s=>s.slots[0].instrument);

test('a full chain has a match at every handoff and clearing or replacing a slot removes full alignment',()=>{
 const rs=[record('mixer','A solution','A liquid suspension'),record('pump','Liquid feed','Liquid flow'),record('reactor','Liquid sample','Nanoparticle dispersion')];
 let w=plan(rs);let result=processIOAlignment(w);
 assert.equal(result.matched.length,2);assert.equal(result.allAligned,true);
 const original=JSON.stringify(w);processIOAlignment(w);assert.equal(JSON.stringify(w),original,'Analysis does not mutate the saved plan');
 w.steps[1].slots[0].instrument=null;assert.equal(processIOAlignment(w).allAligned,false);
 w=plan([rs[0],record('powder mill','Dry powder','Dry powder'),rs[2]]);
 result=processIOAlignment(w);assert.equal(result.matched.length,0);assert.equal(result.allAligned,false);
});

test('at least one shared port suffices but utility settings and unknown source text do not',()=>{
 let [from,to]=assigned(plan([record('A','Water','Liquid flow; temperature reading'),record('B','Liquid solution; electrical supply','Material') ]));
 assert.ok(matchInstrumentIO(from,to));
 [from,to]=assigned(plan([record('A','','24 V; 50 Hz; speed; time; digital outputs'),record('B','24 V; 50 Hz; speed; time; digital inputs','')]));
 assert.equal(matchInstrumentIO(from,to),null);
 from.equipment_snapshot.outputs_and_states='Not established for this sample.\nSource: Manuals/sample.pdf';
 to.equipment_snapshot.inputs_and_states='Not established for this sample.';
 assert.equal(matchInstrumentIO(from,to),null);
 assert.equal(processIOAlignment(plan([null,null])).allAligned,false);
 assert.equal(processIOAlignment(plan([record('single','Liquid','Liquid')])).allAligned,false);
});

test('explicit phases and named chemistry prevent superficial sample or liquid matches',()=>{
 for(const [output,input] of [['Dry powder sample','Liquid sample'],['CuO nanoparticle powder','TiO2 nanoparticle powder'],['Ethanol solution','Water solution'],['Coated substrate','Dry powder feed']]){
  const [from,to]=assigned(plan([record('A','',output),record('B',input,'')]));assert.equal(matchInstrumentIO(from,to),null,output+' → '+input);
 }
 const [from,to]=assigned(plan([record('A','','TiO2 powder'),record('B','TiO2 solid feed','')]));assert.ok(matchInstrumentIO(from,to));
});

test('configured per-occurrence ports override model prose; exact signal name/value/unit matches are supported',()=>{
 const [from,to]=assigned(plan([record('A','','Liquid flow'),record('B','Liquid feed','')]));
 from.outputs={ready:{value:'HIGH',unit:''}};to.inputs={ready:{value:'HIGH',unit:''}};
 assert.equal(matchInstrumentIO(from,to).basis,'configured_port');
 to.inputs={ready:{value:'LOW',unit:''}};assert.equal(matchInstrumentIO(from,to),null);
 from.outputs={pressure:{value:1,unit:'bar'}};to.inputs={pressure:{value:1,unit:'Pa'}};
 assert.equal(matchInstrumentIO(from,to),null);
 to.inputs={pressure:{value:1,unit:'bar'}};assert.ok(matchInstrumentIO(from,to));
 to.inputs={feed:'Unknown'};assert.equal(matchInstrumentIO(from,to),null);
});

test('old snapshots fall back to exact current model I/O, never another identity or a different capacity',()=>{
 const a=record('A','','Liquid feed'),b=record('B','Liquid suspension','');
 const [from,to]=assigned(plan([a,b]));delete from.equipment_snapshot.outputs_and_states;delete to.equipment_snapshot.inputs_and_states;
 assert.ok(matchInstrumentIO(from,to,a,b));
 assert.equal(matchInstrumentIO(from,to,{...a,model_name:'A new generation'},b),null);
 assert.equal(matchInstrumentIO(from,to,{...a,capacity_ml:'500'},b),null);
 from.equipment_snapshot.outputs_and_states='';assert.equal(matchInstrumentIO(from,to,a,b),null,'An explicitly empty saved value stays empty');
});

test('parallel peers have no invented handoff; every prerequisite branch must align',()=>{
 const rs=[record('liquid branch','Feed','Liquid flow'),record('powder branch','Feed','Powder product'),record('receiver','Liquid feed; dry powder feed','Product')];
 const w=plan(rs);w.extensions.dependency_schema='process-dependencies/v1';
 w.steps[0].extensions.prerequisite_step_ids=[];w.steps[1].extensions.prerequisite_step_ids=[];w.steps[2].extensions.prerequisite_step_ids=[w.steps[0].step_id,w.steps[1].step_id];
 let result=processIOAlignment(w);assert.equal(result.stageConnections,2);assert.equal(result.allAligned,true);assert.equal(result.connections.some(c=>c.fromStep===w.steps[0].step_id&&c.toStep===w.steps[1].step_id),false);
 w.steps[1].slots[0].instrument.equipment_snapshot.outputs_and_states='Laser pulses';result=processIOAlignment(w);
 assert.equal(result.matched.length,1);assert.equal(result.allAligned,false);
 w.steps[0].extensions.prerequisite_step_ids=[w.steps[2].step_id];assert.equal(processIOAlignment(w).allAligned,false,'Cycles cannot complete');
});

test('one matched instrument cannot turn an unrelated machine in the same stage green',()=>{
 const w=plan([record('source','','Liquid flow'),record('target','Liquid feed','')]);
 const extra=newStep(['M02']).slots[0];w.steps[0].slots.push(extra);
 const updated=assignInstrument(w,extra.slot_id,record('unrelated','','Image data'));
 const result=processIOAlignment(updated);assert.equal(result.matched.length,1);assert.equal(result.allAligned,false);
});
