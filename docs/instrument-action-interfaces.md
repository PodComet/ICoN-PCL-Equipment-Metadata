# Model-bound instrument action interfaces

The existing **Position → Fiber → Direction** hierarchy is retained. A Direction can now carry an optional `operation` object using the project schema `instrument-operation/v1`. Older `poly-fibers/v2` lists and saved `instrument-control-sequence/v1` sequences remain valid. Missing definitions stay undocumented; they are not inferred from an M-class or copied from another model.

This is the project's crosswalk to the high-level instruction / device-driver distinction in Zaki et al.'s [MINERVA paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC11912568/). Position, Fiber and Direction are our interface terms, not nomenclature asserted to come from that paper. A high-level process action can require Directions on several instruments. That coordination belongs in Processes.

| Existing level | Meaning | New structured content |
| --- | --- | --- |
| Instrument model | Exact make, model and equipment ID | Model-bound documentation and evidence |
| Position | Mechanical configuration or operating mode | Valid named destinations of a declared transition |
| Fiber | Group of capabilities within a Position | Separate sets of available Directions |
| Direction | One available action | Typed parameters, required settings, units, bounds/options, starting conditions, completion signals, resulting positions and command references |
| Process | Coordination of equipment occurrences | Prerequisite graph, parallel branches, physical-unit reuse and ordering conflicts |

## Use in the app

1. Open an instrument card. Its **POSITION · Fibers & Directions** section shows any documented action interfaces and linked evidence.
2. In **Operation sequence**, add an action and choose Position, Fiber and Direction. Defined parameters appear as typed fields, with their declared units and bounds. Repeated actions retain separate values and IDs.
3. Check the review messages. Missing required values, incompatible types, out-of-range values, unknown parameters and adjacent actions that disagree with a declared success position are flagged. Draft plans remain savable, including incomplete plans.
4. **Save instrument sequence**, or **Save workflow** for a process occurrence, records the chosen values with a frozen operation definition and supporting evidence. JSON, CSV and readable evidence exports preserve the context. Old saved evidence is not rewritten.

Changing Position, Fiber or Direction clears incompatible parameter selections. Numbers are stored with `parameter_values` and their corresponding `parameter_units`, with no implicit conversion. A unit change or missing saved unit triggers a review message instead of silently reinterpreting the number. Use UCUM symbols where possible (`Cel` for degrees Celsius, `mL`, `s`, `1` for dimensionless values). An administrator must normalize incoming values before changing a definition's units; existing saved evidence retains its original units and definition.

## Author or import a definition

In **Admin CSV updates → POSITION → FIBERS → DIRECTIONS → Edit a Direction’s action interface**, load model interfaces, select a Direction, edit its fields, validate, review the before/after list and apply. This uses the same importer and revision checks as CSV uploads. Models without curated Positions/Fibers/Directions must first receive them through the existing upload mechanism.

The optional CSV column `operation_json` holds one `instrument-operation/v1` object for that row's Direction. Download **Blank position template** or **Export current positions** for the extended headers. Older CSV/Excel templates remain accepted without this column. An import replaces each included model's complete interface: export first, retain all its rows, then amend the relevant Direction. A blank operation field removes that Direction's definition in a replacement import. CSV cells must quote JSON correctly.

The [JSON Schema](../catalog/ontology/instrument-operation.schema.json) describes the object. See the [thermocycler example](../catalog/examples/thermocycler-operation.json). Numeric parameters need a unit; IDs must be unique, parameter types and bounds must agree, resulting Positions must exist in the same model interface, and every supplied evidence ID must resolve. Conditions/signals are evidence-linked declarations, not arbitrary code or executable expressions. New evidence can be registered through the existing source columns; uploaded claims remain unverified.

## Thermocycler example and evidence scope

The Opentrons Thermocycler Module GEN2 interface demonstrates five action definitions across its two existing planning modes. `tc.configure_lid_target` declares a required integer `temperature` in `Cel`, from 37 to 110, and refers to `ThermocyclerContext.set_lid_temperature`. The manufacturer's [Lid control documentation](https://docs.opentrons.com/python-api/modules/thermocycler/#lid-control), checked 7 November 2026, supports the range, integer argument, blocking completion and passive cooling (`TC-M09`).

`TC-P03` separately labels the local two-mode transition and admission assumptions. In particular, placing the temperature-setting Direction in `lid_closed` is a project modeling choice, not an asserted manufacturer restriction. Unknown/intermediate lid readings and a complete hardware failure model are not supplied by this two-mode example. Failure transitions remain absent when unsupported. The block-profile Direction remains without a structured definition pending a separately evidenced recipe model. Other instruments await their own model-specific evidence.

## Cross-machine coordination stays in Processes

**Machine coordination** checks the existing process prerequisite graph and physical equipment identity (`physical_unit_id`, falling back to the historical instance ID). Two occurrences of the same model are not automatically one physical unit. Reusing one physical unit in unordered steps triggers an ordering conflict; the panel can add a prerequisite between those steps. Transitive prerequisites count. Independent physical units can remain parallel, even when they share an M-class and model.

The saved workflow-combination evidence contains the coordination assessment, while each occurrence retains its own ordered actions and settings. No instrument profile embeds a process scheduler. Live locks, reservations, timing, observation of signals, device execution and experimental validation remain future work. Passing these planning checks does not establish that an experiment ran or predict a validated material property.

## Validation

`webapp/tests/operation-interface.test.mjs` covers backwards compatibility, typed values and bounds, CSV and workflow/template round trips, frozen evidence definitions and units, sequence continuity checks, physical-unit conflicts, distinct-unit parallelism and transitive prerequisites. Existing position, control-sequence, process and evidence tests remain applicable. No database migration is needed because operation definitions and sequence values use the existing versioned JSON storage.
