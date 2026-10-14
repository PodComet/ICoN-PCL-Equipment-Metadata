import type {CatalogRow} from './catalog-lib.ts';

export type InventoryAsset={instrument_id:string;equipment_id:string;institution:string;serial_number:string;other_id:string;serial_or_other_id:string;inventory_status:string;quantity:string;description:string;inventory_notes:string;evidence_basis:string;recorded_date:string};
export function inventoryFor(assets:InventoryAsset[],equipmentId:string){return assets.filter(a=>a.equipment_id===equipmentId)}
export function attachInventory(rows:CatalogRow[],assets:InventoryAsset[]):CatalogRow[]{
 return rows.map(row=>{const linked=inventoryFor(assets,row.record.equipment_id);return {...row,record:{...row.record,purdue_instrument_ids:linked.map(a=>a.instrument_id).join('; '),purdue_serial_or_other_ids:linked.map(a=>a.serial_or_other_id).join('; ')}}});
}
export function inventoryStatus(status:string){return ({identifier_recorded:'Identifier recorded',planned_purchase:'To be purchased',planned_build:'To be designed and built',mixed_available_and_planned:'Available centrifuges; filtration planned'} as Record<string,string>)[status]||status.replaceAll('_',' ')}
