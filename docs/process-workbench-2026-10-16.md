# Process equipment workbench

The Processes tab opens with a compact horizontal dependency hierarchy with larger text and a minimum readable display scale above the relevant draggable instruments. Every assigned and vacant slot is rendered; the chart scales as a complete unit rather than clipping boxes. Independent steps stack in the same vertical column; arrows run from prerequisites to children on their right. **Enlarge chart** exposes full-size instrument cards and configuration controls; **Fit whole process** restores the compact overview. Open **Prerequisites** to edit dependencies. Existing plans keep their source sequence until explicitly edited; user-defined dependencies remain planning assumptions. The complete eligible instrument pool is rendered below the chart, with a jump link above it. Empty cubes are clickable and keyboard-selectable, and choosing a classified vacant cube filters the normal instrument pool below; the equipment browser opens only through its Browse all instruments button. Each cube names its category; cards show both category ID and category name.

**Browse all instruments** opens a searchable equipment browser with category filters, model photographs, documentation links and a destination-slot selector. Its contents remain limited to the classes used by the current process steps, narrowing further to a selected slot. Clearing a filter restores the eligible pool rather than the full ontology.

## Step requirements and plan completion

The `requirements_json` field in `catalog/route_steps.csv` separates equipment used together from alternatives. Its `required_branches` are OR alternatives, with AND requirements inside each branch. Repeated class IDs inside a branch mean separate simultaneous equipment slots. Optional categories stay visible without becoming universally required. An optional multi-instrument branch, once started, needs its remaining instruments.

The [review audit](../catalog/process_requirements_review_2026-10-16.json) covers all **172 pre-existing manufacturing-process stages across 39 sequenced routes**. It identifies **29 stages with unclassified required apparatus** and **23 with unresolved branch/configuration dependencies**. These are interpretations of the existing source sequences, not new claims of experimental validation. P13 and P14 remain capability-only plans with a visible sequence-review advisory.

Every classified category has a separate cube. Unknown required apparatus has its own placeholder: choose a reviewed equipment class before assigning a model. Branch/configuration dependencies are displayed with an explicit planner review acknowledgment. Manual handling without a separately established machine does not require inventing a machine.

The completion indicator checks required category coverage, distinct simultaneous units, original source-stage presence, dependency validity, slot compatibility and unclassified apparatus. Original source order remains the default; explicitly edited dependencies define the planning order. Configuration review is tracked separately: unchecked review acknowledgments remain visible as advisories and do not block equipment-plan completion. The overview lists the affected stages, their review notes and acknowledgment controls. On completion, a green success indicator appears and a representative **conceptual expected-output illustration** animates. Incomplete output cards explain the actual unmet requirement. Reduced-motion preferences disable the animation. This indicates equipment-plan completeness; it does not certify configuration compatibility, execute a protocol, or establish successful physical manufacture.

Dependencies are stored as stable parent step IDs in step extensions and survive saving, reopening and JSON export. Cycles, self-dependencies, missing parent steps and duplicate parents are rejected. Removing a step reconnects its children to its own prerequisites.

Older saved plans expand their category cubes in the opened draft while preserving instrument assignments, slot IDs, notes and custom metadata. New cubes are not written back until the user saves.

## Reusing equipment

Choose **Reuse an existing unit** to use a previously assigned machine in a later stage. Each stage retains its own instance/configuration namespaces; an explicit `extensions.physical_unit_id` connects the same physical unit across stages. The total counts that unit once. Its quantity must agree across stages. A reused unit cannot satisfy two simultaneous equipment positions in the same branch. Assigning a model now also fills vacant slots of its canonical M class in other steps. These stage instances share a physical unit and one purchase cost; stages requiring multiple positions use distinct physical units. Existing assignments and unrelated/unclassified slots remain unchanged.

## Opentrons scope

The [manufacturer Thermocycler API documentation](https://docs.opentrons.com/python-api/modules/thermocycler/) establishes GEN2 and earlier GEN1 thermocycler generations and discusses Flex Gripper handling. The catalog now includes:

- **M70: Opentrons Thermocycler Module GEN2 / TCG2**, with exact-model photograph, operating manual and specifications.
- **M70: Thermocycler Module GEN1**, as a separate generation chip. GEN2 photographs, manual and price are not inherited.
- **M62: Flex Gripper GEN1**, as a Flex-compatible handling accessory, with component instructions and specifications.

Manufacturer starting prices were recorded separately from MSRP: thermocycler family **USD 10,230**, Flex Gripper family **USD 9,750**, checked 2026-10-16. These are configuration-dependent starting prices. No independent nanomaterial manufacturing association was established by these control documents. **P43** is explicitly a control-interface example with a sample-plate illustration, not a newly verified nanomaterial synthesis route.

See the [manufacturer review](../catalog/opentrons_review_2026-10-16.json) for source URLs, generation limits and unresolved details.

## Position List roadmap

Every instrument card has a model-bound **Position List** section and a downloadable `poly-fibers/v2` template. The [CSV index](../catalog/equipment_position_lists.csv) lists all **669 seed records**. New app-created models also receive a blank template dynamically.

The [interface registry](../catalog/position_interfaces.json) contains a two-position **GEN2 draft example**, with a `poly-evidence/v1` register. Eight manufacturer facts are verified against official documentation; two planning assumptions are explicitly draft. Positions and directions cite evidence IDs that resolve to this register. Intermediate/unknown readings, operational guards, timing, recipes and error recovery remain outside the two-position abstraction. In particular, lower lid targets rely on **passive** cooling; the draft does not invent active lid cooling or adopt the pasted example's fixed PCR recipe.

Users can browse positions, export the full Position List, export a single position's fiber, or export the interface with its evidence. Other models have empty lists marked **not started**. Future work is to extract and review model-specific positions and directions from exact manuals, then add persistent curation/import tools. No generic operating states are automatically assigned to every machine.
