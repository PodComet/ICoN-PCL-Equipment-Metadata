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

## Validation

Run `node --experimental-strip-types --test tests/processes.test.mjs` for sequencing, ID preservation, class restrictions, quantities/currencies, snapshot integrity and metadata preservation. The loopback-only `python tests/integration/process_preview.py` additionally checks authentication, origin protection, D1 persistence, history and stale/concurrent writes. It records its disposable local workflow ID in ignored `.sites-runtime/process-qa-id.json` for targeted cleanup. Apply `drizzle/0002_hesitant_devos.sql` once to the local preview database; Sites applies it separately to hosting on publication.

## Relevant instrument library

Selecting a process shows instruments from the equipment classes in its current steps. Select a slot to narrow the list; use **Show all process instruments** to restore all step classes. Added classified slots expand the relevant classes. Empty class selections use the other classified steps; a wholly unclassified plan shows no candidates until classes are selected. Route tags alone cannot bypass the step-class filter. Saved plans retain their own edited steps. Class matches are planning suggestions and need model/configuration compatibility review.

## Category cubes, physical units and Position Lists

The [current workbench guide](../../docs/process-workbench-2026-10-16.md) describes separate category cubes, AND/OR/optional requirement semantics, the complete equipment browser, readiness checks and conceptual output animation. Existing plans expand required cubes in an unsaved draft. Explicit reuse links stage instances with `extensions.physical_unit_id` and counts their price once. Each instrument exposes its model-specific Position List roadmap and per-position fiber exports.
