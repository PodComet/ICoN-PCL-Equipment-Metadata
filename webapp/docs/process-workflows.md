# Process equipment plans

The **Processes** tab builds an editable theoretical equipment plan from a manufacturing process in the ontology. A horizontal dependency chart presents the full process above the eligible draggable instruments. Its larger, readable overview uses the page width and a minimum display scale; shorter viewports may require scrolling to see the full first instrument row. Actions with no dependencies share the first level, stacked vertically; child steps appear to the right of their prerequisites, with explicit connecting arrows. All vacant category boxes are rendered initially. **Enlarge chart** switches to full-size cards and configuration controls; **Fit whole process** restores the overview without changing assignments. Independent actions can share a vertical column; sharing a level does not prove equipment compatibility or guarantee simultaneous execution with a shared physical unit.

Existing plans initially keep the documented linear source order. Open **Prerequisites** on a step to select every parent that must finish first, or choose **Make independent**. The first dependency edit stores explicit parent step IDs in `extensions.prerequisite_step_ids` and marks `workflow.extensions.dependency_schema` as `process-dependencies/v1`. This survives saving, reopening and JSON export. Cycles, self-dependencies, duplicate parents and missing references are rejected. Removing a parent reconnects its children to that parent's own prerequisites. Source step numbers and source text are preserved for comparison; user-defined parallelism is a planning assumption.

Each equipment category has a separate box. Required branches, alternatives and optional groups remain distinct; an OR branch does not require every alternative. All matching instruments are rendered in the library directly below the chart. The first row is reserved in the automatic fit calculation using its actual rendered height, and source/category filters remain available alongside search. The chart keeps complete boxes and prioritizes readable text over squeezing all controls and instrument details into a short viewport. Opening prerequisites or selecting an unclassified placeholder enlarges the chart for editing. Routes without a documented sequence start with one editable step rather than an invented procedure.

**Equipment plan complete** means the required equipment branches and source stages are covered in dependency order. It triggers the green completion indication and conceptual output animation. Configuration review is an independent advisory with a visible list of affected stages and review checkboxes. An unchecked review flag no longer suppresses equipment-plan success. Unclassified required apparatus, missing stages, incomplete equipment branches, invalid assignments and dependency errors remain blockers. The output card displays the actual outstanding reason when incomplete. Completion does not certify an experimentally successful process or the scientific suitability of a user-chosen apparatus class.

**Clear all** empties the equipment assignments in the current draft while keeping the workflow ID, step sequence, slot classes and notes. Its **Undo clear** action restores the prior assignments and configuration until the next edit or successful save. Clearing a saved workflow does not update storage until **Save workflow** is used.

Choose a slot to filter the instrument library. Drag a mini card (or its drag handle), or use **Add to slot** with a mouse, keyboard or touch device. Photos are prominently displayed in draggable library cards, occupied slots and the pointer drag preview when available. Broken or blank saved images may fall back to the current photo for that same equipment ID, manufacturer and model, without changing stored identity, configuration or price evidence. Photo scope and source remain available under each image. Cards identify the exact catalog model and category context, preserve photo scope in image alternative text, and link to the main instrument card and available documentation. Slot class restrictions apply both in the browser and on save. An empty class filter deliberately allows any ontology class; manually extending a route is a user planning decision, not a new verified capability assertion.

## Automatic matching-class assignment

Assigning a model to a step, using **Add to slot**, drag and drop, **Use selected model**, or explicit unit reuse, fills vacant slots in the other steps that explicitly accept that model's canonical M class. Existing assignments are preserved. Unclassified slots, unrelated M classes and slots with only a shared historical X alias are not automatically filled. Vacant positions in the selected step keep their own selection.

Each filled slot gets a unique instance ID and independent configuration, operation, signal and input/output namespaces. A `physical_unit_id` links sequential uses of the selected unit, so its price is counted once. If another stage needs two positions of the same class, automatic assignment plans distinct physical units within that stage and reuses them across subsequent stages. The notice reports the number of automatically filled slots and any additional units. Saved plans and JSON exports preserve these links. Replacing a model fills only slots that are vacant at that moment; it does not overwrite previous choices. Clearing equipment does not immediately repopulate it.

## Identity and preservation

- Workflows receive `PROC-<route ID>-<UUIDv4>` IDs on the server at first save.
- Steps and slots have independent `STEP-<UUIDv4>` and `SLOT-<UUIDv4>` IDs, unchanged by reordering.
- Assigned instruments receive `<canonical M/X class>-<UUIDv4>` instance IDs. Each stores its exact `equipment_id`, canonical `category_id`, legacy M/X references and a complete trusted ontology-record snapshot. Moving an instance retains its identity and configuration. Replacing it creates a new instance. A physical unit may have distinct stage instances linked by `physical_unit_id`; distinct physical units and their quantities are counted separately.
- Per-instance `configuration`, `operating_parameters`, `signals`, `inputs`, `outputs` and `extensions` are JSON objects. `operation_sequence` is an ordered string array. Unknown nested metadata survives subsequent saves. Schema version 1 also provides extension objects at workflow, step and slot level. The initial UI supports named parameters, optional units and operation lines; complex values already stored in a namespace are retained and displayed without flattening.
- Assignment identity, category references, ontology snapshots and price snapshots are resolved server-side from the user's current catalog when first assigned. Subsequent saves retain the original instance evidence and price. Configuration and data namespaces describe the planned instance without modifying the underlying catalog model.

## Budget

Empty workflows and empty steps display **$0**. Each occupied slot contributes its quantity times the assignment's price snapshot:

1. Recorded model MSRP.
2. A complete, validated published manufacturer price, labelled separately from MSRP.
3. A class-equivalent estimated MSRP range marked with an asterisk.

Totals are displayed per step and for the complete process. Mixed currencies are summed separately without an exchange-rate assumption. Missing prices remain explicitly unpriced and never silently become zero. Taxes, integration, consumables and installation are outside these equipment-only planning totals. Reused physical units are counted once across stages, including automatically filled slots. Distinct units of the same model are counted separately. Saved prices remain reproducible as the catalog changes. Replacing an assignment takes a new snapshot.

## Persistence and export

`/api/processes` stores plans in the existing D1 database, scoped to the authenticated account. Every successful save appends an immutable full revision in `process_workflow_versions`. Revision checks and an atomic D1 batch reject stale/concurrent saves without partial history. Runtime workflows, configurations and signals are not committed to the public Git repository.

- `GET /api/processes`: account workflow summaries.
- `GET /api/processes?id=<ID>`: current workflow and recent revision metadata.
- `GET /api/processes?id=<ID>&revision=<number>`: a historical snapshot belonging to that account.
- `PUT /api/processes`: `{workflow, expected_revision}`; new workflows have an empty `workflow_id` and revision zero. The response includes the server ID, saved workflow, revision and timestamps.

**Export JSON** downloads the current complete plan, including IDs, per-instance namespaces and price evidence. Unsaved changes are marked as a draft. Historical revisions can be exported separately. JSON can be archived and used by future integrations; importing JSON through the UI is not implemented in this version. An unsaved draft stays mounted when navigating among the app's tabs; leaving the page or starting another plan prompts about unsaved changes.

Plans are conceptual equipment arrangements, not validated operating procedures. Class associations alone do not validate material compatibility, interfaces, temperatures, pressures or other operating limits.

## Instrument popups and position hierarchy

Click a directory card, an available-instrument card, or an occupied process-slot background/photo to open that exact instrument's popup. Enter or Space on a focused card or slot opens the same popup. Empty slots still filter the inline equipment pool. Embedded variant chips, links, selection buttons, drag handles and assignment controls keep their own actions. Drag movement suppresses the follow-up click. Closing the popup preserves the process draft and placement.

Popups contain a **POSITION / Fibers / Directions** shortcut and an expanded, model-bound Position List. If the assigned model has been removed or renamed in the catalog, its saved snapshot can still open as a read-only popup. A different current model never silently replaces that snapshot.

The display hierarchy is POSITION → one or more FIBERS → each fiber's DIRECTIONS and evidence IDs. Original `poly-fibers/v2` entries remain unchanged: the `position` field groups them for presentation, and a legacy single fiber receives a display-only “Fiber 1” label. Optional project fields `fiber_id` and `fiber_label` support multiple named fibers at the same position. Repeated positions require explicit, globally unique fiber IDs; direction names are unique within each fiber. Exports preserve the original schema and all metadata, and can select one fiber, all fibers in one position, or the full interface. Evidence IDs must resolve to the model evidence register.

Uncurated instruments show the empty POSITION / FIBERS / DIRECTIONS structure and a downloadable blank interface. No mechanical positions, operating modes or allowed actions are invented from a category or inherited from a different model. Persistent position-data editing and manual extraction remain future work.

## Validation

Run `node --experimental-strip-types --test tests/processes.test.mjs` for sequencing, ID preservation, class restrictions, quantities/currencies, snapshot integrity and metadata preservation. The loopback-only `python tests/integration/process_preview.py` additionally checks authentication, origin protection, D1 persistence, history and stale/concurrent writes. It records its disposable local workflow ID in ignored `.sites-runtime/process-qa-id.json` for targeted cleanup. Apply `drizzle/0002_hesitant_devos.sql` once to the local preview database; Sites applies it separately to hosting on publication.

## Relevant instrument library

Selecting a process shows instruments from the equipment classes in its current steps. Select a slot to narrow the list; use **Show all process instruments** to restore all step classes. Added classified slots expand the relevant classes. Empty class selections use the other classified steps; a wholly unclassified plan shows no candidates until classes are selected. Route tags alone cannot bypass the step-class filter. Saved plans retain their own edited steps. Class matches are planning suggestions and need model/configuration compatibility review.

## Category cubes, physical units and Position Lists

The [current workbench guide](../../docs/process-workbench-2026-10-16.md) describes separate category cubes, AND/OR/optional requirement semantics, the complete equipment browser, readiness checks and conceptual output animation. Existing plans expand required cubes in an unsaved draft. Explicit reuse links stage instances with `extensions.physical_unit_id` and counts their price once. Each instrument exposes its model-specific Position List roadmap and per-position fiber exports.


## Starting materials and expected output

Every P process opens with an empty input node to the left of step 1. Choose materials opens a simple inline editor: a process-relevant material dropdown, an amount dropdown, and an attributed photo where available. The material list combines the process suggestions and ingredients of its documented composition examples. Roles are assigned from those choices. Amount choices distinguish solids, liquids, targets, substrates, samples and gas supplies; they are planning inventory quantities, not recommended recipe doses. Legacy custom materials and amounts remain selectable as saved values. Changing a material preserves its MAT UUID and clears its prior amount and output target. The compact input node summarizes the first four entries with thumbnails.

The plan stores `extensions.material_plan` using `process-materials/v1`, bound to the workflow route. It retains material identities, roles, amounts, an optional expected-output target and the selected example ID through saving, revision history and JSON export. Legacy workflows open with an empty material plan. A workflow can complete its equipment requirements while still prompting for unspecified starting materials.

Four source composition examples cover lignin nanoparticle self-assembly, magnetite coprecipitation, supported CuPd nanocubes and patterned gold. A full exact ingredient/role match now recognizes its documented output automatically, even without loading an example template. Legacy example IDs and named targets remain supported. Changed or partial compositions do not inherit that source match. No source recipe, operating conditions, substitutions, yield or dimensions are validated. Every composition source is already in the academic reference library.

Without an exact example, a legacy user-named target stays labeled user-defined. Other output labels combine the selected materials and process form. Single gold/silver inputs have physical particle planning labels in P01/P03; a gold target in a film process has a gold-film target label. These are curator planning targets and do not establish phase, dimensions, conversion or yield. Supporting solvents/gases alone produce no inferred chemical product. Equipment completion still validates the process slots and sequence independently and lights the final output.

The final output box is clickable at every stage. It opens an **Expected output materials** card with its named material target, input amounts, actual selected models and M classes for each step, prerequisite numbers, vacant slots, composition evidence when applicable, and configuration-review status. Incomplete equipment plans are explicitly previews. The card exports `process-output-plan/v1` JSON including input IDs, machine instance IDs, configurations and operation data; quantities of input materials are never copied into predicted output yields. The result is derived from the saved material plan and equipment sequence, rather than stored as an experimental result.

`catalog/material_images.json` records twelve openly licensed photos/micrographs with source identity, author, license, original file, verified display thumbnail and scope. The seed builder generates `app/data/material-images.json`. Input-photo matching is exact by reviewed alias: a polyethylene image cannot become PLGA or PDMS, and bulk metal cannot stand in for nanoparticles. Output images are representative references, selected only for compatible material/form contexts. Original scale bars and image content are preserved. Missing images keep a clear placeholder. The Ota et al. (2015) magnetite image-source article is recorded in the academic library with image-only context and full-text review pending; it is distinct from P33's composition paper.
