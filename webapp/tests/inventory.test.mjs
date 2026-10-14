import test from 'node:test';
import assert from 'node:assert/strict';
import {attachInventory,inventoryFor,inventoryStatus} from '../app/inventory-lib.ts';
import {matches,groupRows,csvText} from '../app/catalog-lib.ts';

const rows=[{record:{equipment_id:'MODEL-1',model_name:'Example printer',purdue_list:'true'},revision:0},{record:{equipment_id:'MODEL-2',model_name:'Example furnace'},revision:0}];
const assets=[{instrument_id:'EXAMPLE-001',equipment_id:'MODEL-1',serial_number:'EXAMPLE-SN-A',serial_or_other_id:'EXAMPLE-SN-A',inventory_status:'identifier_recorded'}, {instrument_id:'EXAMPLE-002',equipment_id:'MODEL-1',serial_number:'EXAMPLE-SN-B',serial_or_other_id:'EXAMPLE-SN-B',inventory_status:'identifier_recorded'}, {instrument_id:'EXAMPLE-003',equipment_id:'MODEL-2',serial_number:'',serial_or_other_id:'To be purchased',inventory_status:'planned_purchase'}];
test('two installed units link to one model card without inventing variants',()=>{
 const enriched=attachInventory(rows,assets);
 assert.equal(enriched.length,2);assert.equal(groupRows(enriched).length,2);
 assert.equal(inventoryFor(assets,'MODEL-1').length,2);
 assert.equal(rows[0].record.purdue_instrument_ids,undefined);
 assert.equal(enriched[0].record.purdue_instrument_ids,'EXAMPLE-001; EXAMPLE-002');
});
test('instrument IDs and serials search the associated model',()=>{
 const enriched=attachInventory(rows,assets);
 for(const query of ['EXAMPLE-002','EXAMPLE-SN-B'])assert.equal(enriched.filter(r=>matches(r,query,'','','',false,true)).length,1);
 assert.equal(matches(enriched[1],'EXAMPLE-SN-B','','','',false,false),false);
});
test('planned purchases remain status information with empty serial',()=>{
 assert.equal(assets[2].serial_number,'');assert.equal(inventoryStatus(assets[2].inventory_status),'To be purchased');
 assert.match(csvText(assets),/To be purchased/);
});
test('an empty private inventory leaves no inherited unit identity',()=>{
 const enriched=attachInventory(attachInventory(rows,assets),[]);
 assert.equal(enriched[0].record.purdue_instrument_ids,'');assert.equal(enriched[0].record.purdue_serial_or_other_ids,'');
});
