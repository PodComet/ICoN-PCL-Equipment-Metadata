# Process M-class functional review — 17 October 2026

All 227 canonical stages were reviewed (173 manufacturing-process stages and 54 material-family narratives), together with the two capability-only process stages. One primary-function replacement is justified; six process-stage refinements add distinct functions or tighten eligibility. One material-stage refinement keeps filling and preservation optional.

| Stage | Current functional placement | Reason |
| --- | --- | --- |
| N06.5 | Manual / no dedicated machine; optional M82, M17 | Container filling may be manual or use optional M82 liquid handling. M17 freeze drying remains a separate optional preservation operation for a validated formulation. No pipette model, mandatory automation or drying requirement is inferred from the source. |
| P05.4 | M85; optional M46, M18 | Functional correction: M85 performs substrate rinsing; M46 is optional purified-water supply, not the rinse fixture. M18 remains optional drying. Review substrate holder, coating/chemistry compatibility, plumbing and exhaust; no exact model is asserted by the supplied source. |
| P06.3 | M85 OR M61 | Choose M85 wet development OR M61 dry residual-layer clearing for a compatible imprint route. The wet branch now has its own class instead of an empty branch. Match developer chemistry and the preceding patterning route; wet benches and dry plasma tools are not interchangeable. |
| P06.4 | M61 OR M23 + M85 | Choose M61 etching OR the complete M23 deposition + M85 solvent lift-off branch. M85 represents wet lift-off, not deposition. Only documented solvent-processing stations are offered for the M85 slot; review resist/solvent, fire protection, exhaust and preceding patterning. |
| P29.4 | M87 + M18 | M87 casting fixture/dish AND M18 vacuum drying. Source methods identify both glass Petri-dish casting and vacuum-oven drying. A casting mould does not replace vacuum drying. Current commercial fixtures are planning candidates; geometry and polymer/solvent compatibility require review. |
| P31.3 | M03 + M87 | M03 mixing/homogenization AND M87 casting fixture/dish. Source methods describe homogeneous stirring and pouring the acid sol into a culture dish. Stirrer geometry is not identified; keep the prior qualification. Select acid-compatible fixture geometry; ambient drying cabinets do not satisfy casting. |
| P37.4 | M87 + M71 | M87 casting mould AND M71 thermal curing oven. The source reports a release-coated mould followed by oven curing. Ambient drying does not replace thermal curing. Mould geometry, release layer and temperature compatibility require review. |
| P42.5 | M85 | M85 solvent-processing station for resist lift-off/rinse. Generic acid/base polypropylene wet benches are excluded unless solvent capability is separately documented. Review the exact resist/solvent, exhaust and configured station; this is a planning eligibility filter, not an operating-procedure validation. |

## Retained equipment

The review does not substitute broad functional neighbours for documented operations. Tecan Cavro Centris remains M07 because the [manufacturer identifies it as a syringe pump](https://partnering.tecan.com/cavro-centris-pump-for-oem-liquid-handling). M63 dosing hardware is distinct from M86 acquisition/control integration. M83 magnetic separation does not replace a source-reported centrifuge. M84 immersion quenching does not replace reaction cooling or a furnace. M85 wafer stations do not automatically perform colloidal washing, gel solvent exchange or M66 dialysis. M87 ambient cabinets cannot substitute for vacuum drying or thermal curing. M88 powder dosing does not imply proven graphite-die loading.

## Model eligibility and saved plans

Both M85 solvent-station configurations from Modutek carry a `solvent_processing` capability tag, based on the [official stainless-steel station documentation](https://www.modutek.com/wet-benches/stainless-steel-wet-bench-systems/). P06.4 and P42.5 require this tag for their M85 lift-off slot; generic wafer bench membership is insufficient. P06.3 keeps wet development and dry clearing as alternatives, and excludes wet-only etchers from its dry branch. P05 substrate-rinse geometry, plumbing and chemistry still need configuration review. These are curator planning classifications, not claims that a particular commercial model was used by article authors.

Opening a saved workflow applies the current step requirements. The existing water purifier becomes optional support in P05.4 and a required M85 station is added. Existing instrument configurations, operation sequences, prices, instance IDs and workflow IDs are preserved. Capability tags refresh only for an exact current model identity; renamed/custom models cannot inherit them. Changed requirements reopen configuration review. Incompatible assignments remain visible for replacement and cannot make a plan complete.

## Academic provenance

Three category-level checked claims link M87 to existing library articles: [Xu et al.](https://doi.org/10.1021/am302624t) for glass-dish casting and vacuum drying, [Tang et al.](https://doi.org/10.1007/s40820-023-01257-5) for stirring followed by dish casting, and [del Bosque et al.](https://doi.org/10.1016/j.polymdegradstab.2023.110278) for a release-coated mould and oven curing. No claim is transferred to an exact commercial mould model. Supplied source sequence text, source file names and source-page fields remain unchanged.

The [complete review ledger](../catalog/process_class_refinement_2026-10-17.json) contains every audited stage ID, before/after requirements, model metadata migrations, source locations and retained-case decisions. The [CSV summary](../catalog/process_class_refinement_2026-10-17.csv) is available for comparison. Canonical edits are in `route_steps.csv`, `routes.csv`, `categories.csv`, `equipment.csv` and `reference_links.csv`.
