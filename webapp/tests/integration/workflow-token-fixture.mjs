// Synthetic local preview only: model reference is public; no inventory or user plans.
import {readFileSync} from 'node:fs';
import {createWorkflow,newStep,assignInstrument,reuseInstrument} from '../../app/process-lib.ts';
import {newStartingMaterial,withMaterialPlan} from '../../app/process-materials-lib.ts';
const catalog=JSON.parse(readFileSync(new URL('../../app/data/catalog.json',import.meta.url)));
const model=catalog.records.find(r=>r.equipment_id==='REQ-EQ-005');
let w=createWorkflow(catalog.routes.find(r=>r.route_id==='P48'),catalog.steps);
w.name='Synthetic three-token preview';
w.steps=[newStep([model.category_id]),newStep([model.category_id])];
w=assignInstrument(w,w.steps[0].slots[0].slot_id,model);
w=reuseInstrument(w,w.steps[1].slots[0].slot_id,w.steps[0].slots[0].slot_id);
w=withMaterialPlan(w,{schema:'process-materials/v1',route_id:w.route_id,inputs:[newStartingMaterial({name:'Synthetic test powder',role:'feedstock'},'500 g')],expected_output:'Synthetic annular coupon',example_id:''});
w.extensions.recipe_geometry={schema:'iconpcl-geometry/v1',shape:'Annular coupon',design_url:'https://example.org/synthetic-coupon.step',design_sha256:'a'.repeat(64),format:'model/step',coordinate_frame:'Right-handed, mm',build_orientation:'Z up',dimensions:[{name:'outer_diameter',value:12,unit:'mm'}],tolerance:'Illustrative; no manufacturing claim'};
process.stdout.write(JSON.stringify({workflow:w,model_id:model.equipment_id}));
