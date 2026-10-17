# Process step M-class audit — 17 October 2026

Reviewed 42 processes, 175 displayed steps (173 source steps plus 2 capability-only planning stages) and 257 classified machine slots. Material-family route narratives are outside the Processes tab and excluded from these counts. No canonical required machine slot has an empty class. Twenty-nine source actions establish no separate machine class; these previously appeared as clickable blank-looking equipment placeholders.

The app now renders those stages as explicit process actions. Adding equipment requires an M-class before creating a slot, and never enlarges the chart automatically. Saved unclassified requests retain their IDs and metadata in a review queue. Source-supported slots are repaired on load. Classless requests cannot accept arbitrary models or count as a complete equipment plan.

## Proposed classes

The following IDs are proposals, not active category assignments. Manufacturer links establish equipment types only; they do not validate source use or specific process/model suitability. Existing-class alternatives below are conditional planning options, not inferred source apparatus.

| Proposed ID | Category | Relevant steps | Scope / qualification |
| --- | --- | --- | --- |
| M82 | Liquid handling and pipetting systems | P17.1, P17.3, P24.1, P24.4, P27.1, P40.1 | Candidate for transfers and feed preparation; no pipette model is asserted by the source rows. |
| M83 | Magnetic particle separation systems | P33.4 | P33 step 4 is an optional characterization-preparation branch, not a universal production requirement. Representative magnetic-bead racks are not validated for the cited magnetite formulation. |
| M84 | Quench tanks and immersion cooling vessels | P35.5 | P35 explicitly records a water-quench vessel but no make/model; the cited manufacturer page establishes the equipment type only. |
| M85 | Wet-process benches and batch solvent-exchange stations | P25.5, P31.4, P42.3, P42.5 | A planning grouping; a wafer solvent bench does not automatically fit colloidal washing or gel solvent exchange. Separate subtypes and chemistry compatibility are required. |
| M86 | Process data acquisition and feedback-control systems | P21.5, P22.4 | Existing optical instruments remain M35/M40 and pumps remain M07; DAQ type evidence does not establish a valid closed-loop controller for either cited process. |
| M87 | Casting/moulding fixtures and ambient drying stations | P16.3 | Proposal derived from the P16 source action. An accessory-level extension may fit better than an M-class; do not substitute a heated oven for room-temperature drying. |
| M88 | Powder dispensing and die-loading systems | P41.3 | Candidate for a future automated P41 loading branch. Commercial powder dosing establishes the equipment type, not graphite-die or nanocarbon compatibility. |

## Every action with no separately established class

| Step | Action | Conditional existing classes | Proposed class | Recommendation |
| --- | --- | --- | --- | --- |
| P15.3 | Cool and recover precipitate | M13, M15, M33 | None needed / existing-class review | Handling/recovery; choose centrifugation, filtration or controlled cooling only if a reviewed procedure calls for it. |
| P16.3 | Mould and ambient-dry scaffold | None established | M87 | Moulding and ambient drying use fixtures/accessories; no heated oven is established. |
| P17.1 | Prepare polymer and drug phases | M02, M03 | M82 | Feed preparation is reported without a device. Mixing and liquid-transfer classes are optional implementation choices. |
| P17.3 | Disperse into aqueous stabilizer | M02, M03 | M82 | Transfer/disperse operation; mixing geometry is unreported. |
| P17.4 | Evaporate solvent and recover particles | M16, M29 | None needed / existing-class review | Passive evaporation/recovery is reported. M16 applies only if rotary evaporation is deliberately adopted; M29 is containment, not evaporation machinery. |
| P21.5 | Use growth feedback for next experiment | M40 | M86 | Reuse Raman measurement hardware; feedback orchestration is a control-layer gap. |
| P22.4 | Measure feedback and update flow ratios | M35, M07 | M86 | Optical feedback and flow adjustment need the existing sensor/pump plus a separately specified controller. |
| P23.4 | Redisperse collected precipitate | M09, M10, M50 | None needed / existing-class review | Manual redispersion is retained. Sonication or vessel mixing are alternatives requiring procedure review. |
| P24.1 | Prepare separate silver and reducing/stabilizing feeds | M02, M03 | M82 | Solution preparation and dispensing lack a reported device identity. |
| P24.4 | Collect the nanoparticle suspension | None established | M82 | Collection can remain a receiving-vessel action; use liquid handling only for a deliberate automated sampling/transfer branch. |
| P25.2 | Cool, wash and redisperse the nanocubes | M13, M15, M09, M10 | None needed / existing-class review | Cooling/washing/redispersion do not identify the separation or mixing mechanism; do not make these classes jointly required. |
| P25.5 | Remove ligands and wash the catalyst | M15, M02, M03 | M85 | Washing and ligand removal require source-specific chemistry and hardware review. |
| P27.1 | Prepare polymer reservoirs and aqueous antisolvent | M02, M03 | M82 | Reservoir and solution preparation can remain manual; liquid handling is an automation candidate. |
| P28.1 | Combine monomers and organoclay | M02, M03 | None needed / existing-class review | Initial combining is handling; later steps already carry the stirring requirements. |
| P29.1 | Prepare polymer solution and nanofiller dispersion | M11 | None needed / existing-class review | Reuse the named homogenizer from step 2 only if chosen for this preparation; no additional unit is established. |
| P30.1 | Dissolve technical lignin in solvent | M02, M03 | None needed / existing-class review | Dissolution apparatus is unreported. A powered stirrer is a planning option, not a source fact. |
| P30.3 | Retain the self-assembled particle dispersion | None established | None needed / existing-class review | Retention/collection of the resulting dispersion needs no dedicated new machine class unless storage or automation is separately specified. |
| P31.4 | Gel and exchange solvent with water | None established | M85 | Batch gelation/solvent exchange is distinct from pressure filtration and dialysis; do not assign M15/M66 without evidence. |
| P32.1 | Mix oxide precursors and graphene dispersion | M02, M03 | None needed / existing-class review | The mixing geometry is unspecified; retain as an action until a procedure selects a mixer. |
| P33.4 | Recover and redisperse material | None established | M83 | Magnetic recovery/washing is documented in an optional characterization-preparation branch only. |
| P35.5 | Quench treated rod | None established | M84 | A water-quench vessel is explicitly recorded; its make/model and configuration remain unreported. |
| P36.1 | Prepare precursor solution | M02, M03 | None needed / existing-class review | Precursor solution preparation does not establish a particular mixer. |
| P37.3 | Add curing agent and mix | None established | None needed / existing-class review | The source explicitly says manual mixing. No new M-class is needed for the hand operation; powered mixing would be a revised procedure. |
| P40.1 | Prepare separate precursor solutions | M02, M03 | M82 | Solution preparation and transfer can be implemented with reviewed mixing/liquid-handling choices. |
| P40.4 | Cool coated substrate under atmosphere | M21, M32 | None needed / existing-class review | Cooling occurs in the existing CVD/atmosphere arrangement; reuse those classes rather than inventing a separate cooler. |
| P41.2 | Recover nanocarbon-coated alloy powder | M12, M81 | None needed / existing-class review | Recover the powder after the existing milling stage; no separate powered recovery machine is established. |
| P41.3 | Load coated powder into graphite die | M69 | M88 | Graphite die loading is currently a handling action associated with SPS. Automated powder dosing/die loading would be a new branch. |
| P42.3 | Develop and rinse substrate | None established | M85 | Develop/rinse is wet processing, not automatically etching or a separate lithography machine. |
| P42.5 | Lift off resist and rinse | None established | M85 | Resist lift-off/rinse needs a solvent-compatible wet-process station if a machine-level implementation is selected. |

## Equipment-type sources

- M82: [manufacturer equipment-type source](https://www.eppendorf.com/en/own-your-solution/manual/). Manual/electronic pipettes and dispensers, plus automated pipetting workstations; complements pumps M07 and general robots M62.
- M83: [manufacturer equipment-type source](https://www.thermofisher.com/us/en/home/brands/product-brand/dynal/magnets.html?open=order-magnets). Magnetic racks, separators and flow-through magnetic recovery assemblies.
- M84: [manufacturer equipment-type source](https://nabertherm.com/en/products/industry/thermal-process/processes-under-protective/compact-quenching). Water/oil/polymer quench baths and tanks, kept distinct from furnaces and recirculating chillers.
- M85: [manufacturer equipment-type source](https://www.modutek.com/wet-benches/stainless-steel-wet-bench-systems/). Development, rinsing, lift-off, washing and batch solvent-exchange stations, with operation-specific configuration.
- M86: [manufacturer equipment-type source](https://www.ni.com/en-us/shop/compactdaq.html). Sensor interfaces, DAQ hardware and controllers; software and feedback policies remain configuration data.
- M88: [manufacturer equipment-type source](https://www.mt.com/us/en/home/products/Laboratory_Weighing_Solutions/analytical-balances/automatic-balance.html). Metered powder feeders/dispensers and configurable die-filling/loading assemblies.

Full source statements, article/page locators and qualifications are preserved in [the audit JSON](../catalog/process_class_audit_2026-10-17.json). These sources remain linked to the existing academic library; commercial type examples are not added as academic articles.
