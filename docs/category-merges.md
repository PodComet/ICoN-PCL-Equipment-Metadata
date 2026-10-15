# Approved equipment category merges

The project owner approved these X-to-M changes on 2026-10-14. M identifiers are canonical; original category names remain in `categories.csv` as `source_category_name`. Retired X identifiers remain searchable and are recorded in `category_aliases.csv`.

| Previous category | Canonical M family | Preserved capability |
| --- | --- | --- |
| X-ETCH Selective wet etching | M61 Etching systems | Wet chemical etching, separately searchable from dry plasma etching |
| X-FILTER Filtration and centrifugation, filtration component | M15 Filtration systems | Custom automatic filtration; configuration unspecified |
| X-FILTER Filtration and centrifugation, centrifuge component | M13 General-purpose centrifuges | Centrifugation; model, format and speed class unspecified |
| X-LASER CO2 laser source | M56 Laser sources | CO2 source with continuous-wave and modulated operation; existing pulsed sources retain their subtype |

The original ten-example sets remain intact. Existing M13 benchtop centrifuges and M15 tangential-flow filtration systems retain those specific subtypes. The unspecified Purdue components are not labeled as tangential-flow filtration, nanofiltration or ultracentrifuges.

## Filtration and centrifugation records

`REQ-EQ-022` now identifies the custom filtration component. `REQ-EQ-022-CENTRIFUGES` identifies the centrifuge component, with its own equipment card and a `source_record_id` pointing to the original combined record. The original requested wording remains in `requested_equipment.csv`; its `related_equipment_ids` links the second component.

Both profiles preserve the Purdue P marker. The private original combined inventory entry is available as shared source context on both profiles. Serial numbers have not been assigned to an invented product model, and the source inventory has not been duplicated. New variants do not inherit this link.

There are 632 catalog records: 590 core examples and 42 supplements. All 44 requested occurrences remain, now linked to 44 highlighted equipment records because the repeated AM400 request shares one model and the combined filtration request links two profiles.

## Etching and laser distinctions

P13 Wet chemical etching and P14 Dry plasma etching are curated capability classifications added alongside the original 20 source routes. They are not operating procedures. The 109 original route steps remain unchanged.

The CO2 source retains its source-only price estimate and does not inherit nanoparticle-ablation capability or a pulsed-laser price assumption from other M56 instruments.

## Saved edits and CSV compatibility

The application reapplies the approved category mapping after loading shared and personal records. User-entered notes, documentation and sourced prices remain intact. Legacy X-ETCH and X-LASER CSV identifiers resolve to their canonical M categories. X-FILTER resolves only when an existing equipment record identifies the component; new records must explicitly select M13 or M15.

X-EDM and X-CNC remain machining families. X-MET remains optical surface metrology; no EDM or optical profiler has been classified as an atomic force microscope.
