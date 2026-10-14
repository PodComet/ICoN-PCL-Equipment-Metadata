import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {csvText,groupRows,matches,safeUrl,VERIFIED} from '../app/catalog-lib.ts';

const seed=JSON.parse(readFileSync(new URL('../app/data/catalog.json',import.meta.url),'utf8'));
const rows=seed.records.map(record=>({record,revision:0}));

test('Purdue filter contains exactly the requested distinct records',()=>{
 const result=rows.filter(r=>matches(r,'','','','',false,true));
 assert.equal(result.length,43);
 assert.equal(result.filter(r=>r.record.model_name==='Renishaw AM400').length,1);
});
test('material/process/name filters compose without searching checksum noise',()=>{
 const result=rows.filter(r=>matches(r,'Genizer','M43','N06','',false,false));
 assert.ok(result.length>=5);
 assert.ok(result.every(r=>r.record.category_id==='M43'));
 const sourced=rows.find(r=>r.record.source_sha256);
 assert.equal(matches(sourced,sourced.record.source_sha256,'','','',false,false),false);
});
test('real capacity variants share one equipment card',()=>{
 const extruders=rows.filter(r=>r.record.model_name.startsWith('Genizer GJE-'));
 assert.equal(groupRows(extruders).length,1);
 assert.deepEqual(extruders.map(r=>r.record.capacity_ml),['10','100','800','3000','10000']);
});
test('manual filter does not promote source or generation-uncertain documents',()=>{
 const result=rows.filter(r=>matches(r,'','','','',true,false));
 assert.equal(result.length,seed.coverage.manual_coverage[VERIFIED]);
 assert.ok(result.every(r=>r.record.manual_match_status===VERIFIED));
});
test('external URLs and spreadsheet exports reject executable prefixes',()=>{
 assert.equal(safeUrl('javascript:alert(1)'), '');
 assert.equal(safeUrl('data:text/html,hello'), '');
 assert.ok(safeUrl('https://www.purdue.edu/'));
 const csv=csvText([{equipment_id:'one',model_name:'=HYPERLINK("bad")',notes:'a,b\nsecond line'}]);
 assert.ok(csv.startsWith('\ufeff'));
 assert.ok(csv.includes("'=HYPERLINK"));
 assert.ok(csv.includes('"a,b\nsecond line"'));
});
