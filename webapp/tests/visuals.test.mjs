import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {processChainGraph,processContextGraph,sourceVisualWorkflow,graphIssues,graphTurtle,wrapGraphLabel,V} from '../app/visuals-lib.ts';
import {assignInstrument,newStep} from '../app/process-lib.ts';
import {withStepDependencies} from '../app/process-dependencies.ts';
const json=f=>JSON.parse(readFileSync(new URL('../app/data/'+f,import.meta.url),'utf8'));
const catalog=json('catalog.json'),science=json('process-science.json'),components=json('components.json');
function input(id='P27'){
 const route=catalog.routes.find(r=>r.route_id===id),source=sourceVisualWorkflow(route,catalog.steps,components);
 return {route,...source,sourceSteps:catalog.steps,rows:catalog.records.map(record=>({record,revision:0,updated_at:''})),categories:catalog.categories,science};
}
test('every P route produces two resolved, scoped graphs without changing source records',()=>{
 const before=JSON.stringify(catalog);
 for(const route of catalog.routes.filter(r=>r.route_id.startsWith('P'))){const i=input(route.route_id);
  for(const g of [processContextGraph(i),processChainGraph(i)]){assert.deepEqual(graphIssues(g),[]);assert.ok(g.nodes.length);assert.equal(g.source_kind,'source_template');assert.ok(g.nodes.every(n=>n.scope));}
 }
 assert.equal(JSON.stringify(catalog),before);
 const chain=processChainGraph(input());
 assert.equal(chain.edges.length,9);assert.equal(chain.edges.filter(e=>e.predicate===V+'sourceOrderPredecessorFor').length,3);
 assert.ok(chain.edges.some(e=>e.source===chain.nodes.find(n=>n.key==='input').id));
 assert.ok(chain.edges.some(e=>e.target===chain.nodes.find(n=>n.key==='target').id));
});
test('context preserves typed roles, original condition units, locators and explicit unknown operators',()=>{
 const g=processContextGraph(input()),node=k=>g.nodes.find(n=>n.key===k);
 assert.equal(g.nodes.length,13);assert.equal(node('operator').missing,true);assert.equal(node('software').missing,true);
 assert.ok(node('parameters').items.some(i=>i.detail.includes('mg/mL')&&i.evidence_id&&i.url));
 assert.ok(node('parameters').items.some(i=>i.quantity?.value===10&&i.quantity.unit==='mg/mL'&&i.quantity.operator==='eq'));
 assert.ok(node('inputs').items.length>0);assert.ok(node('procedure').items.every(i=>i.url));
 assert.ok(node('setup').items.every(i=>i.detail.includes('class candidate')));
 const rdf=graphTurtle(g);assert.ok(rdf.includes('<'+node('process').id+'> a icon:PlannedProcess'));assert.ok(rdf.includes('<'+node('subprocesses').id+'> a icon:VisualContextGroup'));
 assert.ok(!g.edges.some(e=>e.predicate.includes('bwmd')));
 assert.ok(processChainGraph(input('P13')).warnings.some(w=>w.includes('No curated source sequence')));
});
test('a catalog addition updates candidate counts and a new process stage updates the chain',()=>{
 const i=input(),before=processContextGraph(i),cid=i.workflow.steps[0].slots[0].allowed_category_ids[0];
 const original=before.nodes.find(n=>n.key==='setup').items.find(x=>x.label.startsWith(cid+' ·'));
 const record={...i.rows.find(r=>r.record.category_id===cid).record,equipment_id:'SYNTHETIC-NEW'};
 const after=processContextGraph({...i,rows:[...i.rows,{record,revision:0,updated_at:''}]});
 const updated=after.nodes.find(n=>n.key==='setup').items.find(x=>x.label.startsWith(cid+' ·'));
 assert.equal(parseInt(updated.detail),parseInt(original.detail)+1);
 const w={...i.workflow,steps:[...i.workflow.steps,newStep(['M13'])]};
 assert.equal(processChainGraph({...i,workflow:w}).nodes.length,processChainGraph(i).nodes.length+2);
});
test('parallel prerequisites remain separate, repeated model occurrences keep distinct process identities',()=>{
 const i=input();let w={...i.workflow,steps:[newStep(['M13']),newStep(['M13']),newStep(['M13'])]};
 w=withStepDependencies(w,w.steps[1].step_id,[]);w=withStepDependencies(w,w.steps[2].step_id,[w.steps[0].step_id,w.steps[1].step_id]);
 for(const s of w.steps)w=assignInstrument(w,s.slots[0].slot_id,catalog.records.find(r=>r.equipment_id==='M13-01'));
 const saved={workflow:{...w,workflow_id:'PROC-P27-11111111-1111-4111-8111-111111111111'},revision:4,created_at:'2026-10-18T05:00:00Z',updated_at:'2026-10-18T05:01:00Z'};
 const g=processChainGraph({...i,workflow:saved.workflow,saved});
 const a=g.nodes.find(n=>n.step_id===w.steps[0].step_id&&n.kind==='process'),b=g.nodes.find(n=>n.step_id===w.steps[1].step_id&&n.kind==='process');
 assert.equal(a.x,b.x);assert.notEqual(a.y,b.y);
 assert.equal(g.edges.filter(e=>e.predicate===V+'planningPrerequisiteFor').length,2);
 assert.ok(g.nodes.filter(n=>n.kind==='process').every(n=>n.items[0].equipment_id==='M13-01'));
 assert.equal(g.source_kind,'saved_plan');assert.equal(g.revision,4);assert.ok(g.nodes.every(n=>n.id.includes('/revision/4/')));
 const next=processChainGraph({...i,workflow:saved.workflow,saved:{...saved,revision:5}});assert.ok(next.nodes.every(n=>n.id.includes('/revision/5/')));
});
test('cycle errors do not generate false inter-step lineage and RDF preserves planning scope',()=>{
 const i=input(),w={...i.workflow,extensions:{...i.workflow.extensions,dependency_schema:'process-dependencies/v1'},steps:[newStep(['M13']),newStep(['M13'])]};
 w.steps[0].extensions.prerequisite_step_ids=[w.steps[1].step_id];w.steps[1].extensions.prerequisite_step_ids=[w.steps[0].step_id];
 const g=processChainGraph({...i,workflow:w});assert.ok(g.warnings.some(w=>w.includes('cycle')));assert.ok(!g.edges.some(e=>e.predicate===V+'planningPrerequisiteFor'));
 const rdf=graphTurtle(g);assert.ok(rdf.includes('rdf:Statement'));assert.ok(rdf.includes('icon:requiresReview true'));assert.ok(!rdf.includes('prov:wasGeneratedBy'));assert.ok(!rdf.includes('owl:sameAs'));assert.ok(rdf.includes('dct:references <https://doi.org/10.3390/app142411683>'));
 assert.deepEqual(wrapGraphLabel('short label'),['short label']);assert.equal(wrapGraphLabel('word '.repeat(100)).length,2);
});
